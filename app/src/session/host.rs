use std::time::Duration;

use async_channel::Receiver;
use cards_core::{Event, GameKind, Rng};
use cards_net::transport::{
    ALPN, Directory, HostEvent, HostNet, PkarrDirectory, claim_code, keep_published, player_id,
};
use cards_net::{Delivery, HostError, HostSession, Stage};
use nsh_core::prelude::*;

use super::{Command, Controller, Intent, Status, bind, until_leave};
use crate::identity;

const AI_THINK: Duration = Duration::from_millis(800);
const AI_AFTER_TRICK: Duration = Duration::from_millis(2400);

pub enum Start {
    New {
        name: String,
        kind: GameKind,
        seats: usize,
    },
    Resume,
}

enum Step {
    Intent(Option<Intent>),
    Net(Option<HostEvent>),
    AiTick,
}

pub async fn run(controller: Controller, intents: &Receiver<Intent>, start: Start) {
    if let Err(message) = serve(controller, intents, start).await {
        controller.fail(message);
        until_leave(intents).await;
    }
}

async fn open(
    start: Start,
    net_id: iroh::EndpointId,
    directory: &PkarrDirectory,
) -> Result<HostSession, String> {
    match start {
        Start::New { name, kind, seats } => {
            let mut rng = Rng::new(identity::random_u64().map_err(|e| e.to_string())?);
            let code = claim_code(directory, &mut rng, net_id)
                .await
                .map_err(|e| e.to_string())?;
            HostSession::new(code, player_id(net_id), &name, kind, seats).map_err(host_error)
        }
        Start::Resume => {
            let mut session = identity::saved_host().ok_or("there is no saved table to resume")?;
            if session.host_id() != Some(player_id(net_id)) {
                identity::forget_host();
                return Err("the saved table was hosted from another device".into());
            }
            directory
                .publish(session.code(), net_id)
                .await
                .map_err(|e| e.to_string())?;
            session.resume();
            Ok(session)
        }
    }
}

async fn serve(
    controller: Controller,
    intents: &Receiver<Intent>,
    start: Start,
) -> Result<(), String> {
    let endpoint = bind(vec![ALPN.to_vec()]).await?;
    let id = endpoint.id();
    let directory = PkarrDirectory::new(&endpoint).map_err(|e| e.to_string())?;
    let mut session = open(start, id, &directory).await?;
    let code = session.code();
    controller.code.set(Some(code));
    let net = HostNet::start(endpoint);
    let publisher = spawn(async move {
        keep_published(&directory, code, id, |e| {
            controller.notice.set(Some(e.to_string()))
        })
        .await;
    });
    let mut rng = Rng::new(identity::random_u64().map_err(|e| e.to_string())?);
    let (tick_sender, ticks) = async_channel::unbounded::<()>();
    let mut tick_pending = false;
    publish(controller, &session);
    controller.status.set(Status::Online);

    let ended = loop {
        if !tick_pending && session.ai_actor().is_some() {
            tick_pending = true;
            let sender = tick_sender.clone();
            set_timeout(ai_delay(&session), move || {
                let _ = sender.try_send(());
            });
        }
        let step = n0_future::future::race(
            async { Step::Intent(intents.recv().await.ok()) },
            n0_future::future::race(async { Step::Net(net.next_event().await) }, async {
                let _ = ticks.recv().await;
                Step::AiTick
            }),
        )
        .await;
        let deliveries = match step {
            Step::Intent(None | Some(Intent::Leave)) => break false,
            Step::Intent(Some(Intent::End)) => break true,
            Step::Intent(Some(Intent::Room(command))) => apply(&mut session, command, &mut rng)
                .unwrap_or_else(|e| {
                    controller.notice.set(Some(host_error(e)));
                    Vec::new()
                }),
            Step::Intent(Some(_)) => continue,
            Step::Net(None) => return Err("networking stopped".into()),
            Step::Net(Some(HostEvent::Message { from, message })) => session.handle(from, message),
            Step::Net(Some(HostEvent::Disconnected(peer))) => session.disconnected(peer),
            Step::AiTick => {
                tick_pending = false;
                match session.play_ai(&mut rng) {
                    None => Vec::new(),
                    Some(result) => {
                        result.map_err(|r| format!("the AI made an illegal move: {r:?}"))?
                    }
                }
            }
        };
        send(&net, deliveries)?;
        publish(controller, &session);
    };

    if ended {
        send(&net, session.close())?;
        identity::forget_host();
    }
    publisher.cancel();
    net.shutdown().await;
    Ok(())
}

fn apply(
    session: &mut HostSession,
    command: Command,
    rng: &mut Rng,
) -> Result<Vec<Delivery>, HostError> {
    match command {
        Command::AddAi => session.add_ai(),
        Command::Remove(seat) => session.remove(seat),
        Command::Start => session.start(rng.next_u64()),
        Command::Act(action) => session.host_act(action),
        Command::NextRound => session.next_round(),
        Command::Autoplay(seat, on) => session.set_autoplay(seat, on),
    }
}

fn send(net: &HostNet, deliveries: Vec<Delivery>) -> Result<(), String> {
    net.deliver(deliveries)
        .map_err(|e| format!("could not encode a message: {e:?}"))
}

fn publish(controller: Controller, session: &HostSession) {
    controller.snapshot.set(Some(session.host_snapshot()));
    if let Err(e) = identity::save_host(session) {
        controller.notice.set(Some(e.to_string()));
    }
}

fn ai_delay(session: &HostSession) -> Duration {
    let trick_just_won = match &session.host_snapshot().stage {
        Stage::Playing { events, .. } => events.iter().any(|e| matches!(e, Event::TrickWon { .. })),
        Stage::Lobby => false,
    };
    if trick_just_won {
        AI_AFTER_TRICK
    } else {
        AI_THINK
    }
}

fn host_error(error: HostError) -> String {
    match error {
        HostError::InvalidName => "Enter a name of 1 to 20 characters.".into(),
        HostError::UnsupportedCapacity { min, max } => format!("Choose {min} to {max} players."),
        HostError::TableFull => "The table is full.".into(),
        HostError::TableNotFull => "Fill every seat before starting.".into(),
        HostError::NotInLobby => "The game has already started.".into(),
        HostError::NotPlaying => "The game has not started.".into(),
        HostError::NoSuchSeat => "That seat is not available.".into(),
        HostError::SeatIsHuman => {
            "Only a disconnected player's seat can be played by the AI.".into()
        }
        HostError::Setup(e) => format!("Could not deal: {e:?}"),
        HostError::Rejected(r) => crate::ui::text::rejection(r),
    }
}

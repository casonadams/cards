use async_channel::Receiver;
use cards_net::transport::{GuestLink, GuestReceiver, NetError, PkarrDirectory, join, rejoin};
use cards_net::{GuestState, Link, RoomCode, ToGuest, ToHost};
use iroh::EndpointId;
use nsh_core::prelude::*;

use super::{Command, Controller, Intent, Status, bind, until_leave};
use crate::identity;

enum LinkEnd {
    Lost,
    Left,
    Ended,
}

enum Step {
    Intent(Option<Intent>),
    Message(Option<Result<ToGuest, NetError>>),
}

pub async fn run(controller: Controller, intents: &Receiver<Intent>, name: &str, code: RoomCode) {
    if let Err(message) = serve(controller, intents, name, code).await {
        controller.fail(message);
        until_leave(intents).await;
    }
}

async fn serve(
    controller: Controller,
    intents: &Receiver<Intent>,
    name: &str,
    code: RoomCode,
) -> Result<(), String> {
    let endpoint = bind(Vec::new()).await?;
    let directory = PkarrDirectory::new(&endpoint).map_err(|e| e.to_string())?;
    let mut state = GuestState::default();
    let mut host: Option<EndpointId> = None;
    loop {
        let attempt = match host {
            None => join(&endpoint, &directory, code, name).await,
            Some(host) => rejoin(&endpoint, host, code, name).await,
        };
        let end = match attempt {
            Err(NetError::Lookup(_)) if host.is_none() => {
                return Err(format!("No table found with code {code}."));
            }
            Err(_) => LinkEnd::Lost,
            Ok(link) => {
                host = Some(link.host);
                state.connected();
                follow(controller, intents, &mut state, link).await?
            }
        };
        match end {
            LinkEnd::Left => break,
            LinkEnd::Ended => {
                until_leave(intents).await;
                break;
            }
            LinkEnd::Lost => {
                if wait_to_retry(controller, intents, &mut state).await? {
                    break;
                }
            }
        }
    }
    endpoint.close().await;
    Ok(())
}

/// Shows the pause and waits out the backoff; true when the player left meanwhile.
async fn wait_to_retry(
    controller: Controller,
    intents: &Receiver<Intent>,
    state: &mut GuestState,
) -> Result<bool, String> {
    let jitter = identity::random_u64().map_err(|e| e.to_string())? as f64 / u64::MAX as f64;
    let Some(delay) = state.connection_lost(jitter) else {
        until_leave(intents).await;
        return Ok(true);
    };
    show(controller, state);
    let left = n0_future::future::race(
        async {
            until_leave(intents).await;
            true
        },
        async {
            timer(delay).await;
            false
        },
    )
    .await;
    Ok(left)
}

async fn follow(
    controller: Controller,
    intents: &Receiver<Intent>,
    state: &mut GuestState,
    link: GuestLink,
) -> Result<LinkEnd, String> {
    let GuestLink {
        mut sender,
        receiver,
        ..
    } = link;
    let (forward, messages) = async_channel::unbounded();
    let reader = spawn(read_all(receiver, forward));
    let end = loop {
        let step =
            n0_future::future::race(async { Step::Intent(intents.recv().await.ok()) }, async {
                Step::Message(messages.recv().await.ok())
            })
            .await;
        match step {
            Step::Intent(None | Some(Intent::Leave | Intent::End)) => {
                let _ = sender.send(&ToHost::Leave).await;
                sender.close();
                break LinkEnd::Left;
            }
            Step::Intent(Some(Intent::Room(Command::Act(action)))) => {
                if sender.send(&ToHost::Act(action)).await.is_err() {
                    break LinkEnd::Lost;
                }
            }
            Step::Intent(Some(_)) => {}
            Step::Message(Some(Ok(message))) => {
                state.receive(message);
                show(controller, state);
                if !state.should_reconnect() {
                    break LinkEnd::Ended;
                }
            }
            Step::Message(Some(Err(NetError::Frame(e)))) => {
                reader.cancel();
                return Err(format!(
                    "The host sent a message this version cannot read ({e:?}). Reload to update."
                ));
            }
            Step::Message(Some(Err(_)) | None) => break LinkEnd::Lost,
        }
    };
    reader.cancel();
    Ok(end)
}

async fn read_all(
    mut receiver: GuestReceiver,
    forward: async_channel::Sender<Result<ToGuest, NetError>>,
) {
    loop {
        let message = receiver.recv().await;
        let failed = message.is_err();
        if forward.send(message).await.is_err() || failed {
            return;
        }
    }
}

fn show(controller: Controller, state: &GuestState) {
    let status = match state.link() {
        Link::Connecting => Status::Connecting,
        Link::Connected => Status::Online,
        Link::HostAway { attempt } => Status::HostAway { attempt },
        Link::Refused(refusal) => Status::Refused(refusal),
        Link::Closed => Status::Closed,
    };
    batch(|| {
        controller.status.set(status);
        controller.snapshot.set(state.snapshot().cloned());
        controller
            .notice
            .set(state.rejection().map(crate::ui::text::rejection));
    });
}

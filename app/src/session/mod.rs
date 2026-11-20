mod guest;
mod host;

use async_channel::{Receiver, Sender};
use cards_core::{Action, GameKind, Seat};
use cards_net::{Refusal, RoomCode, Snapshot};
use nsh_core::prelude::*;

#[derive(Clone, Debug, PartialEq)]
pub enum Status {
    Idle,
    Connecting,
    Online,
    HostAway { attempt: u32 },
    Refused(Refusal),
    Closed,
    Failed(String),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Role {
    Host,
    Guest,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Command {
    AddAi,
    Remove(Seat),
    Start,
    Act(Action),
    NextRound,
    Autoplay(Seat, bool),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Intent {
    Host {
        name: String,
        kind: GameKind,
        seats: usize,
    },
    Resume,
    Join {
        name: String,
        code: RoomCode,
    },
    Room(Command),
    /// Steps away; a host's table pauses and can be resumed from the home screen.
    Leave,
    /// Ends the table for everyone (host) or leaves it (guest).
    End,
}

/// UI-facing handle: signals the screens read, and intents they send.
#[derive(Clone, Copy)]
pub struct Controller {
    pub role: Signal<Option<Role>>,
    pub code: Signal<Option<RoomCode>>,
    pub snapshot: Signal<Option<Snapshot>>,
    pub status: Signal<Status>,
    pub notice: Signal<Option<String>>,
    intents: Stored<Sender<Intent>>,
}

impl Controller {
    /// Creates the controller and its session task; call from the root component.
    pub fn start() -> Controller {
        let (sender, receiver) = async_channel::unbounded();
        let controller = Controller {
            role: signal(None),
            code: signal(None),
            snapshot: signal(None),
            status: signal(Status::Idle),
            notice: signal(None),
            intents: stored(sender),
        };
        spawn(run(controller, receiver));
        controller
    }

    pub fn send(&self, intent: Intent) {
        self.intents.with(|sender| {
            let _ = sender.try_send(intent);
        });
    }

    pub fn command(&self, command: Command) {
        self.send(Intent::Room(command));
    }

    pub fn in_room(&self) -> bool {
        self.role.get().is_some()
    }

    fn enter(&self, role: Role) {
        batch(|| {
            self.role.set(Some(role));
            self.status.set(Status::Connecting);
            self.notice.set(None);
        });
    }

    fn fail(&self, message: impl Into<String>) {
        self.status.set(Status::Failed(message.into()));
    }

    fn reset(&self) {
        let failure = match self.status.get_untracked() {
            Status::Failed(message) => Some(message),
            _ => None,
        };
        batch(|| {
            self.role.set(None);
            self.code.set(None);
            self.snapshot.set(None);
            self.status.set(Status::Idle);
            self.notice.set(failure);
        });
    }
}

async fn run(controller: Controller, intents: Receiver<Intent>) {
    while let Ok(intent) = intents.recv().await {
        match intent {
            Intent::Host { name, kind, seats } => {
                controller.enter(Role::Host);
                host::run(controller, &intents, host::Start::New { name, kind, seats }).await;
            }
            Intent::Resume => {
                controller.enter(Role::Host);
                host::run(controller, &intents, host::Start::Resume).await;
            }
            Intent::Join { name, code } => {
                controller.enter(Role::Guest);
                controller.code.set(Some(code));
                guest::run(controller, &intents, &name, code).await;
            }
            Intent::Room(_) | Intent::Leave | Intent::End => continue,
        }
        controller.reset();
    }
}

/// Waits for the player to leave, ignoring room commands that can no longer apply.
async fn until_leave(intents: &Receiver<Intent>) {
    while let Ok(intent) = intents.recv().await {
        if matches!(intent, Intent::Leave | Intent::End) {
            return;
        }
    }
}

async fn bind(alpns: Vec<Vec<u8>>) -> Result<iroh::Endpoint, String> {
    let secret = crate::identity::secret_key().map_err(|e| e.to_string())?;
    iroh::Endpoint::builder(iroh::endpoint::presets::N0)
        .secret_key(secret)
        .alpns(alpns)
        .transport_config(cards_net::transport::quic_config())
        .bind()
        .await
        .map_err(|e| format!("could not start networking: {e}"))
}

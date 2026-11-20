use std::collections::BTreeMap;

use cards_core::{Action, GameKind, Rng, Seat, ai};
use cards_net::{Delivery, GuestState, HostSession, PlayerId, RoomCode, Snapshot, Stage, ToHost};

pub const HOST: PlayerId = PlayerId([1; 32]);

pub fn guest_id(n: u8) -> PlayerId {
    PlayerId([n + 10; 32])
}

pub fn code() -> RoomCode {
    RoomCode::parse("ABC234").expect("valid code")
}

/// A host session plus guest states, with deliveries applied in memory.
pub struct Room {
    pub host: HostSession,
    pub guests: BTreeMap<PlayerId, GuestState>,
}

impl Room {
    pub fn new(kind: GameKind, capacity: usize) -> Room {
        Room {
            host: HostSession::new(code(), HOST, "Host Person", kind, capacity).expect("session"),
            guests: BTreeMap::new(),
        }
    }

    pub fn deliver(&mut self, deliveries: Vec<Delivery>) {
        for delivery in deliveries {
            self.guests
                .entry(delivery.to)
                .or_default()
                .receive(delivery.message);
        }
    }

    pub fn send(&mut self, from: PlayerId, message: ToHost) {
        let out = self.host.handle(from, message);
        self.deliver(out);
    }

    pub fn join(&mut self, guest: PlayerId, name: &str) {
        self.guests.entry(guest).or_default().connected();
        let proof = code().join_proof(&HOST.0, &guest.0);
        self.send(
            guest,
            ToHost::Join {
                name: name.to_string(),
                proof,
            },
        );
    }

    pub fn snapshot(&self, guest: PlayerId) -> &Snapshot {
        self.guests[&guest]
            .snapshot()
            .expect("guest has a snapshot")
    }

    /// Drives one step: an AI seat, the host, a connected guest, or the next round.
    /// Returns false when the game is over or nobody can act.
    pub fn step(&mut self, rng: &mut Rng) -> bool {
        if let Some(result) = self.host.play_ai(rng) {
            let out = result.expect("ai move accepted");
            self.deliver(out);
            return true;
        }
        let host_view = match &self.host.host_snapshot().stage {
            Stage::Playing { view, .. } => (**view).clone(),
            Stage::Lobby => return false,
        };
        if host_view.game_over {
            return false;
        }
        if host_view.round_over {
            let out = self.host.next_round().expect("next round");
            self.deliver(out);
            return true;
        }
        let Some(actor) = host_view.actor else {
            return false;
        };
        if actor == Seat(0) {
            let action = ai::choose(&host_view, rng).expect("host action");
            let out = self.host.host_act(action).expect("host action accepted");
            self.deliver(out);
            return true;
        }
        let Some((guest, action)) = self.guest_action(actor, rng) else {
            return false;
        };
        self.send(guest, ToHost::Act(action));
        true
    }

    fn guest_action(&self, actor: Seat, rng: &mut Rng) -> Option<(PlayerId, Action)> {
        self.guests.iter().find_map(|(id, state)| {
            let snapshot = state.snapshot()?;
            let Stage::Playing { view, .. } = &snapshot.stage else {
                return None;
            };
            (snapshot.you == actor && state.link() == cards_net::Link::Connected)
                .then(|| ai::choose(view, &mut rng.clone()).map(|a| (*id, a)))
                .flatten()
        })
    }
}

pub fn is_refused(state: &GuestState, refusal: cards_net::Refusal) -> bool {
    state.link() == cards_net::Link::Refused(refusal)
}

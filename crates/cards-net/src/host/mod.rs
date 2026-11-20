mod lobby;

use cards_core::{Action, Event, GameKind, Rejection, Rng, Seat, SetupError, Table, ai};
use serde::{Deserialize, Serialize};

use crate::code::RoomCode;
use crate::protocol::{Occupant, PlayerId, SeatInfo, Snapshot, Stage, ToGuest, ToHost, valid_name};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Delivery {
    pub to: PlayerId,
    pub message: ToGuest,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HostError {
    InvalidName,
    UnsupportedCapacity {
        min: usize,
        max: usize,
    },
    TableFull,
    TableNotFull,
    NotInLobby,
    NotPlaying,
    NoSuchSeat,
    SeatIsHuman,
    Setup(SetupError),
    Rejected(Rejection),
    /// The AI was due to act but had no legal action.
    NoAiAction,
    /// A saved session does not describe a consistent table.
    InvalidSave,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
struct Member {
    player: Option<PlayerId>,
    name: String,
    connected: bool,
    autoplay: bool,
}

impl Member {
    fn human(player: PlayerId, name: String) -> Member {
        Member {
            player: Some(player),
            name,
            connected: true,
            autoplay: false,
        }
    }

    fn ai(name: String) -> Member {
        Member {
            player: None,
            name,
            connected: true,
            autoplay: false,
        }
    }

    fn is_ai_turn(&self) -> bool {
        self.player.is_none() || self.autoplay
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct HostSession {
    code: RoomCode,
    kind: GameKind,
    capacity: usize,
    members: Vec<Member>,
    table: Option<Table>,
    seq: u64,
    last_events: Vec<Event>,
    ai_names_used: usize,
}

const HOST_SEAT: Seat = Seat(0);

impl HostSession {
    pub fn new(
        code: RoomCode,
        host: PlayerId,
        host_name: &str,
        kind: GameKind,
        capacity: usize,
    ) -> Result<HostSession, HostError> {
        let (min, max) = (kind.min_players(), kind.max_players());
        if !(min..=max).contains(&capacity) {
            return Err(HostError::UnsupportedCapacity { min, max });
        }
        let name = valid_name(host_name).ok_or(HostError::InvalidName)?;
        Ok(HostSession {
            code,
            kind,
            capacity,
            members: vec![Member::human(host, name)],
            table: None,
            seq: 0,
            last_events: Vec::new(),
            ai_names_used: 0,
        })
    }

    pub fn code(&self) -> RoomCode {
        self.code
    }

    pub fn host_id(&self) -> Option<PlayerId> {
        self.members.first().and_then(|m| m.player)
    }

    /// Prepares a session restored from storage: checks it is consistent and marks every
    /// guest disconnected until they rejoin.
    pub fn resume(&mut self) -> Result<(), HostError> {
        let consistent = self.host_id().is_some()
            && self.members.len() <= self.capacity
            && self
                .table
                .as_ref()
                .is_none_or(|t| t.seats() == self.members.len());
        if !consistent {
            return Err(HostError::InvalidSave);
        }
        for member in self.members.iter_mut().skip(1) {
            member.connected = false;
        }
        self.seq += 1;
        Ok(())
    }

    /// Public events produced by the most recent change.
    pub fn last_events(&self) -> &[Event] {
        &self.last_events
    }

    /// Ends the table for good: every connected guest is told it closed.
    pub fn close(&mut self) -> Vec<Delivery> {
        self.members
            .iter_mut()
            .skip(1)
            .filter(|m| m.connected)
            .filter_map(|m| {
                m.connected = false;
                m.player
            })
            .map(|player| Delivery::to(player, ToGuest::Closed))
            .collect()
    }

    pub fn handle(&mut self, peer: PlayerId, message: ToHost) -> Vec<Delivery> {
        match message {
            ToHost::Join { name, proof } => self.join(peer, &name, proof),
            ToHost::Act(action) => match self.seat_of(peer) {
                Some(seat) if seat != HOST_SEAT => {
                    self.act(seat, action).unwrap_or_else(|rejection| {
                        vec![Delivery::to(peer, ToGuest::Rejected(rejection))]
                    })
                }
                _ => Vec::new(),
            },
            ToHost::Leave => self.leave(peer),
        }
    }

    pub fn disconnected(&mut self, peer: PlayerId) -> Vec<Delivery> {
        match self.member_mut(peer) {
            Some(member) if member.connected => {
                member.connected = false;
                self.broadcast()
            }
            _ => Vec::new(),
        }
    }

    pub fn host_act(&mut self, action: Action) -> Result<Vec<Delivery>, HostError> {
        self.act(HOST_SEAT, action).map_err(HostError::Rejected)
    }

    pub fn next_round(&mut self) -> Result<Vec<Delivery>, HostError> {
        let table = self.table.as_mut().ok_or(HostError::NotPlaying)?;
        self.last_events = table.start_next_round().map_err(HostError::Rejected)?;
        Ok(self.broadcast())
    }

    pub fn set_autoplay(&mut self, seat: Seat, on: bool) -> Result<Vec<Delivery>, HostError> {
        let member = self
            .members
            .get_mut(seat.index())
            .ok_or(HostError::NoSuchSeat)?;
        if member.player.is_none() {
            return Err(HostError::NoSuchSeat);
        }
        if seat == HOST_SEAT || (on && member.connected) {
            return Err(HostError::SeatIsHuman);
        }
        member.autoplay = on;
        Ok(self.broadcast())
    }

    /// The seat the AI should move for next, if any.
    pub fn ai_actor(&self) -> Option<Seat> {
        let seat = self.table.as_ref()?.actor()?;
        self.members
            .get(seat.index())
            .is_some_and(Member::is_ai_turn)
            .then_some(seat)
    }

    /// Plays one AI move; `None` when no AI seat is due to act.
    pub fn play_ai(&mut self, rng: &mut Rng) -> Option<Result<Vec<Delivery>, HostError>> {
        let seat = self.ai_actor()?;
        let view = self.table.as_ref()?.view(seat);
        Some(match ai::choose(&view, rng) {
            Some(action) => self.act(seat, action).map_err(HostError::Rejected),
            None => Err(HostError::NoAiAction),
        })
    }

    pub fn snapshot(&self, seat: Seat) -> Snapshot {
        let stage = match &self.table {
            None => Stage::Lobby,
            Some(table) => Stage::Playing {
                view: Box::new(table.view(seat)),
                events: self.last_events.clone(),
            },
        };
        Snapshot {
            seq: self.seq,
            kind: self.kind,
            capacity: self.capacity,
            you: seat,
            roster: self.roster(),
            stage,
        }
    }

    pub fn host_snapshot(&self) -> Snapshot {
        self.snapshot(HOST_SEAT)
    }

    fn act(&mut self, seat: Seat, action: Action) -> Result<Vec<Delivery>, Rejection> {
        let table = self.table.as_mut().ok_or(Rejection::WrongPhase)?;
        self.last_events = table.apply(seat, action)?;
        Ok(self.broadcast())
    }

    fn seat_of(&self, peer: PlayerId) -> Option<Seat> {
        self.members
            .iter()
            .position(|m| m.player == Some(peer))
            .map(Seat::from_index)
    }

    fn member_mut(&mut self, peer: PlayerId) -> Option<&mut Member> {
        self.members.iter_mut().find(|m| m.player == Some(peer))
    }

    fn roster(&self) -> Vec<SeatInfo> {
        self.members
            .iter()
            .enumerate()
            .map(|(i, m)| SeatInfo {
                seat: Seat::from_index(i),
                name: m.name.clone(),
                occupant: match (i, m.player) {
                    (0, _) => Occupant::Host,
                    (_, Some(_)) => Occupant::Guest,
                    (_, None) => Occupant::Ai,
                },
                connected: m.connected,
                autoplay: m.autoplay,
            })
            .collect()
    }

    fn broadcast(&mut self) -> Vec<Delivery> {
        self.seq += 1;
        self.members
            .iter()
            .enumerate()
            .skip(1)
            .filter(|(_, m)| m.connected)
            .filter_map(|(i, m)| Some((i, m.player?)))
            .map(|(i, player)| {
                let snapshot = self.snapshot(Seat::from_index(i));
                Delivery::to(player, ToGuest::Snapshot(snapshot))
            })
            .collect()
    }
}

impl Delivery {
    fn to(to: PlayerId, message: ToGuest) -> Delivery {
        Delivery { to, message }
    }
}

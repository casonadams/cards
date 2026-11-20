use cards_core::{Action, Event, GameKind, Rejection, Seat, SeatView};
use serde::{Deserialize, Serialize};

pub const PROTOCOL_VERSION: u8 = 1;
pub const MAX_FRAME_LEN: usize = 64 * 1024;
pub const MAX_NAME_LEN: usize = 20;

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct PlayerId(pub [u8; 32]);

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum ToHost {
    Join { name: String, proof: [u8; 32] },
    Act(Action),
    Leave,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum ToGuest {
    Snapshot(Snapshot),
    Rejected(Rejection),
    Refused(Refusal),
    Closed,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum Refusal {
    WrongCode,
    TableFull,
    GameInProgress,
    InvalidName,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Snapshot {
    pub seq: u64,
    pub kind: GameKind,
    pub capacity: usize,
    pub you: Seat,
    pub roster: Vec<SeatInfo>,
    pub stage: Stage,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum Stage {
    Lobby,
    Playing {
        view: Box<SeatView>,
        events: Vec<Event>,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct SeatInfo {
    pub seat: Seat,
    pub name: String,
    pub occupant: Occupant,
    pub connected: bool,
    pub autoplay: bool,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum Occupant {
    Host,
    Guest,
    Ai,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum FrameError {
    Empty,
    TooLarge { len: usize },
    VersionMismatch { theirs: u8 },
    Malformed,
}

pub fn encode<T: Serialize>(message: &T) -> Result<Vec<u8>, FrameError> {
    let mut frame = vec![PROTOCOL_VERSION];
    frame.extend(postcard::to_allocvec(message).map_err(|_| FrameError::Malformed)?);
    if frame.len() > MAX_FRAME_LEN {
        return Err(FrameError::TooLarge { len: frame.len() });
    }
    Ok(frame)
}

pub fn decode<T: for<'de> Deserialize<'de>>(frame: &[u8]) -> Result<T, FrameError> {
    let (&version, body) = frame.split_first().ok_or(FrameError::Empty)?;
    if frame.len() > MAX_FRAME_LEN {
        return Err(FrameError::TooLarge { len: frame.len() });
    }
    if version != PROTOCOL_VERSION {
        return Err(FrameError::VersionMismatch { theirs: version });
    }
    postcard::from_bytes(body).map_err(|_| FrameError::Malformed)
}

pub fn valid_name(name: &str) -> Option<String> {
    let trimmed = name.trim();
    let len = trimmed.chars().count();
    (1..=MAX_NAME_LEN)
        .contains(&len)
        .then(|| trimmed.to_string())
}

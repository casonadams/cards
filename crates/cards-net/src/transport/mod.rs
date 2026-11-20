mod directory;
mod frame;
mod guest;
mod host;

use std::fmt;
use std::time::Duration;

use iroh::endpoint::QuicTransportConfig;

pub use directory::{Directory, PkarrDirectory, RECORD_REFRESH, claim_code, keep_published};
pub use guest::{GuestLink, GuestReceiver, GuestSender, join, rejoin};
pub use host::{HostEvent, HostNet};

use crate::protocol::{FrameError, PlayerId};

pub const ALPN: &[u8] = b"cards/1";

/// How long a silent connection lasts before the other side is treated as gone.
pub const IDLE_TIMEOUT: Duration = Duration::from_secs(10);

/// QUIC settings for game endpoints: iroh's keep-alives with a short idle timeout,
/// so a guest notices a vanished host (closed tab, lost network) within seconds.
pub fn quic_config() -> QuicTransportConfig {
    QuicTransportConfig::builder()
        .max_idle_timeout(IDLE_TIMEOUT.try_into().ok())
        .build()
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum NetError {
    Lookup(String),
    Publish(String),
    Connect(String),
    Stream(String),
    Frame(FrameError),
    Closed,
}

impl fmt::Display for NetError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            NetError::Lookup(e) => write!(f, "could not find the room: {e}"),
            NetError::Publish(e) => write!(f, "could not announce the room: {e}"),
            NetError::Connect(e) => write!(f, "could not reach the host: {e}"),
            NetError::Stream(e) => write!(f, "connection error: {e}"),
            NetError::Frame(e) => write!(f, "bad message: {e:?}"),
            NetError::Closed => f.write_str("connection closed"),
        }
    }
}

impl From<FrameError> for NetError {
    fn from(err: FrameError) -> Self {
        NetError::Frame(err)
    }
}

pub fn player_id(endpoint: iroh::EndpointId) -> PlayerId {
    PlayerId(*endpoint.as_bytes())
}

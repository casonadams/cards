use std::time::Duration;

use cards_core::Rejection;

use crate::protocol::{Refusal, Snapshot, Stage, ToGuest};

pub const RECONNECT_BASE: Duration = Duration::from_secs(1);
pub const RECONNECT_MAX: Duration = Duration::from_secs(30);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Link {
    Connecting,
    Connected,
    HostAway { attempt: u32 },
    Refused(Refusal),
    Closed,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GuestState {
    link: Link,
    snapshot: Option<Snapshot>,
    rejection: Option<Rejection>,
}

impl Default for GuestState {
    fn default() -> Self {
        GuestState {
            link: Link::Connecting,
            snapshot: None,
            rejection: None,
        }
    }
}

impl GuestState {
    pub fn link(&self) -> Link {
        self.link
    }

    pub fn snapshot(&self) -> Option<&Snapshot> {
        self.snapshot.as_ref()
    }

    pub fn rejection(&self) -> Option<Rejection> {
        self.rejection
    }

    pub fn is_paused(&self) -> bool {
        matches!(self.link, Link::HostAway { .. })
            && matches!(
                self.snapshot.as_ref().map(|s| &s.stage),
                Some(Stage::Playing { .. })
            )
    }

    pub fn should_reconnect(&self) -> bool {
        !matches!(self.link, Link::Refused(_) | Link::Closed)
    }

    pub fn connected(&mut self) {
        if self.should_reconnect() {
            self.link = Link::Connected;
        }
    }

    /// Records a lost connection and returns how long to wait before retrying.
    pub fn connection_lost(&mut self, jitter: f64) -> Option<Duration> {
        if !self.should_reconnect() {
            return None;
        }
        let attempt = match self.link {
            Link::HostAway { attempt } => attempt + 1,
            _ => 1,
        };
        self.link = Link::HostAway { attempt };
        Some(reconnect_delay(attempt, jitter))
    }

    pub fn receive(&mut self, message: ToGuest) {
        match message {
            ToGuest::Snapshot(snapshot) => {
                if self.snapshot.as_ref().is_none_or(|s| snapshot.seq > s.seq) {
                    self.snapshot = Some(snapshot);
                    self.rejection = None;
                }
                self.link = Link::Connected;
            }
            ToGuest::Rejected(rejection) => self.rejection = Some(rejection),
            ToGuest::Refused(refusal) => self.link = Link::Refused(refusal),
            ToGuest::Closed => self.link = Link::Closed,
        }
    }
}

/// Exponential backoff from 1s to 30s; `jitter` in 0..=1 scales the wait to 75-100%.
pub fn reconnect_delay(attempt: u32, jitter: f64) -> Duration {
    if attempt == 0 {
        return Duration::ZERO;
    }
    let exponential = RECONNECT_BASE.saturating_mul(1 << (attempt - 1).min(16));
    exponential
        .min(RECONNECT_MAX)
        .mul_f64(0.75 + 0.25 * jitter.clamp(0.0, 1.0))
}

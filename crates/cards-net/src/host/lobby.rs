use cards_core::{Seat, Table};

use super::{Delivery, HOST_SEAT, HostError, HostSession, Member};
use crate::protocol::{PlayerId, Refusal, ToGuest, valid_name};

const AI_NAMES: [&str; 6] = [
    "Bot Ada", "Bot Bob", "Bot Cy", "Bot Dee", "Bot Eve", "Bot Fox",
];

impl HostSession {
    pub fn add_ai(&mut self) -> Result<Vec<Delivery>, HostError> {
        self.ensure_lobby()?;
        if self.members.len() >= self.capacity {
            return Err(HostError::TableFull);
        }
        let name = AI_NAMES[self.ai_names_used % AI_NAMES.len()].to_string();
        self.ai_names_used += 1;
        self.members.push(Member::ai(name));
        Ok(self.broadcast())
    }

    pub fn remove(&mut self, seat: Seat) -> Result<Vec<Delivery>, HostError> {
        self.ensure_lobby()?;
        if seat == HOST_SEAT || seat.index() >= self.members.len() {
            return Err(HostError::NoSuchSeat);
        }
        let removed = self.members.remove(seat.index());
        let mut out = self.broadcast();
        if let Some(player) = removed.player {
            out.push(Delivery::to(player, ToGuest::Closed));
        }
        Ok(out)
    }

    pub fn start(&mut self, seed: u64) -> Result<Vec<Delivery>, HostError> {
        self.ensure_lobby()?;
        if self.members.len() != self.capacity {
            return Err(HostError::TableNotFull);
        }
        self.table = Some(Table::new(self.kind, self.capacity, seed).map_err(HostError::Setup)?);
        self.last_events.clear();
        Ok(self.broadcast())
    }

    pub(super) fn join(&mut self, peer: PlayerId, name: &str, proof: [u8; 32]) -> Vec<Delivery> {
        let Some(host) = self.host_id() else {
            return Vec::new();
        };
        if self.code.join_proof(&host.0, &peer.0) != proof {
            return vec![Delivery::to(peer, ToGuest::Refused(Refusal::WrongCode))];
        }
        if let Some(member) = self.member_mut(peer) {
            member.connected = true;
            member.autoplay = false;
            return self.broadcast();
        }
        match self.admit(peer, name) {
            Ok(()) => self.broadcast(),
            Err(refusal) => vec![Delivery::to(peer, ToGuest::Refused(refusal))],
        }
    }

    fn admit(&mut self, peer: PlayerId, name: &str) -> Result<(), Refusal> {
        let name = valid_name(name).ok_or(Refusal::InvalidName)?;
        if self.table.is_some() {
            return Err(Refusal::GameInProgress);
        }
        if self.members.len() >= self.capacity {
            return Err(Refusal::TableFull);
        }
        self.members.push(Member::human(peer, name));
        Ok(())
    }

    pub(super) fn leave(&mut self, peer: PlayerId) -> Vec<Delivery> {
        match (self.seat_of(peer), &self.table) {
            (Some(seat), None) if seat != HOST_SEAT => {
                self.members.remove(seat.index());
                self.broadcast()
            }
            (Some(_), Some(_)) => self.disconnected(peer),
            _ => Vec::new(),
        }
    }

    fn ensure_lobby(&self) -> Result<(), HostError> {
        match self.table {
            None => Ok(()),
            Some(_) => Err(HostError::NotInLobby),
        }
    }
}

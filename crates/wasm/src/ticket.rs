use anyhow::Result;
use iroh::EndpointId;
use iroh_gossip::proto::TopicId;
use iroh_tickets::Ticket;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct GameTicket {
    pub topic_id: TopicId,
    pub bootstrap: BTreeSet<EndpointId>,
}

impl GameTicket {
    pub fn new(topic_id: TopicId) -> Self {
        Self {
            topic_id,
            bootstrap: BTreeSet::new(),
        }
    }

    pub fn deserialize(input: &str) -> Result<Self> {
        <Self as Ticket>::decode_string(input).map_err(Into::into)
    }

    pub fn serialize(&self) -> String {
        <Self as Ticket>::encode_string(self)
    }
}

impl Ticket for GameTicket {
    const KIND: &'static str = "game";

    fn encode_bytes(&self) -> Vec<u8> {
        postcard::to_stdvec(&self).expect("failed to serialize game ticket")
    }

    fn decode_bytes(bytes: &[u8]) -> Result<Self, iroh_tickets::ParseError> {
        postcard::from_bytes(bytes).map_err(|_| iroh_tickets::ParseError::verification_failed("invalid ticket bytes"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ticket_roundtrip() {
        let topic = TopicId::from_bytes([7u8; 32]);
        let ticket = GameTicket::new(topic);
        let serialized = ticket.serialize();
        let parsed = GameTicket::deserialize(&serialized).unwrap();
        assert_eq!(ticket, parsed);
    }
}

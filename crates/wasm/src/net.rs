use anyhow::Result;
use iroh::EndpointId;
use iroh::protocol::Router;
use iroh_gossip::api::{Event as GossipEvent, GossipSender};
use iroh_gossip::net::{GOSSIP_ALPN, Gossip};
use iroh_gossip::proto::TopicId;
use n0_future::StreamExt;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::sync::Arc;
use tokio::sync::Mutex as TokioMutex;
use wasm_bindgen::prelude::*;
use wasm_streams::ReadableStream;

use crate::ticket::GameTicket;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum NetEvent {
    Joined,
    NeighborUp { peer: String },
    NeighborDown { peer: String },
    Message { from: String, payload: String },
    Lagged,
}

#[wasm_bindgen]
pub struct IrohNode {
    router: Router,
    gossip: Gossip,
}

#[wasm_bindgen]
impl IrohNode {
    pub async fn spawn() -> Result<IrohNode, JsError> {
        let endpoint = iroh::Endpoint::builder(iroh::endpoint::presets::N0)
            .alpns(vec![GOSSIP_ALPN.to_vec()])
            .bind()
            .await
            .map_err(to_js_err)?;

        let gossip = Gossip::builder().spawn(endpoint.clone());
        let router = Router::builder(endpoint).accept(GOSSIP_ALPN, gossip.clone()).spawn();

        Ok(Self { router, gossip })
    }

    pub fn endpoint_id(&self) -> String {
        self.router.endpoint().id().to_string()
    }

    pub async fn create_room(&self) -> Result<IrohRoom, JsError> {
        let mut random_bytes = [0u8; 32];
        getrandom::fill(&mut random_bytes).map_err(|e| JsError::new(&e.to_string()))?;
        let topic_id = TopicId::from_bytes(random_bytes);
        let ticket = GameTicket::new(topic_id);
        self.join_inner(ticket).await
    }

    pub async fn join_room(&self, ticket_str: String) -> Result<IrohRoom, JsError> {
        let ticket = GameTicket::deserialize(&ticket_str).map_err(to_js_err)?;
        self.join_inner(ticket).await
    }

    async fn join_inner(&self, ticket: GameTicket) -> Result<IrohRoom, JsError> {
        let my_id = self.router.endpoint().id();
        let topic_id = ticket.topic_id;
        let bootstrap: Vec<EndpointId> = ticket.bootstrap.iter().copied().collect();

        let topic = self.gossip.subscribe(topic_id, bootstrap).await.map_err(to_js_err)?;
        let (sender, receiver) = topic.split();

        let neighbors = Arc::new(Mutex::new(ticket.bootstrap.clone()));
        let neighbors_clone = neighbors.clone();

        let receiver_stream = receiver.map(move |item| {
            let event = match item {
                Ok(GossipEvent::NeighborUp(id)) => {
                    neighbors_clone.lock().insert(id);
                    NetEvent::NeighborUp { peer: id.to_string() }
                }
                Ok(GossipEvent::NeighborDown(id)) => {
                    neighbors_clone.lock().remove(&id);
                    NetEvent::NeighborDown { peer: id.to_string() }
                }
                Ok(GossipEvent::Received(msg)) => {
                    let text = String::from_utf8_lossy(&msg.content).to_string();
                    NetEvent::Message {
                        from: msg.delivered_from.to_string(),
                        payload: text,
                    }
                }
                Ok(GossipEvent::Lagged) => NetEvent::Lagged,
                Err(_) => NetEvent::Lagged,
            };
            Ok(serde_wasm_bindgen::to_value(&event).unwrap())
        });

        let raw_stream = ReadableStream::from_stream(receiver_stream).into_raw();

        Ok(IrohRoom {
            topic_id,
            me: my_id,
            neighbors,
            sender: Arc::new(TokioMutex::new(sender)),
            stream: Some(raw_stream),
        })
    }
}

#[wasm_bindgen]
pub struct IrohRoom {
    topic_id: TopicId,
    me: EndpointId,
    neighbors: Arc<Mutex<BTreeSet<EndpointId>>>,
    sender: Arc<TokioMutex<GossipSender>>,
    stream: Option<wasm_streams::readable::sys::ReadableStream>,
}

#[wasm_bindgen]
impl IrohRoom {
    pub fn ticket(&self) -> Result<String, JsError> {
        let mut ticket = GameTicket::new(self.topic_id);
        ticket.bootstrap.insert(self.me);
        let n = self.neighbors.lock();
        ticket.bootstrap.extend(n.iter().copied());
        Ok(ticket.serialize())
    }

    pub fn topic_id(&self) -> String {
        self.topic_id.to_string()
    }

    pub fn take_stream(&mut self) -> Result<wasm_streams::readable::sys::ReadableStream, JsError> {
        self.stream.take().ok_or_else(|| JsError::new("Stream already taken"))
    }

    pub async fn broadcast(&self, payload: String) -> Result<(), JsError> {
        self.sender
            .lock()
            .await
            .broadcast(payload.into_bytes().into())
            .await
            .map_err(to_js_err)?;
        Ok(())
    }
}

pub fn to_js_err(e: impl Into<anyhow::Error>) -> JsError {
    JsError::new(&e.into().to_string())
}

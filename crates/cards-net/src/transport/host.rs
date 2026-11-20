use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};

use async_channel::{Receiver, Sender};
use iroh::Endpoint;
use iroh::endpoint::Connection;
use iroh::protocol::{AcceptError, ProtocolHandler, Router};

use super::frame::{read_frame, write_frame};
use super::{ALPN, NetError, player_id};
use crate::host::Delivery;
use crate::protocol::{FrameError, PlayerId, ToGuest, ToHost, decode, encode};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum HostEvent {
    Message { from: PlayerId, message: ToHost },
    Disconnected(PlayerId),
}

enum Outgoing {
    Frame(Vec<u8>),
    FinalFrame(Vec<u8>),
}

#[derive(Clone, Debug, Default)]
struct Peers {
    inner: Arc<Mutex<PeerTable>>,
}

#[derive(Debug, Default)]
struct PeerTable {
    next_generation: u64,
    links: HashMap<PlayerId, (u64, Sender<Outgoing>)>,
}

impl Peers {
    fn lock(&self) -> MutexGuard<'_, PeerTable> {
        self.inner.lock().unwrap_or_else(PoisonError::into_inner)
    }

    fn register(&self, player: PlayerId, link: Sender<Outgoing>) -> u64 {
        let mut table = self.lock();
        table.next_generation += 1;
        let generation = table.next_generation;
        if let Some((_, old)) = table.links.insert(player, (generation, link)) {
            old.close();
        }
        generation
    }

    /// Removes the link if it is still the player's newest; true when it was.
    fn unregister(&self, player: PlayerId, generation: u64) -> bool {
        let mut table = self.lock();
        let current = table
            .links
            .get(&player)
            .is_some_and(|(g, _)| *g == generation);
        if current {
            table.links.remove(&player);
        }
        current
    }

    fn send(&self, player: PlayerId, outgoing: Outgoing) {
        if let Some((_, link)) = self.lock().links.get(&player) {
            let _ = link.try_send(outgoing);
        }
    }
}

#[derive(Clone, Debug)]
struct GuestHandler {
    peers: Peers,
    events: Sender<HostEvent>,
}

impl GuestHandler {
    async fn serve(&self, connection: &Connection) -> Result<(), NetError> {
        let player = player_id(connection.remote_id());
        let (mut send, mut recv) = connection
            .accept_bi()
            .await
            .map_err(|e| NetError::Stream(e.to_string()))?;
        let (link, outbox) = async_channel::unbounded();
        let generation = self.peers.register(player, link);
        let reader = async {
            loop {
                let message = decode::<ToHost>(&read_frame(&mut recv).await?)?;
                let event = HostEvent::Message {
                    from: player,
                    message,
                };
                self.events
                    .send(event)
                    .await
                    .map_err(|_| NetError::Closed)?;
            }
        };
        let writer = async {
            while let Ok(outgoing) = outbox.recv().await {
                match outgoing {
                    Outgoing::Frame(frame) => write_frame(&mut send, &frame).await?,
                    Outgoing::FinalFrame(frame) => {
                        write_frame(&mut send, &frame).await?;
                        let _ = send.finish();
                        let _ = send.stopped().await;
                        break;
                    }
                }
            }
            Err::<(), NetError>(NetError::Closed)
        };
        let ended = n0_future::future::race(reader, writer).await;
        if self.peers.unregister(player, generation) {
            let _ = self.events.send(HostEvent::Disconnected(player)).await;
        }
        ended
    }
}

impl ProtocolHandler for GuestHandler {
    async fn accept(&self, connection: Connection) -> Result<(), AcceptError> {
        let _ = self.serve(&connection).await;
        connection.close(0u8.into(), b"bye");
        Ok(())
    }
}

/// Accepts guest connections and relays their messages to the session owner.
#[derive(Debug)]
pub struct HostNet {
    router: Router,
    peers: Peers,
    events: Receiver<HostEvent>,
}

impl HostNet {
    pub fn start(endpoint: Endpoint) -> HostNet {
        let peers = Peers::default();
        let (sender, events) = async_channel::unbounded();
        let handler = GuestHandler {
            peers: peers.clone(),
            events: sender,
        };
        let router = Router::builder(endpoint).accept(ALPN, handler).spawn();
        HostNet {
            router,
            peers,
            events,
        }
    }

    pub fn endpoint(&self) -> &Endpoint {
        self.router.endpoint()
    }

    pub async fn next_event(&self) -> Option<HostEvent> {
        self.events.recv().await.ok()
    }

    pub fn deliver(&self, deliveries: Vec<Delivery>) -> Result<(), FrameError> {
        for delivery in deliveries {
            let frame = encode(&delivery.message)?;
            let outgoing = match delivery.message {
                ToGuest::Refused(_) | ToGuest::Closed => Outgoing::FinalFrame(frame),
                ToGuest::Snapshot(_) | ToGuest::Rejected(_) => Outgoing::Frame(frame),
            };
            self.peers.send(delivery.to, outgoing);
        }
        Ok(())
    }

    pub async fn shutdown(self) {
        let _ = self.router.shutdown().await;
    }
}

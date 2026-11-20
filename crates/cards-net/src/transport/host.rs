use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::Duration;

use async_channel::{Receiver, Sender, TrySendError};
use iroh::Endpoint;
use iroh::endpoint::{Connection, RecvStream};
use iroh::protocol::{AcceptError, ProtocolHandler, Router};

use super::frame::{read_frame, write_frame};
use super::{ALPN, NetError, player_id};
use crate::host::Delivery;
use crate::protocol::{FrameError, PlayerId, ToGuest, ToHost, decode, encode};

/// Connections allowed at once: the largest table plus room for refused strangers.
const MAX_PEERS: usize = 16;
/// Time a new connection gets to send a valid `Join`.
const JOIN_TIMEOUT: Duration = Duration::from_secs(10);
/// Undelivered frames per guest before the guest is dropped (it rejoins and resyncs).
const OUTBOX_LIMIT: usize = 32;
/// Guest messages buffered for the session owner before readers wait.
const EVENT_LIMIT: usize = 64;

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

    /// Registers the player's newest link, replacing an older one; None when full.
    fn register(&self, player: PlayerId, link: Sender<Outgoing>) -> Option<u64> {
        let mut table = self.lock();
        if !table.links.contains_key(&player) && table.links.len() >= MAX_PEERS {
            return None;
        }
        table.next_generation += 1;
        let generation = table.next_generation;
        if let Some((_, old)) = table.links.insert(player, (generation, link)) {
            old.close();
        }
        Some(generation)
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
        if let Some((_, link)) = self.lock().links.get(&player)
            && let Err(TrySendError::Full(_)) = link.try_send(outgoing)
        {
            link.close();
        }
    }
}

#[derive(Clone, Debug)]
struct GuestHandler {
    peers: Peers,
    events: Sender<HostEvent>,
}

async fn first_join(recv: &mut RecvStream) -> Result<ToHost, NetError> {
    let read = async { decode::<ToHost>(&read_frame(recv).await?).map_err(NetError::from) };
    let timeout = async {
        n0_future::time::sleep(JOIN_TIMEOUT).await;
        Err(NetError::Closed)
    };
    match n0_future::future::race(read, timeout).await? {
        join @ ToHost::Join { .. } => Ok(join),
        ToHost::Act(_) | ToHost::Leave => Err(NetError::Closed),
    }
}

impl GuestHandler {
    async fn serve(&self, connection: &Connection) -> Result<(), NetError> {
        let player = player_id(connection.remote_id());
        let (mut send, mut recv) = connection
            .accept_bi()
            .await
            .map_err(|e| NetError::Stream(e.to_string()))?;
        let join = first_join(&mut recv).await?;
        let (link, outbox) = async_channel::bounded(OUTBOX_LIMIT);
        let generation = self.peers.register(player, link).ok_or(NetError::Closed)?;
        let reader = async {
            let mut message = join;
            loop {
                let event = HostEvent::Message {
                    from: player,
                    message,
                };
                self.events
                    .send(event)
                    .await
                    .map_err(|_| NetError::Closed)?;
                message = decode::<ToHost>(&read_frame(&mut recv).await?)?;
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
        let (sender, events) = async_channel::bounded(EVENT_LIMIT);
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

use std::sync::{Arc, Mutex};
use std::time::Duration;

use cards_core::{GameKind, Seat};
use cards_net::transport::{
    Directory, GuestLink, HostEvent, HostNet, NetError, join, player_id, rejoin,
};
use cards_net::{GuestState, HostSession, Link, Refusal, RoomCode, Stage, ToGuest};
use iroh::address_lookup::MemoryLookup;
use iroh::endpoint::presets;
use iroh::{Endpoint, EndpointId, RelayMode};

const WAIT: Duration = Duration::from_secs(10);

#[derive(Clone, Default)]
struct MemoryDirectory {
    rooms: Arc<Mutex<Vec<(RoomCode, EndpointId)>>>,
}

impl Directory for MemoryDirectory {
    async fn publish(&self, code: RoomCode, host: EndpointId) -> Result<(), NetError> {
        self.rooms.lock().unwrap().push((code, host));
        Ok(())
    }

    async fn resolve(&self, code: RoomCode) -> Result<EndpointId, NetError> {
        let rooms = self.rooms.lock().unwrap();
        rooms
            .iter()
            .rev()
            .find(|(c, _)| *c == code)
            .map(|(_, host)| *host)
            .ok_or_else(|| NetError::Lookup("no such room".into()))
    }
}

async fn endpoint(lookup: &MemoryLookup) -> Endpoint {
    Endpoint::builder(presets::Minimal)
        .relay_mode(RelayMode::Disabled)
        .transport_config(cards_net::transport::quic_config())
        .address_lookup(lookup.clone())
        .bind()
        .await
        .expect("bind")
}

struct Host {
    net: HostNet,
    session: HostSession,
}

impl Host {
    /// Handles the next network event and sends the session's replies.
    async fn pump(&mut self) -> HostEvent {
        let event = tokio::time::timeout(WAIT, self.net.next_event())
            .await
            .expect("host event in time")
            .expect("host running");
        let out = match event.clone() {
            HostEvent::Message { from, message } => self.session.handle(from, message),
            HostEvent::Disconnected(peer) => self.session.disconnected(peer),
        };
        self.net.deliver(out).expect("encode");
        event
    }
}

async fn next(link: &mut GuestLink, state: &mut GuestState) -> ToGuest {
    let message = tokio::time::timeout(WAIT, link.receiver.recv())
        .await
        .expect("guest message in time")
        .expect("guest message");
    state.receive(message.clone());
    message
}

async fn setup() -> (Host, MemoryDirectory, MemoryLookup, RoomCode) {
    let lookup = MemoryLookup::new();
    let host_endpoint = endpoint(&lookup).await;
    lookup.add_endpoint_info(host_endpoint.addr());
    let directory = MemoryDirectory::default();
    let code = RoomCode::parse("ABC234").unwrap();
    directory.publish(code, host_endpoint.id()).await.unwrap();
    let session = HostSession::new(
        code,
        player_id(host_endpoint.id()),
        "Host",
        GameKind::OhWell,
        3,
    )
    .expect("session");
    let host = Host {
        net: HostNet::start(host_endpoint),
        session,
    };
    (host, directory, lookup, code)
}

#[tokio::test(flavor = "multi_thread")]
async fn a_guest_joins_by_code_plays_and_rejoins_after_a_drop() {
    let (mut host, directory, lookup, code) = setup().await;
    let guest_endpoint = endpoint(&lookup).await;
    let mut state = GuestState::default();

    let mut link = join(&guest_endpoint, &directory, code, "Alice")
        .await
        .expect("join");
    host.pump().await;
    next(&mut link, &mut state).await;
    assert_eq!(state.snapshot().map(|s| s.you), Some(Seat(1)));

    let out = host.session.add_ai().unwrap();
    host.net.deliver(out).unwrap();
    let out = host.session.start(11).unwrap();
    host.net.deliver(out).unwrap();
    next(&mut link, &mut state).await;
    next(&mut link, &mut state).await;
    let Some(Stage::Playing { view, .. }) = state.snapshot().map(|s| &s.stage) else {
        panic!("game should have started");
    };
    assert_eq!(view.hand.len(), view.cards_per_player);

    link.sender.close();
    assert!(matches!(host.pump().await, HostEvent::Disconnected(_)));
    assert!(!host.session.host_snapshot().roster[1].connected);

    let mut link = rejoin(&guest_endpoint, link.host, code, "Alice")
        .await
        .expect("rejoin");
    host.pump().await;
    next(&mut link, &mut state).await;
    let snapshot = state.snapshot().expect("snapshot");
    assert!(snapshot.roster[1].connected);
    assert!(matches!(snapshot.stage, Stage::Playing { .. }));
}

#[tokio::test(flavor = "multi_thread")]
async fn a_wrong_code_is_refused_and_the_connection_ends() {
    let (mut host, directory, lookup, code) = setup().await;
    let guest_endpoint = endpoint(&lookup).await;
    let host_id = directory.resolve(code).await.unwrap();
    let wrong = RoomCode::parse("ZZZ999").unwrap();
    let mut state = GuestState::default();

    let mut link = rejoin(&guest_endpoint, host_id, wrong, "Mallory")
        .await
        .expect("connect");
    host.pump().await;
    assert_eq!(
        next(&mut link, &mut state).await,
        ToGuest::Refused(Refusal::WrongCode)
    );
    assert_eq!(state.link(), Link::Refused(Refusal::WrongCode));
    let after = tokio::time::timeout(WAIT, link.receiver.recv())
        .await
        .expect("ends in time");
    assert!(after.is_err());
    assert_eq!(host.session.host_snapshot().roster.len(), 1);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_connection_that_acts_before_joining_is_dropped() {
    let (host, directory, lookup, code) = setup().await;
    let guest_endpoint = endpoint(&lookup).await;
    let host_id = directory.resolve(code).await.unwrap();
    let connection = guest_endpoint
        .connect(host_id, cards_net::transport::ALPN)
        .await
        .expect("connect");
    let (mut send, mut recv) = connection.open_bi().await.expect("stream");
    let frame = cards_net::encode(&cards_net::ToHost::Act(cards_core::Action::Bid(0))).unwrap();
    send.write_all(&u32::try_from(frame.len()).unwrap().to_be_bytes())
        .await
        .unwrap();
    send.write_all(&frame).await.unwrap();

    let mut byte = [0u8; 1];
    let ended = tokio::time::timeout(WAIT, recv.read_exact(&mut byte))
        .await
        .expect("closed in time");
    assert!(ended.is_err());
    assert_eq!(host.session.host_snapshot().roster.len(), 1);
}

#[tokio::test(flavor = "multi_thread")]
async fn an_unknown_code_fails_lookup() {
    let (_host, directory, lookup, _code) = setup().await;
    let guest_endpoint = endpoint(&lookup).await;
    let missing = RoomCode::parse("QQQ777").unwrap();
    let result = join(&guest_endpoint, &directory, missing, "Alice").await;
    assert!(matches!(result, Err(NetError::Lookup(_))));
}

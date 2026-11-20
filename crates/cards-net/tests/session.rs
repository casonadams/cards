mod common;

use cards_core::{Action, GameKind, Rejection, Rng, Seat};
use cards_net::{GuestState, HostError, Link, Occupant, Refusal, Stage, ToGuest, ToHost};
use common::{HOST, Room, guest_id, is_refused};

fn playing_view(room: &Room, guest: cards_net::PlayerId) -> cards_core::SeatView {
    match &room.snapshot(guest).stage {
        Stage::Playing { view, .. } => (**view).clone(),
        Stage::Lobby => panic!("guest is still in the lobby"),
    }
}

fn started_room() -> Room {
    let mut room = Room::new(GameKind::OhWell, 4);
    room.join(guest_id(1), "Alice");
    room.join(guest_id(2), "Bob");
    let out = room.host.add_ai().expect("ai seat");
    room.deliver(out);
    let out = room.host.start(7).expect("start");
    room.deliver(out);
    room
}

#[test]
fn guests_with_the_right_code_join_and_see_the_roster() {
    let mut room = Room::new(GameKind::CanadianSalad, 3);
    room.join(guest_id(1), "  Alice  ");

    let snapshot = room.snapshot(guest_id(1));
    assert_eq!(snapshot.you, Seat(1));
    assert_eq!(snapshot.stage, Stage::Lobby);
    let names: Vec<_> = snapshot
        .roster
        .iter()
        .map(|s| (s.name.as_str(), s.occupant))
        .collect();
    assert_eq!(
        names,
        [("Host Person", Occupant::Host), ("Alice", Occupant::Guest)]
    );
}

#[test]
fn join_is_refused_for_a_wrong_code_a_full_table_a_started_game_or_a_bad_name() {
    let mut room = Room::new(GameKind::CanadianSalad, 3);
    let stranger = guest_id(9);
    let wrong = cards_net::RoomCode::parse("ZZZ999")
        .unwrap()
        .join_proof(&HOST.0, &stranger.0);
    room.send(
        stranger,
        ToHost::Join {
            name: "Eve".into(),
            proof: wrong,
        },
    );
    assert!(is_refused(&room.guests[&stranger], Refusal::WrongCode));

    room.join(guest_id(3), &"x".repeat(21));
    assert!(is_refused(&room.guests[&guest_id(3)], Refusal::InvalidName));

    room.join(guest_id(1), "Alice");
    room.join(guest_id(2), "Bob");
    room.join(guest_id(4), "Late");
    assert!(is_refused(&room.guests[&guest_id(4)], Refusal::TableFull));

    let out = room.host.start(1).expect("start");
    room.deliver(out);
    let out = room.host.remove(Seat(1));
    assert_eq!(out, Err(HostError::NotInLobby));
    room.join(guest_id(5), "Later");
    assert!(is_refused(
        &room.guests[&guest_id(5)],
        Refusal::GameInProgress
    ));
    assert_eq!(room.snapshot(guest_id(1)).roster.len(), 3);
}

#[test]
fn start_requires_a_full_table() {
    let mut room = Room::new(GameKind::OhWell, 3);
    room.join(guest_id(1), "Alice");
    assert_eq!(room.host.start(1), Err(HostError::TableNotFull));
}

#[test]
fn leaving_the_lobby_frees_the_seat_and_renumbers() {
    let mut room = Room::new(GameKind::OhWell, 4);
    room.join(guest_id(1), "Alice");
    room.join(guest_id(2), "Bob");
    room.send(guest_id(1), ToHost::Leave);

    let snapshot = room.snapshot(guest_id(2));
    assert_eq!(snapshot.you, Seat(1));
    assert_eq!(snapshot.roster.len(), 2);
}

#[test]
fn a_full_game_with_host_guests_and_ai_reaches_the_end_and_every_view_is_private() {
    for (kind, capacity) in [(GameKind::OhWell, 4), (GameKind::CanadianSalad, 4)] {
        let mut room = Room::new(kind, capacity);
        room.join(guest_id(1), "Alice");
        room.join(guest_id(2), "Bob");
        let out = room.host.add_ai().expect("ai seat");
        room.deliver(out);
        let out = room.host.start(99).expect("start");
        room.deliver(out);

        let mut rng = Rng::new(5);
        let mut steps = 0;
        let mut largest = 0;
        while room.step(&mut rng) {
            steps += 1;
            assert!(steps < 10_000, "game did not finish");
            for guest in [guest_id(1), guest_id(2)] {
                let view = playing_view(&room, guest);
                assert_eq!(view.hand.len(), view.hand_sizes[view.seat.index()]);
                let frame = cards_net::encode(&ToGuest::Snapshot(room.snapshot(guest).clone()));
                largest = largest.max(frame.expect("encode").len());
            }
        }
        assert!(largest < 2048, "{kind:?} snapshot grew to {largest} bytes");
        for guest in [guest_id(1), guest_id(2)] {
            assert!(
                playing_view(&room, guest).game_over,
                "{kind:?} ended for {guest:?}"
            );
            assert_eq!(room.guests[&guest].rejection(), None);
        }
    }
}

#[test]
fn an_out_of_turn_action_is_rejected_only_to_that_guest() {
    let mut room = started_room();
    let actor = playing_view(&room, guest_id(1))
        .actor
        .expect("someone acts");
    let idle = if actor == Seat(1) {
        guest_id(2)
    } else {
        guest_id(1)
    };
    let before = room.snapshot(idle).seq;

    room.send(idle, ToHost::Act(Action::Bid(0)));

    assert_eq!(room.guests[&idle].rejection(), Some(Rejection::NotYourTurn));
    assert_eq!(room.snapshot(idle).seq, before);
}

#[test]
fn a_dropped_guest_can_be_covered_by_ai_and_reclaims_the_seat_on_return() {
    let mut room = started_room();
    let alice = guest_id(1);
    assert_eq!(
        room.host.set_autoplay(Seat(1), true),
        Err(HostError::SeatIsHuman)
    );

    let out = room.host.disconnected(alice);
    room.deliver(out);
    assert!(!room.snapshot(guest_id(2)).roster[1].connected);
    let out = room.host.set_autoplay(Seat(1), true).expect("cover seat");
    room.deliver(out);
    assert!(room.snapshot(guest_id(2)).roster[1].autoplay);

    room.join(alice, "ignored on return");
    let roster = &room.snapshot(alice).roster;
    assert_eq!(
        (
            roster[1].connected,
            roster[1].autoplay,
            roster[1].name.as_str()
        ),
        (true, false, "Alice")
    );
    assert_eq!(room.snapshot(alice).you, Seat(1));
}

#[test]
fn a_restarted_host_resumes_the_saved_game_and_guests_rejoin() {
    let mut room = started_room();
    let mut rng = Rng::new(3);
    for _ in 0..5 {
        room.step(&mut rng);
    }
    let saved = serde_json::to_string(&room.host).expect("save");
    let before = playing_view(&room, guest_id(1));

    room.host = serde_json::from_str(&saved).expect("load");
    room.host.resume();
    assert!(
        room.host
            .host_snapshot()
            .roster
            .iter()
            .skip(1)
            .all(|s| !s.connected)
    );

    room.join(guest_id(1), "Alice");
    let after = playing_view(&room, guest_id(1));
    assert_eq!(
        (after.hand, after.round, after.actor),
        (before.hand, before.round, before.actor)
    );
}

#[test]
fn closing_the_table_tells_every_connected_guest() {
    let mut room = started_room();
    let out = room.host.disconnected(guest_id(2));
    room.deliver(out);

    let out = room.host.close();

    assert_eq!(out.len(), 1);
    room.deliver(out);
    assert_eq!(room.guests[&guest_id(1)].link(), Link::Closed);
    assert!(!room.guests[&guest_id(1)].should_reconnect());
}

#[test]
fn guest_state_keeps_the_newest_snapshot_and_pauses_only_mid_game() {
    let room = started_room();
    let alice = guest_id(1);
    let current = room.snapshot(alice).clone();
    let mut state = GuestState::default();
    state.receive(ToGuest::Snapshot(current.clone()));
    let mut stale = current.clone();
    stale.seq -= 1;
    stale.stage = Stage::Lobby;
    state.receive(ToGuest::Snapshot(stale));
    assert_eq!(state.snapshot(), Some(&current));

    assert!(!state.is_paused());
    assert!(state.connection_lost(1.0).is_some());
    assert!(state.is_paused());
    assert_eq!(state.link(), Link::HostAway { attempt: 1 });

    state.receive(ToGuest::Refused(Refusal::WrongCode));
    assert!(!state.should_reconnect());
    assert_eq!(state.connection_lost(1.0), None);
}

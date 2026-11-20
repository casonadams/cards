use std::time::Duration;

use cards_core::{GameKind, Rng, Seat};
use cards_net::protocol::{MAX_FRAME_LEN, PROTOCOL_VERSION};
use cards_net::{
    CodeError, FrameError, Occupant, RoomCode, SeatInfo, Snapshot, Stage, ToGuest, decode, encode,
    reconnect_delay,
};

#[test]
fn codes_normalize_case_spaces_and_dashes() {
    for input in ["abc234", "ABC 234", "abc-234", " Ab C2 34 "] {
        assert_eq!(
            RoomCode::parse(input).map(|c| c.to_string()),
            Ok("ABC234".into())
        );
    }
}

#[test]
fn codes_reject_wrong_lengths_and_ambiguous_characters() {
    assert_eq!(
        RoomCode::parse("ABC23"),
        Err(CodeError::WrongLength { found: 5 })
    );
    assert_eq!(
        RoomCode::parse("ABC2345"),
        Err(CodeError::WrongLength { found: 7 })
    );
    for bad in ['O', '0', 'I', '1', '!'] {
        let input = format!("ABC23{bad}");
        assert_eq!(
            RoomCode::parse(&input),
            Err(CodeError::InvalidCharacter(bad))
        );
    }
}

#[test]
fn generated_codes_parse_back() {
    let mut rng = Rng::new(42);
    for _ in 0..100 {
        let code = RoomCode::generate(&mut rng);
        assert_eq!(RoomCode::parse(&code.to_string()), Ok(code));
    }
}

#[test]
fn codes_serialize_as_text_and_reject_invalid_text() {
    let code = RoomCode::parse("ABC234").unwrap();
    let json = serde_json::to_string(&code).unwrap();
    assert_eq!(json, "\"ABC234\"");
    assert_eq!(serde_json::from_str::<RoomCode>(&json).unwrap(), code);
    assert!(serde_json::from_str::<RoomCode>("\"ABC10O\"").is_err());
}

#[test]
fn join_proofs_depend_on_the_code_and_both_endpoints() {
    let a = RoomCode::parse("ABC234").unwrap();
    let b = RoomCode::parse("ABC235").unwrap();
    let (host, guest, other) = ([1; 32], [2; 32], [3; 32]);
    let proof = a.join_proof(&host, &guest);
    assert_eq!(proof, a.join_proof(&host, &guest));
    assert_ne!(proof, b.join_proof(&host, &guest));
    assert_ne!(proof, a.join_proof(&host, &other));
    assert_ne!(a.lobby_secret(), b.lobby_secret());
}

fn sample_message() -> ToGuest {
    ToGuest::Snapshot(Snapshot {
        seq: 9,
        kind: GameKind::OhWell,
        capacity: 4,
        you: Seat(2),
        roster: vec![SeatInfo {
            seat: Seat(0),
            name: "Host".into(),
            occupant: Occupant::Host,
            connected: true,
            autoplay: false,
        }],
        stage: Stage::Lobby,
    })
}

#[test]
fn frames_round_trip_and_reject_bad_input() {
    let message = sample_message();
    let frame = encode(&message).expect("encode");
    assert_eq!(frame[0], PROTOCOL_VERSION);
    assert_eq!(decode::<ToGuest>(&frame), Ok(message));

    assert_eq!(decode::<ToGuest>(&[]), Err(FrameError::Empty));
    let mut future = frame.clone();
    future[0] = PROTOCOL_VERSION + 1;
    assert_eq!(
        decode::<ToGuest>(&future),
        Err(FrameError::VersionMismatch {
            theirs: PROTOCOL_VERSION + 1
        })
    );
    assert_eq!(
        decode::<ToGuest>(&frame[..frame.len() - 3]),
        Err(FrameError::Malformed)
    );
    let huge = vec![PROTOCOL_VERSION; MAX_FRAME_LEN + 1];
    assert_eq!(
        decode::<ToGuest>(&huge),
        Err(FrameError::TooLarge {
            len: MAX_FRAME_LEN + 1
        })
    );
}

#[test]
fn reconnect_waits_grow_exponentially_up_to_thirty_seconds() {
    let cases = [
        (0, 1.0, Duration::ZERO),
        (1, 1.0, Duration::from_secs(1)),
        (2, 1.0, Duration::from_secs(2)),
        (5, 1.0, Duration::from_secs(16)),
        (6, 1.0, Duration::from_secs(30)),
        (40, 1.0, Duration::from_secs(30)),
        (1, 0.0, Duration::from_millis(750)),
    ];
    for (attempt, jitter, expected) in cases {
        assert_eq!(
            reconnect_delay(attempt, jitter),
            expected,
            "attempt {attempt}"
        );
    }
}

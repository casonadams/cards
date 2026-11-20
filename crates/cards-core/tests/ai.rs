use cards_core::ai::determinize::{OpponentNeed, sample_opponent_hands, track_voids};
use cards_core::canadian_salad::rules::HandType;
use cards_core::{Action, Bid, Card, GameKind, Phase, Play, Rng, Seat, SeatView, Suit, Trick, ai};

fn c(suit: Suit, rank: u8) -> Card {
    Card { suit, rank }
}

fn play(seat: u8, card: Card) -> Play {
    Play {
        seat: Seat(seat),
        card,
    }
}

fn base_view(kind: GameKind, seat: u8, hand: Vec<Card>) -> SeatView {
    let seats = 4;
    SeatView {
        kind,
        seat: Seat(seat),
        seats,
        phase: Phase::Playing,
        round: 0,
        total_rounds: 1,
        round_label: String::new(),
        rules_text: String::new(),
        hand_sizes: vec![hand.len() + 1; seats],
        cards_per_player: hand.len() + 1,
        hand: hand.clone(),
        trump_card: None,
        trump_suit: None,
        hand_type: None,
        dealer: Seat(3),
        first_actor: Seat(0),
        bids: Vec::new(),
        current_trick: Vec::new(),
        tricks: Vec::new(),
        last_trick: None,
        tricks_taken: vec![0; seats],
        round_scores: Vec::new(),
        totals: vec![0; seats],
        actor: Some(Seat(seat)),
        playable_cards: hand,
        legal_bids: Vec::new(),
        round_over: false,
        game_over: false,
    }
}

fn oh_well_view(my_bid: u8, hand: Vec<Card>, led: Card) -> SeatView {
    let mut v = base_view(GameKind::OhWell, 1, hand);
    v.trump_suit = Some(Suit::Clubs);
    v.bids = [1, my_bid, 1, 1]
        .iter()
        .enumerate()
        .map(|(i, a)| Bid {
            seat: Seat(i as u8),
            amount: *a,
        })
        .collect();
    v.current_trick = vec![play(0, led)];
    v.hand_sizes = vec![4, 5, 5, 5];
    v.playable_cards = v
        .hand
        .iter()
        .copied()
        .filter(|x| x.suit == led.suit)
        .collect();
    v
}

fn oh_well_hand() -> Vec<Card> {
    vec![
        c(Suit::Diamonds, 14),
        c(Suit::Diamonds, 4),
        c(Suit::Hearts, 9),
        c(Suit::Spades, 7),
        c(Suit::Clubs, 3),
    ]
}

#[test]
fn oh_well_ducks_under_high_card_when_bid_is_zero() {
    let view = oh_well_view(0, oh_well_hand(), c(Suit::Diamonds, 13));
    let mut rng = Rng::new(12345);
    assert_eq!(
        ai::choose(&view, &mut rng),
        Some(Action::Play(c(Suit::Diamonds, 4)))
    );
}

#[test]
fn ai_has_no_action_when_it_is_not_the_seats_turn() {
    let mut view = oh_well_view(0, oh_well_hand(), c(Suit::Diamonds, 13));
    view.actor = Some(Seat(2));
    assert_eq!(ai::choose(&view, &mut Rng::new(1)), None);
}

#[test]
fn oh_well_follows_suit_when_it_needs_tricks() {
    let view = oh_well_view(2, oh_well_hand(), c(Suit::Diamonds, 13));
    let mut rng = Rng::new(12345);
    let Some(Action::Play(card)) = ai::choose(&view, &mut rng) else {
        panic!()
    };
    assert_eq!(card.suit, Suit::Diamonds);
    assert!([4, 14].contains(&card.rank));
}

#[test]
fn oh_well_bid_is_always_legal_and_avoids_the_hook() {
    let hand = vec![c(Suit::Clubs, 14), c(Suit::Clubs, 13), c(Suit::Hearts, 12)];
    let mut view = base_view(GameKind::OhWell, 3, hand);
    view.phase = Phase::Bidding;
    view.trump_suit = Some(Suit::Clubs);
    view.cards_per_player = 3;
    view.playable_cards = Vec::new();
    view.legal_bids = vec![0, 1, 2];
    let mut rng = Rng::new(1);
    assert_eq!(ai::choose(&view, &mut rng), Some(Action::Bid(2)));
    view.legal_bids = vec![0, 1, 3];
    let Some(Action::Bid(b)) = ai::choose(&view, &mut rng) else {
        panic!()
    };
    assert!(view.legal_bids.contains(&b));
}

fn salad_view(round_hand: HandType, hand: Vec<Card>, led: Card) -> SeatView {
    let mut v = base_view(GameKind::CanadianSalad, 1, hand);
    v.hand_type = Some(round_hand);
    v.current_trick = vec![play(0, led)];
    v.playable_cards = v
        .hand
        .iter()
        .copied()
        .filter(|x| x.suit == led.suit)
        .collect();
    v
}

#[test]
fn salad_follows_led_suit_when_held() {
    let hand = vec![
        c(Suit::Hearts, 4),
        c(Suit::Hearts, 11),
        c(Suit::Clubs, 9),
        c(Suit::Spades, 2),
    ];
    let view = salad_view(HandType::NoTricks, hand, c(Suit::Hearts, 8));
    let mut rng = Rng::new(12345);
    let Some(Action::Play(card)) = ai::choose(&view, &mut rng) else {
        panic!()
    };
    assert_eq!(card.suit, Suit::Hearts);
}

#[test]
fn salad_avoids_taking_king_of_spades() {
    let hand = vec![
        c(Suit::Spades, 13),
        c(Suit::Spades, 4),
        c(Suit::Hearts, 5),
        c(Suit::Clubs, 6),
    ];
    let view = salad_view(HandType::NoKingSpades, hand, c(Suit::Spades, 10));
    let mut rng = Rng::new(12345);
    let Some(Action::Play(card)) = ai::choose(&view, &mut rng) else {
        panic!()
    };
    assert_eq!(card, c(Suit::Spades, 4));
}

#[test]
fn tracks_suit_voids_when_players_do_not_follow() {
    let current = vec![
        play(0, c(Suit::Spades, 10)),
        play(1, c(Suit::Hearts, 2)),
        play(2, c(Suit::Spades, 14)),
        play(3, c(Suit::Spades, 4)),
    ];
    let tricks = vec![Trick {
        plays: current,
        winner: Seat(2),
    }];
    let voids = track_voids(&tricks, &[], 4);
    assert_eq!(voids[1], vec![Suit::Spades]);
    assert!(voids[0].is_empty() && voids[2].is_empty() && voids[3].is_empty());
}

#[test]
fn voids_include_the_trick_in_progress() {
    let current = vec![play(0, c(Suit::Spades, 10)), play(1, c(Suit::Clubs, 2))];
    assert_eq!(track_voids(&[], &current, 4)[1], vec![Suit::Spades]);
}

#[test]
fn sampled_hands_respect_voids() {
    let pool = [
        c(Suit::Hearts, 10),
        c(Suit::Hearts, 2),
        c(Suit::Spades, 5),
        c(Suit::Spades, 8),
    ];
    let opps = [
        OpponentNeed {
            seat: Seat(1),
            needed: 2,
            voids: vec![Suit::Hearts],
        },
        OpponentNeed {
            seat: Seat(2),
            needed: 2,
            voids: vec![],
        },
    ];
    for seed in 0..20 {
        let sampled = sample_opponent_hands(&opps, &pool, &mut Rng::new(seed));
        let (_, p1) = &sampled[0];
        assert_eq!(p1.len(), 2);
        assert!(p1.iter().all(|x| x.suit == Suit::Spades));
        assert_eq!(sampled[1].1.len(), 2);
    }
}

#[test]
fn sampling_falls_back_when_voids_cannot_be_satisfied() {
    let pool = [c(Suit::Hearts, 10), c(Suit::Hearts, 2)];
    let opps = [OpponentNeed {
        seat: Seat(1),
        needed: 2,
        voids: vec![Suit::Hearts],
    }];
    let sampled = sample_opponent_hands(&opps, &pool, &mut Rng::new(1));
    assert_eq!(sampled[0].1.len(), 2);
}

pub mod determinize;

use crate::action::Action;
use crate::canadian_salad;
use crate::card::{Card, Seat, remove_card};
use crate::game::GameKind;
use crate::oh_well;
use crate::rng::Rng;
use crate::table::Phase;
use crate::view::SeatView;
use determinize::{OpponentNeed, sample_opponent_hands, track_voids};

pub const ITERATIONS: usize = 40;

/// Picks an action for the view's seat, or `None` when it is not that seat's turn.
pub fn choose(view: &SeatView, rng: &mut Rng) -> Option<Action> {
    if view.actor != Some(view.seat) {
        return None;
    }
    match view.phase {
        Phase::Bidding => Some(Action::Bid(oh_well::ai::bid(view))),
        Phase::Playing => play(view, rng).map(Action::Play),
        Phase::RoundOver | Phase::GameOver => None,
    }
}

fn play(view: &SeatView, rng: &mut Rng) -> Option<Card> {
    let candidates = &view.playable_cards;
    if candidates.len() <= 1 {
        return candidates.first().copied();
    }
    let pool = unseen_pool(view);
    let voids = track_voids(&view.tricks, &view.current_trick, view.seats);
    let opponents: Vec<OpponentNeed> = (0..view.seats)
        .filter(|&i| i != view.seat.index())
        .map(|i| OpponentNeed {
            seat: Seat::from_index(i),
            needed: view.hand_sizes[i],
            voids: voids[i].clone(),
        })
        .collect();
    let mut scores = vec![0i32; candidates.len()];
    for _ in 0..ITERATIONS {
        let mut hands = vec![Vec::new(); view.seats];
        for (seat, cards) in sample_opponent_hands(&opponents, &pool, rng) {
            hands[seat.index()] = cards;
        }
        hands[view.seat.index()].clone_from(&view.hand);
        for (score, candidate) in scores.iter_mut().zip(candidates) {
            *score += rollout_value(view, &hands, *candidate);
        }
    }
    let mut best = 0;
    for (i, score) in scores.iter().enumerate() {
        if score_better(view.kind, *score, scores[best]) {
            best = i;
        }
    }
    Some(candidates[best])
}

fn score_better(kind: GameKind, a: i32, b: i32) -> bool {
    match kind {
        GameKind::OhWell => a > b,
        GameKind::CanadianSalad => a < b,
    }
}

fn rollout_value(view: &SeatView, hands: &[Vec<Card>], candidate: Card) -> i32 {
    match view.kind {
        GameKind::OhWell => oh_well::ai::rollout(view, hands, candidate),
        GameKind::CanadianSalad => canadian_salad::ai::rollout(view, hands, candidate),
    }
}

fn unseen_pool(view: &SeatView) -> Vec<Card> {
    let removed = canadian_salad::rules::removed_cards(view.seats);
    let mut pool: Vec<Card> = crate::card::full_deck()
        .into_iter()
        .filter(|c| view.kind == GameKind::OhWell || !removed.contains(c))
        .collect();
    let seen = view
        .tricks
        .iter()
        .flat_map(|t| t.plays.iter())
        .chain(view.current_trick.iter())
        .map(|p| p.card)
        .chain(view.hand.iter().copied())
        .chain(view.trump_card);
    for card in seen {
        remove_card(&mut pool, card);
    }
    pool
}

pub(crate) fn extreme<'a>(
    cards: impl IntoIterator<Item = &'a Card>,
    key: impl Fn(Card) -> i32,
    want_max: bool,
) -> Option<Card> {
    let mut best: Option<Card> = None;
    for &card in cards {
        let better = match best {
            None => true,
            Some(b) if want_max => key(card) > key(b),
            Some(b) => key(card) < key(b),
        };
        if better {
            best = Some(card);
        }
    }
    best
}

pub(crate) fn lowest(cards: &[Card]) -> Option<Card> {
    extreme(cards, |c| i32::from(c.rank), false)
}

pub(crate) fn highest(cards: &[Card]) -> Option<Card> {
    extreme(cards, |c| i32::from(c.rank), true)
}

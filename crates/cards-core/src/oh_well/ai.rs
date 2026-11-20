use super::rules::EXACT_BID_BONUS;
use crate::ai::{extreme, highest, lowest};
use crate::card::{Card, Suit, remove_card};
use crate::trick::{self, Play};
use crate::view::SeatView;

fn eval_strength(card: Card, led: Option<Suit>, trump: Option<Suit>) -> i32 {
    if trump == Some(card.suit) {
        100 + i32::from(card.rank)
    } else if led == Some(card.suit) {
        i32::from(card.rank)
    } else {
        -1
    }
}

fn of_suit(hand: &[Card], suit: Suit) -> Vec<Card> {
    hand.iter().copied().filter(|c| c.suit == suit).collect()
}

fn non_trumps(hand: &[Card], trump: Option<Suit>) -> Vec<Card> {
    let rest: Vec<Card> = hand
        .iter()
        .copied()
        .filter(|c| Some(c.suit) != trump)
        .collect();
    if rest.is_empty() { hand.to_vec() } else { rest }
}

struct Ctx {
    trump: Option<Suit>,
    needs_trick: bool,
}

fn lead_play(hand: &[Card], ctx: &Ctx) -> Option<Card> {
    if ctx.needs_trick {
        return extreme(hand, |c| eval_strength(c, Some(c.suit), ctx.trump), true);
    }
    lowest(&non_trumps(hand, ctx.trump))
}

fn follow_play(on_suit: &[Card], led: Suit, winning: i32, ctx: &Ctx) -> Option<Card> {
    let strength = |c: Card| eval_strength(c, Some(led), ctx.trump);
    if ctx.needs_trick {
        let winners: Vec<Card> = on_suit
            .iter()
            .copied()
            .filter(|c| strength(*c) > winning)
            .collect();
        return lowest(if winners.is_empty() {
            on_suit
        } else {
            &winners
        });
    }
    let ducks: Vec<Card> = on_suit
        .iter()
        .copied()
        .filter(|c| strength(*c) < winning)
        .collect();
    highest(if ducks.is_empty() { on_suit } else { &ducks })
}

fn sluff_play(hand: &[Card], led: Suit, winning: i32, ctx: &Ctx) -> Option<Card> {
    if ctx.needs_trick {
        let winning_trumps: Vec<Card> = hand
            .iter()
            .copied()
            .filter(|c| {
                Some(c.suit) == ctx.trump && eval_strength(*c, Some(led), ctx.trump) > winning
            })
            .collect();
        if !winning_trumps.is_empty() {
            return lowest(&winning_trumps);
        }
        return lowest(&non_trumps(hand, ctx.trump));
    }
    highest(&non_trumps(hand, ctx.trump))
}

fn rollout_play(hand: &[Card], led: Option<Suit>, winning: i32, ctx: &Ctx) -> Option<Card> {
    let Some(led) = led else {
        return lead_play(hand, ctx);
    };
    let on_suit = of_suit(hand, led);
    if on_suit.is_empty() {
        sluff_play(hand, led, winning, ctx)
    } else {
        follow_play(&on_suit, led, winning, ctx)
    }
}

struct Rollout<'a> {
    view: &'a SeatView,
    hands: Vec<Vec<Card>>,
    bids: Vec<i32>,
    taken: Vec<i32>,
}

impl Rollout<'_> {
    fn needs_trick(&self, seat: usize) -> bool {
        self.taken[seat] < self.bids[seat]
    }

    fn play_next(&mut self, seat: usize, led: Option<Suit>, winning: i32) -> Option<Card> {
        let ctx = Ctx {
            trump: self.view.trump_suit,
            needs_trick: self.needs_trick(seat),
        };
        let card = rollout_play(&self.hands[seat], led, winning, &ctx)?;
        remove_card(&mut self.hands[seat], card);
        Some(card)
    }

    fn remaining_tricks(&mut self, mut leader: usize, cards_left: usize) {
        let seats = self.view.seats;
        let trump = self.view.trump_suit;
        for _ in 0..cards_left {
            let mut plays: Vec<Play> = Vec::new();
            let (mut led, mut winning) = (None, -1);
            for i in 0..seats {
                let seat = (leader + i) % seats;
                let Some(card) = self.play_next(seat, led, winning) else {
                    return;
                };
                if i == 0 {
                    led = Some(card.suit);
                }
                winning = winning.max(eval_strength(card, led, trump));
                plays.push(Play {
                    seat: crate::card::Seat::from_index(seat),
                    card,
                });
            }
            let Some(won) = trick::winner(&plays, trump) else {
                return;
            };
            leader = won.seat.index();
            self.taken[leader] += 1;
        }
    }
}

/// Utility of playing `candidate`: exact-bid payoff, else -3 per trick of error.
pub fn rollout(view: &SeatView, hands: &[Vec<Card>], candidate: Card) -> i32 {
    let me = view.seat.index();
    let seats = view.seats;
    let trump = view.trump_suit;
    let mut r = Rollout {
        view,
        hands: hands.to_vec(),
        bids: (0..seats)
            .map(|i| i32::from(view.bid_of(crate::card::Seat::from_index(i)).unwrap_or(0)))
            .collect(),
        taken: view.tricks_taken.iter().map(|&t| t as i32).collect(),
    };
    remove_card(&mut r.hands[me], candidate);

    let mut plays = view.current_trick.clone();
    let led = plays.first().map_or(candidate.suit, |p| p.card.suit);
    let mut winning =
        trick::winner(&plays, trump).map_or(-1, |p| eval_strength(p.card, Some(led), trump));
    plays.push(Play {
        seat: view.seat,
        card: candidate,
    });
    winning = winning.max(eval_strength(candidate, Some(led), trump));
    for step in 1..=(seats - plays.len()) {
        let seat = (me + step) % seats;
        let Some(card) = r.play_next(seat, Some(led), winning) else {
            return 0;
        };
        winning = winning.max(eval_strength(card, Some(led), trump));
        plays.push(Play {
            seat: crate::card::Seat::from_index(seat),
            card,
        });
    }
    let Some(won) = trick::winner(&plays, trump) else {
        return 0;
    };
    r.taken[won.seat.index()] += 1;
    let cards_left = r.hands[me].len();
    r.remaining_tricks(won.seat.index(), cards_left);

    let bid = r.bids[me];
    let diff = (r.taken[me] - bid).abs();
    if diff == 0 {
        EXACT_BID_BONUS + bid
    } else {
        -diff * 3
    }
}

/// Strength estimate (trumps + court cards, halved); a hook bid is moved by one as in the TS.
pub fn bid(view: &SeatView) -> u8 {
    let trumps = view
        .hand
        .iter()
        .filter(|c| Some(c.suit) == view.trump_suit)
        .count();
    let high = view.hand.iter().filter(|c| c.rank >= 12).count();
    let raw = u8::try_from((trumps + high).div_ceil(2)).unwrap_or(u8::MAX);
    let max = u8::try_from(view.cards_per_player).unwrap_or(u8::MAX);
    let hooked =
        raw <= max && view.legal_bids.len() <= usize::from(max) && !view.legal_bids.contains(&raw);
    let adjusted = match (hooked, raw) {
        (true, 0) => 1,
        (true, n) => n - 1,
        (false, n) => n,
    };
    let clamped = adjusted.min(max);
    if view.legal_bids.contains(&clamped) {
        clamped
    } else {
        view.legal_bids.first().copied().unwrap_or(0)
    }
}

use crate::card::{Card, Seat, Suit};
use crate::rng::Rng;
use crate::trick::{Play, Trick};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OpponentNeed {
    pub seat: Seat,
    pub needed: usize,
    pub voids: Vec<Suit>,
}

/// Suits each seat has shown void in, including the trick in progress.
pub fn track_voids(tricks: &[Trick], current: &[Play], seats: usize) -> Vec<Vec<Suit>> {
    let mut voids: Vec<Vec<Suit>> = vec![Vec::new(); seats];
    let groups = tricks
        .iter()
        .map(|t| t.plays.as_slice())
        .chain(std::iter::once(current));
    for plays in groups {
        let Some(first) = plays.first() else { continue };
        let led = first.card.suit;
        for play in &plays[1..] {
            let seat_voids = &mut voids[play.seat.index()];
            if play.card.suit != led && !seat_voids.contains(&led) {
                seat_voids.push(led);
            }
        }
    }
    voids
}

/// Deals each opponent `needed` cards from the pool, preferring cards outside their voids.
pub fn sample_opponent_hands(
    opponents: &[OpponentNeed],
    unseen: &[Card],
    rng: &mut Rng,
) -> Vec<(Seat, Vec<Card>)> {
    let mut pool = unseen.to_vec();
    rng.shuffle(&mut pool);
    let mut order: Vec<usize> = (0..opponents.len()).collect();
    order.sort_by_key(|&i| std::cmp::Reverse(opponents[i].voids.len()));
    let mut used = vec![false; pool.len()];
    let mut hands: Vec<Vec<Card>> = vec![Vec::new(); opponents.len()];
    for respect_voids in [true, false] {
        for &i in &order {
            let opp = &opponents[i];
            for (k, card) in pool.iter().enumerate() {
                if hands[i].len() >= opp.needed {
                    break;
                }
                if !used[k] && !(respect_voids && opp.voids.contains(&card.suit)) {
                    used[k] = true;
                    hands[i].push(*card);
                }
            }
        }
    }
    opponents.iter().map(|o| o.seat).zip(hands).collect()
}

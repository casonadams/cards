use std::collections::HashSet;
use std::time::Duration;

use cards_core::{Card, Seat};
use nsh_core::prelude::*;

/// The largest table; one badge ref per seat.
const MAX_SEATS: usize = 7;
/// Snapshots shown before this are the state the table opened in, not new plays.
const ARM_DELAY: Duration = Duration::from_millis(400);
const LAND_MS: f32 = 420.0;
const LAND_PAUSE: Duration = Duration::from_millis(500);
const GATHER_MS: f32 = 700.0;
const HOLD: Duration = Duration::from_millis(250);
const FLY_MS: f32 = 750.0;
/// Scale of a card leaving or entering a seat badge.
const BADGE_SCALE: f32 = 0.25;
const GATHER_EASE: Easing = Easing::Bezier(0.25, 1.0, 0.5, 1.0);

/// Identifies a trick: (round, position within the round).
pub type TrickKey = (usize, usize);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Collect {
    Gather,
    Fly,
    Gone,
}

/// Animation state shared by the seat strip, the hand and the trick area.
#[derive(Clone, Copy)]
pub struct Motion {
    badges: [ElementRef; MAX_SEATS],
    hand: ElementRef,
    launch: Stored<Option<(Card, Point<Points>)>>,
    landed: Stored<HashSet<(usize, Card)>>,
    armed: Stored<bool>,
    collect: Signal<Option<(TrickKey, Collect)>>,
}

/// The animated transform of one card on the felt.
#[derive(Clone, Copy)]
pub struct CardMotion {
    x: AnimatedValue,
    y: AnimatedValue,
    scale: AnimatedValue,
    rotate: AnimatedValue,
    opacity: AnimatedValue,
}

/// Where a card on the felt comes from.
#[derive(Clone, Copy)]
pub enum Origin {
    /// A point inside the hand container, which outlives the played card.
    Hand {
        hand: ElementRef,
        at: Point<Points>,
    },
    Badge(ElementRef),
}

impl Motion {
    /// Call from the table's component body so the refs and values live as long as the table.
    pub fn new() -> Motion {
        let armed = stored(false);
        set_timeout(ARM_DELAY, move || {
            armed.replace(true);
        });
        Motion {
            badges: std::array::from_fn(|_| element_ref()),
            hand: element_ref(),
            launch: stored(None),
            landed: stored(HashSet::new()),
            armed,
            collect: signal(None),
        }
    }

    pub fn badge(&self, seat: Seat) -> Option<ElementRef> {
        self.badges.get(seat.index()).copied()
    }

    /// The hand container; played cards fly from their place in it.
    pub fn hand(&self) -> ElementRef {
        self.hand
    }

    /// Remembers where `card` sat in the hand (its centre, relative to the hand container).
    pub fn launch(&self, card: Card, at: Point<Points>) {
        self.launch.replace(Some((card, at)));
    }

    /// Where a newly played card should fly in from, or None when it should simply appear:
    /// before the table settles, or when this card already landed (a rebuilt slot).
    pub fn origin(&self, round: usize, seat: Seat, card: Card) -> Option<Origin> {
        let first = self.landed.with(|landed| landed.insert((round, card)));
        if !first || !self.armed.get() {
            return None;
        }
        match self.launch.get() {
            Some((launched, at)) if launched == card => Some(Origin::Hand {
                hand: self.hand,
                at,
            }),
            _ => self.badge(seat).map(Origin::Badge),
        }
    }

    pub fn stage(&self, key: TrickKey) -> Option<Collect> {
        self.collect
            .get()
            .and_then(|(k, stage)| (k == key).then_some(stage))
    }

    /// Runs the collection of a won trick: pause, gather, hold, fly to the winner.
    pub async fn collect(&self, key: TrickKey) {
        if self.collect.get_untracked().is_some_and(|(k, _)| k == key) {
            return;
        }
        timer(LAND_PAUSE).await;
        self.collect.set(Some((key, Collect::Gather)));
        timer(Duration::from_secs_f32(GATHER_MS / 1000.0) + HOLD).await;
        self.collect.set(Some((key, Collect::Fly)));
        timer(Duration::from_secs_f32(FLY_MS / 1000.0)).await;
        self.collect.set(Some((key, Collect::Gone)));
    }
}

impl CardMotion {
    pub fn new() -> CardMotion {
        CardMotion {
            x: animated_value(0.0),
            y: animated_value(0.0),
            scale: animated_value(1.0),
            rotate: animated_value(0.0),
            opacity: animated_value(1.0),
        }
    }

    pub fn bind(&self, view: View) -> View {
        view.bind_translate_x(&self.x)
            .bind_translate_y(&self.y)
            .bind_scale(&self.scale)
            .bind_rotate(&self.rotate)
            .bind_opacity(&self.opacity)
    }

    /// Flies the card (carrying `el`) in from `origin` to its slot.
    pub async fn land(self, el: ElementRef, origin: Origin) {
        self.opacity.set(0.0);
        next_frame().await;
        let (Some(to), Some(from)) = (el.measure().await, origin_point(origin).await) else {
            self.opacity.set(1.0);
            return;
        };
        let here = centre(to);
        self.x.set(from.x.0 - here.x.0);
        self.y.set(from.y.0 - here.y.0);
        let start = match origin {
            Origin::Hand { .. } => 0.9,
            Origin::Badge(_) => BADGE_SCALE,
        };
        self.scale.set(start);
        self.opacity.set(1.0);
        let _ = self.x.timing(0.0, LAND_MS, Easing::EaseOut);
        let _ = self.y.timing(0.0, LAND_MS, Easing::EaseOut);
        let _ = self.scale.timing(1.0, LAND_MS, Easing::EaseOut);
    }

    pub fn gather(self, dx: f32, degrees: f32) {
        let _ = self.x.timing(dx, GATHER_MS, GATHER_EASE);
        let _ = self.y.timing(0.0, GATHER_MS, GATHER_EASE);
        let _ = self.rotate.timing(degrees, GATHER_MS, GATHER_EASE);
    }

    /// Flies the gathered card into the winner's badge, shrinking and fading.
    pub async fn fly(self, el: ElementRef, winner: ElementRef) {
        let (Some(card), Some(badge)) = (el.measure().await, winner.measure().await) else {
            self.hide();
            return;
        };
        let (from, to) = (centre(card), centre(badge));
        let _ = self.x.timing(to.x.0 - from.x.0, FLY_MS, Easing::EaseIn);
        let _ = self.y.timing(to.y.0 - from.y.0, FLY_MS, Easing::EaseIn);
        let _ = self.scale.timing(BADGE_SCALE, FLY_MS, Easing::EaseIn);
        let _ = self.opacity.timing(0.0, FLY_MS, Easing::EaseIn);
    }

    pub fn hide(self) {
        self.opacity.set(0.0);
    }
}

async fn origin_point(origin: Origin) -> Option<Point<Points>> {
    match origin {
        Origin::Hand { hand, at } => hand
            .measure()
            .await
            .map(|m| point(px(m.page.x.0 + at.x.0), px(m.page.y.0 + at.y.0))),
        Origin::Badge(badge) => badge.measure().await.map(centre),
    }
}

/// The centre of a measured element in page coordinates.
fn centre(m: Measurement) -> Point<Points> {
    point(
        px(m.page.x.0 + m.frame.size.width.0 / 2.0),
        px(m.page.y.0 + m.frame.size.height.0 / 2.0),
    )
}

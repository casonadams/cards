use cards_core::{Phase, Play, Seat};
use nsh_core::prelude::*;

use super::super::style::{accent, accent_ink, felt_dark, ink, muted, panel, panel_border};
use super::super::text::first_name;
use super::motion::{CardMotion, Collect, TrickKey};
use super::{Ctx, card, model};

const PILL_H: f32 = 22.0;
const STATUS_H: f32 = 34.0;
const ROW_PADDING: f32 = 16.0;

/// A card on the felt and where it sits in its trick.
#[derive(Clone, Copy, PartialEq)]
struct Placed {
    key: TrickKey,
    play: Play,
    order: usize,
}

type ShownTrick = Option<(usize, model::Shown)>;

pub fn area(ctx: Ctx) -> impl IntoElement {
    let compact = computed(super::compact);
    let size = computed(move || card::trick_size(compact.get()));
    let seats = computed(move || ctx.read(|_, v| v.seats).unwrap_or_default());
    let width = signal(untracked(|| window().width.0));
    let row =
        computed(move || model::trick_row(width.get() - ROW_PADDING, size.get().w, seats.get()));
    let shown = computed(move || {
        ctx.read(|_, v| model::displayed_trick(&v.current_trick, &v.tricks).map(|s| (v.round, s)))
            .flatten()
    });
    let finished = computed(move || {
        ctx.read(|_, v| {
            let won = v.phase == Phase::Playing && v.current_trick.is_empty();
            v.tricks
                .len()
                .checked_sub(1)
                .filter(|_| won)
                .map(|i| (v.round, i))
        })
        .flatten()
    });
    effect(move || {
        if let Some(key) = finished.get() {
            spawn(async move { ctx.motion.collect(key).await });
        }
    });
    view()
        .relative()
        .w_full()
        .max_w(px(720.0))
        .rounded_xl()
        .bg(felt_dark)
        .items_center()
        .justify_center()
        .pt(px(STATUS_H))
        .h(move || px(STATUS_H + size.get().h + PILL_H + 12.0))
        .flex_shrink_0()
        .on_layout(move |b: &Bounds<Points>| width.set(b.size.width.0))
        .child(status_row(ctx, shown))
        .child(dynamic(move || {
            let size = size.get();
            view()
                .relative()
                .w(move || px(row.get().width))
                .h(px(size.h + PILL_H))
                .children((0..seats.get()).map(|slot| slot_view(ctx, slot, size, row, shown)))
        }))
}

fn status_row(ctx: Ctx, shown: Memo<ShownTrick>) -> impl IntoElement {
    let status = computed(move || {
        let winner = shown.with(|s| s.as_ref().and_then(|(_, t)| t.winner));
        let actor = |v: &cards_core::SeatView| if ctx.away() { None } else { v.actor };
        ctx.read(|snap, v| model::status(snap.you, actor(v), v.phase == Phase::Bidding, winner))
            .flatten()
    });
    view()
        .absolute()
        .top(px(6.0))
        .left(px(0.0))
        .right(px(0.0))
        .h(px(STATUS_H - 8.0))
        .z_index(40)
        .items_center()
        .justify_center()
        .child(dynamic(move || status.get().map(|s| status_pill(ctx, s))))
}

fn status_pill(ctx: Ctx, status: model::Status) -> View {
    let name = |seat: Seat| first_name(&ctx.name(seat)).to_owned();
    let (label, urgent) = match status {
        model::Status::YourBid => ("YOUR TURN - BID".to_owned(), true),
        model::Status::YourPlay => ("YOUR TURN - PLAY A CARD".to_owned(), true),
        model::Status::YouWonYourLead => ("YOU WON THE TRICK - YOUR LEAD".to_owned(), true),
        model::Status::Won(seat) => (format!("{} won the trick!", name(seat)), false),
        model::Status::Waiting {
            seat,
            bidding: true,
        } => (format!("{} is bidding...", name(seat)), false),
        model::Status::Waiting {
            seat,
            bidding: false,
        } => (format!("Waiting for {}...", name(seat)), false),
    };
    let quiet = matches!(status, model::Status::Waiting { .. });
    let pill = view()
        .px_3()
        .py_1()
        .rounded_full()
        .border_2()
        .bg(panel)
        .border_color(move || {
            if urgent {
                accent()
            } else if quiet {
                felt_dark()
            } else {
                panel_border()
            }
        })
        .child(
            text(label)
                .text_xs()
                .font_weight(FontWeight::BOLD)
                .text_color(move || {
                    if urgent {
                        accent()
                    } else if quiet {
                        muted()
                    } else {
                        ink()
                    }
                }),
        );
    if urgent { pill.animate_pulse() } else { pill }
}

fn slot_view(
    ctx: Ctx,
    slot: usize,
    size: card::Size,
    row: Memo<model::Row>,
    shown: Memo<ShownTrick>,
) -> impl IntoElement {
    let placed = computed(move || {
        shown.with(|s| {
            let (round, trick) = s.as_ref()?;
            let order = trick.plays.iter().position(|p| p.seat.index() == slot)?;
            let key = (*round, trick.index);
            (ctx.motion.stage(key) != Some(Collect::Gone)).then_some(Placed {
                key,
                play: trick.plays[order],
                order,
            })
        })
    });
    view()
        .absolute()
        .left(move || px(row.get().step * slot as f32))
        .top(px(0.0))
        .w(px(size.w))
        .z_index(move || {
            placed
                .get()
                .map_or(0, |p| 10 + i32::try_from(p.order).unwrap_or(0))
        })
        .child(dynamic(move || match placed.get() {
            Some(p) => untracked(|| landed(ctx, p, slot, size, row, shown)).into_element(),
            None => placeholder(size).into_element(),
        }))
}

fn placeholder(size: card::Size) -> impl IntoElement {
    view()
        .w(px(size.w))
        .h(px(size.h))
        .rounded_md()
        .border_2()
        .border_dashed()
        .border_color(panel_border)
}

fn landed(
    ctx: Ctx,
    placed: Placed,
    slot: usize,
    size: card::Size,
    row: Memo<model::Row>,
    shown: Memo<ShownTrick>,
) -> impl IntoElement {
    let Placed { key, play, order } = placed;
    let motion = CardMotion::new();
    let el = element_ref();
    if let Some(origin) = ctx.motion.origin(key.0, play.seat, play.card) {
        spawn(motion.land(el, origin));
    }
    effect(move || match ctx.motion.stage(key) {
        Some(Collect::Gather) => untracked(|| {
            let count = shown.with(|s| s.as_ref().map_or(1, |(_, t)| t.plays.len()));
            let dx = model::gather_offset(row.get(), slot, size.w);
            motion.gather(dx, model::gather_rotation(order, count));
        }),
        Some(Collect::Fly) => {
            let winner = untracked(|| shown.with(|s| s.as_ref().and_then(|(_, t)| t.winner)));
            match winner.and_then(|w| ctx.motion.badge(w)) {
                Some(badge) => {
                    spawn(motion.fly(el, badge));
                }
                None => motion.hide(),
            }
        }
        Some(Collect::Gone) => motion.hide(),
        None => {}
    });
    let badge = untracked(|| {
        ctx.read(|_, v| model::card_badge(v.hand_type, v.trump_suit, play.card))
            .flatten()
    });
    view()
        .items_center()
        .gap_1()
        .child(
            motion
                .bind(card::face(play.card, size, card::Tone::Inspect, badge))
                .element_ref(&el),
        )
        .child(
            name_pill(ctx, play.seat, size.w)
                .style_when(move || ctx.motion.stage(key).is_some(), |s| s.opacity(0.0))
                .transition_opacity()
                .duration(250.0),
        )
}

fn name_pill(ctx: Ctx, seat: Seat, width: f32) -> View {
    view()
        .max_w(px(width))
        .h(px(PILL_H - 4.0))
        .px_2()
        .rounded_full()
        .bg(accent)
        .justify_center()
        .child(
            text(first_name(&ctx.name(seat)).to_owned())
                .text_xs()
                .truncate()
                .font_weight(FontWeight::BOLD)
                .text_color(accent_ink),
        )
}

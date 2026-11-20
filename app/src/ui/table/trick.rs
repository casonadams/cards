use std::time::Duration;

use cards_core::{Play, Seat};
use nsh_core::prelude::*;

use super::super::style::{accent, accent_ink, felt_dark, ink, panel, panel_border};
use super::super::text::first_name;
use super::{Ctx, card, model, seats};

const PILL_H: f32 = 22.0;
const CALLOUT_H: f32 = 30.0;

pub fn area(ctx: Ctx) -> impl IntoElement {
    let compact = computed(seats::compact);
    let seat_count = computed(move || ctx.read(|_, v| v.seats).unwrap_or(0));
    let size = move || card::trick_size(compact.get());
    view()
        .relative()
        .w_full()
        .max_w(px(720.0))
        .rounded_xl()
        .bg(felt_dark)
        .items_center()
        .justify_center()
        .h(move || px(size().h + PILL_H + CALLOUT_H + 16.0))
        .flex_shrink_0()
        .child(turn_pill(ctx))
        .child(dynamic(move || {
            let size = size();
            let seats = seat_count.get();
            let width = window().width.0 - 16.0;
            let step = if seats > 1 {
                (size.w + 8.0).min(((width - size.w) / (seats - 1) as f32).max(8.0))
            } else {
                0.0
            };
            let total = step * seats.saturating_sub(1) as f32 + size.w;
            view()
                .flex_col()
                .items_center()
                .gap_1()
                .child(callout(ctx))
                .child(
                    view()
                        .relative()
                        .w(px(total))
                        .h(px(size.h + PILL_H))
                        .children((0..seats).map(|slot| slot_view(ctx, slot, step, size))),
                )
        }))
}

fn turn_pill(ctx: Ctx) -> impl IntoElement {
    let label = move || {
        if !ctx.my_turn() {
            return None;
        }
        ctx.read(|_, v| {
            if v.phase == cards_core::Phase::Bidding {
                "YOUR TURN - BID"
            } else {
                "YOUR TURN - PLAY A CARD"
            }
        })
    };
    dynamic(move || {
        label().map(|l| {
            view()
                .absolute()
                .top(px(-14.0))
                .left(px(0.0))
                .right(px(0.0))
                .z_index(40)
                .items_center()
                .child(
                    view()
                        .px_3()
                        .py_1()
                        .rounded_full()
                        .border_2()
                        .border_color(accent)
                        .bg(panel)
                        .animate_pulse()
                        .child(
                            text(l)
                                .text_xs()
                                .font_weight(FontWeight::BOLD)
                                .text_color(accent),
                        ),
                )
        })
    })
}

fn shown(ctx: Ctx) -> Option<model::Shown> {
    ctx.read(|_, v| model::displayed_trick(&v.current_trick, v.last_trick.as_ref()))
        .flatten()
}

fn callout(ctx: Ctx) -> impl IntoElement {
    let message = move || {
        let winner = shown(ctx)?.winner?;
        let me = ctx.read(|snap, _| snap.you)?;
        Some(if winner == me {
            "You won the trick!".to_owned()
        } else {
            format!("{} won the trick!", first_name(&ctx.name(winner)))
        })
    };
    view()
        .h(px(CALLOUT_H))
        .justify_center()
        .child(dynamic(move || {
            message().map(|m| {
                text(m)
                    .text_sm()
                    .font_weight(FontWeight::BOLD)
                    .text_color(ink)
            })
        }))
}

fn play_in_slot(ctx: Ctx, slot: usize) -> Option<Play> {
    let shown = shown(ctx)?;
    let lead = shown.plays.first()?.seat;
    let seats = ctx.read(|_, v| v.seats)?;
    shown
        .plays
        .into_iter()
        .find(|p| model::slot_of(p.seat, lead, seats) == slot)
}

fn slot_view(ctx: Ctx, slot: usize, step: f32, size: card::Size) -> impl IntoElement {
    let play = computed(move || play_in_slot(ctx, slot));
    view()
        .absolute()
        .left(px(step * slot as f32))
        .top(px(0.0))
        .w(px(size.w))
        .child(dynamic(move || match play.get() {
            Some(p) => untracked(|| landed(ctx, p, slot, size)).into_element(),
            None => placeholder(size).into_element(),
        }))
}

fn placeholder(size: card::Size) -> impl IntoElement {
    view()
        .z_index(0)
        .w(px(size.w))
        .h(px(size.h))
        .rounded_md()
        .border_2()
        .border_dashed()
        .border_color(panel_border)
}

fn landed(ctx: Ctx, play: Play, slot: usize, size: card::Size) -> impl IntoElement {
    let entered = signal(false);
    set_timeout(Duration::from_millis(16), move || entered.set(true));
    let badge = ctx
        .read(|_, v| model::card_badge(v.hand_type, v.trump_suit, play.card))
        .flatten();
    view()
        .z_index(10 + slot as i32)
        .items_center()
        .gap_1()
        .opacity(move || if entered.get() { 1.0_f32 } else { 0.0_f32 })
        .translate_y(move || px(if entered.get() { 0.0 } else { 24.0 }))
        .transition_transform()
        .transition_opacity()
        .duration(220.0)
        .ease_out()
        .child(card::face(play.card, size, card::Tone::Inspect, badge))
        .child(name_pill(ctx, play.seat, size.w))
}

fn name_pill(ctx: Ctx, seat: Seat, width: f32) -> impl IntoElement {
    view()
        .max_w(px(width))
        .h(px(PILL_H - 4.0))
        .px_2()
        .rounded_full()
        .bg(accent)
        .child(
            text(first_name(&ctx.name(seat)).to_owned())
                .text_xs()
                .truncate()
                .font_weight(FontWeight::BOLD)
                .text_color(accent_ink),
        )
}

use cards_core::Seat;
use cards_net::{Occupant, SeatInfo};
use nsh_core::prelude::*;

use super::super::style::{accent, accent_ink, danger, ink, muted, panel, panel_border};
use super::super::text::{first_name, initials};
use super::{Ctx, model};
use crate::session::Command;

pub fn lead(ctx: Ctx) -> Seat {
    ctx.read(|_, v| model::leader(v.first_actor, v.tricks.last().map(|t| t.winner)))
        .unwrap_or(Seat(0))
}

/// Short or narrow windows (phones in either orientation) use small cards and compact stats.
pub fn compact() -> bool {
    let size = window();
    size.width.0 < 520.0 || size.height.0 < 520.0
}

pub fn strip(ctx: Ctx) -> impl IntoElement {
    let seats = move || ctx.read(|snap, _| snap.roster.clone()).unwrap_or_default();
    view()
        .flex_row()
        .flex_wrap()
        .justify_center()
        .gap_2()
        .child(each(
            seats,
            |s: &SeatInfo| s.seat,
            move |info, _| badge(ctx, info),
        ))
}

fn badge(ctx: Ctx, info: ReadSignal<SeatInfo>) -> impl IntoElement {
    let seat = info.with(|s| s.seat);
    let active = move || ctx.read(|_, v| v.actor == Some(seat)).unwrap_or(false);
    let number = move || {
        ctx.read(|_, v| model::order_number(seat, lead(ctx), v.seats))
            .unwrap_or(1)
    };
    let stats = move || {
        ctx.read(|_, v| {
            model::stat_line(
                v.kind,
                v.bid_of(seat),
                v.tricks_taken.get(seat.index()).copied().unwrap_or(0),
                v.totals.get(seat.index()).copied().unwrap_or(0),
            )
        })
        .unwrap_or_default()
    };
    let away = move || info.with(|s| !s.connected);
    view()
        .flex_row()
        .items_center()
        .gap_2()
        .px_2()
        .py_1()
        .rounded_xl()
        .border_2()
        .bg(panel)
        .border_color(move || if active() { accent() } else { panel_border() })
        .style_when(away, |s| s.opacity(0.5))
        .transition_colors()
        .duration(150.0)
        .child(avatar(info, active, number))
        .child(
            view()
                .child(
                    text(move || info.with(|s| first_name(&s.name).to_owned()))
                        .text_sm()
                        .font_weight(FontWeight::BOLD)
                        .text_color(ink)
                        .truncate(),
                )
                .child(
                    text(stats)
                        .text_xs()
                        .font_family("monospace")
                        .tabular_nums()
                        .text_color(muted),
                )
                .child(tags(ctx, info)),
        )
}

fn avatar(
    info: ReadSignal<SeatInfo>,
    active: impl Fn() -> bool + Copy + 'static,
    number: impl Fn() -> usize + Copy + 'static,
) -> impl IntoElement {
    view()
        .relative()
        .size_8()
        .child(
            view()
                .size_8()
                .rounded_full()
                .border_1()
                .border_color(accent)
                .items_center()
                .justify_center()
                .child(
                    text(move || info.with(|s| initials(&s.name)))
                        .text_xs()
                        .font_weight(FontWeight::BOLD)
                        .text_color(ink),
                ),
        )
        .child(
            view()
                .absolute()
                .top(px(-6.0))
                .right(px(-6.0))
                .size_4()
                .rounded_full()
                .items_center()
                .justify_center()
                .bg(move || if active() { accent() } else { panel_border() })
                .child(
                    text(move || number().to_string())
                        .text_size(px(10.0))
                        .font_weight(FontWeight::BOLD)
                        .text_color(move || if active() { accent_ink() } else { ink() }),
                ),
        )
}

fn tags(ctx: Ctx, info: ReadSignal<SeatInfo>) -> impl IntoElement {
    let host = ctx.is_host();
    let seat = info.with(|s| s.seat);
    let label = move || {
        info.with(|s| match (s.occupant, s.connected, s.autoplay) {
            (Occupant::Ai, _, _) | (_, _, true) => "AI",
            (_, false, false) => "away",
            _ => "",
        })
    };
    let control = move || {
        info.with(|s| (host && s.occupant == Occupant::Guest && !s.connected).then_some(s.autoplay))
    };
    view()
        .flex_row()
        .items_center()
        .gap_1()
        .child(
            text(label)
                .text_size(px(10.0))
                .font_weight(FontWeight::BOLD)
                .text_color(danger),
        )
        .child(dynamic(move || {
            control().map(|on| {
                text(if on { "Take back" } else { "Let AI play" })
                    .text_size(px(10.0))
                    .text_color(accent)
                    .role(AccessibilityRole::Button)
                    .on_press(move || ctx.controller.command(Command::Autoplay(seat, !on)))
            })
        }))
}

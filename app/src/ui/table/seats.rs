use cards_net::{Occupant, SeatInfo};
use nsh_core::prelude::*;

use super::super::style::{accent, accent_ink, danger, ink, muted, panel, panel_border, warn};
use super::super::text::{first_name, initials};
use super::layout::ChipStyle;
use super::progress::{self, Tone};
use super::{Ctx, model};
use crate::session::Command;

pub fn strip(ctx: Ctx) -> impl IntoElement {
    let seats = move || ctx.read(|snap, _| snap.roster.clone()).unwrap_or_default();
    view()
        .w_full()
        .flex_row()
        .px_2()
        .gap(px(6.0))
        .h(move || px(ctx.layout.get().chip_h))
        .flex_shrink_0()
        .child(each(
            seats,
            |s: &SeatInfo| s.seat,
            move |info, _| badge(ctx, info),
        ))
}

fn tone_color(tone: Tone) -> AdaptiveColor {
    match tone {
        Tone::Neutral => ink(),
        Tone::Good => accent(),
        Tone::Warn => warn(),
        Tone::Bad => danger(),
    }
}

fn badge(ctx: Ctx, info: ReadSignal<SeatInfo>) -> impl IntoElement {
    let seat = info.with(|s| s.seat);
    let active = move || ctx.read(|_, v| v.actor == Some(seat)).unwrap_or(false);
    let number = move || {
        ctx.read(|_, v| {
            let leader = model::leader(v.first_actor, v.tricks.last().map(|t| t.winner));
            model::order_number(seat, leader, v.seats).to_string()
        })
        .unwrap_or_default()
    };
    let stats = computed(move || ctx.read(|_, v| progress::seat_stats(v, seat)));
    let headline =
        move || stats.with(|s| s.as_ref().map(|s| s.headline.clone()).unwrap_or_default());
    let tone = move || stats.with(|s| s.as_ref().map_or(Tone::Neutral, |s| s.tone));
    let total = move || stats.with(|s| s.as_ref().map(|s| s.total.clone()).unwrap_or_default());
    let away = move || info.with(|s| !s.connected);
    let details = view()
        .min_w(px(0.0))
        .items_center()
        .child(
            text(move || info.with(|s| first_name(&s.name).to_owned()))
                .text_xs()
                .font_weight(FontWeight::BOLD)
                .text_color(ink)
                .truncate(),
        )
        .child(
            view()
                .flex_row()
                .gap_1()
                .items_center()
                .child(
                    text(headline)
                        .text_xs()
                        .font_weight(FontWeight::BOLD)
                        .font_family("monospace")
                        .tabular_nums()
                        .text_color(move || tone_color(tone())),
                )
                .child(
                    text(total)
                        .text_size(px(10.0))
                        .font_family("monospace")
                        .tabular_nums()
                        .text_color(muted),
                ),
        )
        .child(tags(ctx, info));
    let row = ctx.layout.get_untracked().chips == ChipStyle::Row;
    view()
        .flex_1()
        .min_w(px(0.0))
        .h_full()
        .items_center()
        .justify_center()
        .gap(px(if row { 8.0 } else { 2.0 }))
        .px_1()
        .rounded_xl()
        .border_2()
        .bg(panel)
        .when(row, |v| v.flex_row())
        .border_color(move || if active() { accent() } else { panel_border() })
        .style_when(away, |s| s.opacity(0.5))
        .transition_colors()
        .duration(150.0)
        .child(avatar(info, active, number, ctx.motion.badge(seat)))
        .child(details)
}

fn avatar(
    info: ReadSignal<SeatInfo>,
    active: impl Fn() -> bool + Copy + 'static,
    number: impl Fn() -> String + Copy + 'static,
    target: Option<ElementRef>,
) -> impl IntoElement {
    view()
        .relative()
        .size_8()
        .when_some(target, |v, r| v.element_ref(&r))
        .child(when(active, || {
            view()
                .absolute()
                .inset_0()
                .rounded_full()
                .bg(accent)
                .animate_ping()
        }))
        .child(
            view()
                .size_8()
                .rounded_full()
                .border_1()
                .bg(panel)
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
                .style_when(active, |s| s.animate_pulse())
                .child(
                    text(number)
                        .text_size(px(10.0))
                        .font_weight(FontWeight::BOLD)
                        .text_color(move || if active() { accent_ink() } else { ink() }),
                ),
        )
}

fn tags(ctx: Ctx, info: ReadSignal<SeatInfo>) -> impl IntoElement {
    let seat = info.with(|s| s.seat);
    let label = move || {
        let role = ctx.read(|_, v| progress::seat_role(v, seat)).flatten();
        info.with(|s| match (s.occupant, s.connected, s.autoplay, role) {
            (_, false, false, _) => "away",
            (_, _, _, Some(role)) => role,
            (Occupant::Ai, _, _, None) | (_, _, true, None) => "AI",
            _ => "",
        })
    };
    let control = move || {
        info.with(|s| {
            (ctx.is_host() && s.occupant == Occupant::Guest && !s.connected).then_some(s.autoplay)
        })
    };
    view()
        .flex_row()
        .items_center()
        .gap_1()
        .h(px(14.0))
        .child(
            text(label)
                .text_size(px(10.0))
                .font_weight(FontWeight::BOLD)
                .text_color(move || match label() {
                    "away" => danger(),
                    "AI" => muted(),
                    _ => accent(),
                }),
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

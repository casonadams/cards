use cards_core::Seat;
use nsh_core::prelude::*;

use super::super::style::{button, ink, muted, panel, panel_border};
use super::super::text::first_name;
use super::{Ctx, model};
use crate::session::Command;

/// The hand's results, shown where the hand was once every card is played.
pub fn round_panel(ctx: Ctx, standings_open: Signal<bool>) -> View {
    let title = move || {
        ctx.read(|_, v| {
            let t = model::round_title(v.kind, v.round, v.total_rounds, &v.round_label);
            format!("{t} complete")
        })
        .unwrap_or_default()
    };
    let game_over = move || ctx.read(|_, v| v.game_over).unwrap_or(false);
    let seats = move || {
        ctx.read(|_, v| (0..v.seats).map(Seat::from_index).collect::<Vec<_>>())
            .unwrap_or_default()
    };
    view()
        .mx_2()
        .px_3()
        .py_2()
        .gap_1()
        .rounded_xl()
        .bg(panel)
        .border_1()
        .border_color(panel_border)
        .child(
            view()
                .flex_row()
                .items_center()
                .gap_2()
                .child(
                    text(title)
                        .flex_1()
                        .min_w(px(0.0))
                        .text_sm()
                        .font_weight(FontWeight::BOLD)
                        .text_color(ink)
                        .truncate(),
                )
                .child(next_action(ctx, game_over, standings_open)),
        )
        .child(
            scroll()
                .flex_1()
                .child(view().flex_row().flex_wrap().gap_x_4().child(each(
                    seats,
                    |s: &Seat| *s,
                    move |seat, _| score_row(ctx, seat),
                ))),
        )
}

fn next_action(
    ctx: Ctx,
    game_over: impl Fn() -> bool + Copy + 'static,
    standings_open: Signal<bool>,
) -> impl IntoElement {
    when(game_over, move || {
        button(
            "Final standings ->",
            true,
            || true,
            move || standings_open.set(true),
        )
    })
    .otherwise(move || {
        when(
            move || ctx.is_host(),
            move || {
                button(
                    "Next hand ->",
                    true,
                    move || !ctx.away(),
                    move || {
                        ctx.controller.command(Command::NextRound);
                    },
                )
            },
        )
        .otherwise(|| text("Waiting for the host...").text_xs().text_color(muted))
    })
}

fn score_row(ctx: Ctx, seat: ReadSignal<Seat>) -> impl IntoElement {
    let seat = seat.get_untracked();
    let round = move || {
        ctx.read(|_, v| {
            v.round_scores
                .last()
                .and_then(|r| r.get(seat.index()))
                .copied()
                .unwrap_or(0)
        })
        .unwrap_or(0)
    };
    let total = move || {
        ctx.read(|_, v| v.totals.get(seat.index()).copied().unwrap_or(0))
            .unwrap_or(0)
    };
    view()
        .w(px(150.0))
        .flex_row()
        .gap_2()
        .child(
            text(move || first_name(&ctx.name(seat)).to_owned())
                .flex_1()
                .min_w(px(0.0))
                .text_sm()
                .font_weight(FontWeight::BOLD)
                .text_color(ink)
                .truncate(),
        )
        .child(
            text(move || format!("{:+} = {}", round(), total()))
                .text_sm()
                .font_family("monospace")
                .tabular_nums()
                .text_color(muted),
        )
}

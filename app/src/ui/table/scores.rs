use cards_core::Seat;
use nsh_core::prelude::*;

use super::super::style::{button, ink, muted, panel, panel_border};
use super::super::text::first_name;
use super::{Ctx, model};
use crate::session::Command;

pub fn round_panel(ctx: Ctx, standings_open: Signal<bool>) -> impl IntoElement {
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
        .w_full()
        .max_w(px(720.0))
        .gap_2()
        .p_3()
        .rounded_xl()
        .bg(panel)
        .border_1()
        .border_color(panel_border)
        .child(text(title).font_weight(FontWeight::BOLD).text_color(ink))
        .child(each(
            seats,
            |s: &Seat| *s,
            move |seat, _| score_row(ctx, seat),
        ))
        .child(
            when(game_over, move || {
                button(
                    "View final standings ->",
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
                .otherwise(|| text("Waiting for the host...").text_sm().text_color(muted))
            }),
        )
}

fn score_row(ctx: Ctx, seat: ReadSignal<Seat>) -> impl IntoElement {
    let seat = seat.get_untracked();
    let line = move || {
        ctx.read(|_, v| {
            let round = v
                .round_scores
                .last()
                .and_then(|r| r.get(seat.index()))
                .copied()
                .unwrap_or(0);
            let total = v.totals.get(seat.index()).copied().unwrap_or(0);
            format!("{round:+} pts | total {total}")
        })
        .unwrap_or_default()
    };
    view()
        .flex_row()
        .justify_between()
        .child(
            text(move || first_name(&ctx.name(seat)).to_owned())
                .font_weight(FontWeight::BOLD)
                .text_color(ink),
        )
        .child(
            text(line)
                .font_family("monospace")
                .tabular_nums()
                .text_color(muted),
        )
}

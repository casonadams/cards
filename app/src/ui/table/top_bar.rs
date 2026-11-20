use nsh_core::prelude::*;

use super::super::style::{button, ink, muted, panel, panel_border};
use super::{Ctx, card, model};
use crate::session::Intent;

pub fn bar(ctx: Ctx) -> impl IntoElement {
    let rules_open = signal(false);
    let title = move || {
        ctx.read(|_, v| model::round_title(v.kind, v.round, v.total_rounds, &v.round_label))
            .unwrap_or_default()
    };
    let game = move || ctx.read(|_, v| v.kind.name()).unwrap_or_default();
    let trump = move || ctx.read(|_, v| v.trump_card).flatten();
    let penalty = move || {
        ctx.read(|_, v| v.hand_type.map(model::penalty_summary))
            .flatten()
    };
    let rules = move || ctx.read(|_, v| v.rules_text.clone()).unwrap_or_default();
    view()
        .w_full()
        .bg(panel)
        .border_color(panel_border)
        .border_1()
        .px_3()
        .py_2()
        .gap_2()
        .child(
            view()
                .flex_row()
                .flex_wrap()
                .items_center()
                .gap_2()
                .child(
                    text(game)
                        .text_sm()
                        .font_weight(FontWeight::BLACK)
                        .text_color(ink),
                )
                .child(text(title).text_sm().text_color(muted).truncate())
                .child(dynamic(move || trump().map(card::mini)))
                .child(dynamic(move || {
                    penalty().map(|p| {
                        text(p)
                            .text_xs()
                            .font_weight(FontWeight::BOLD)
                            .text_color(ink)
                    })
                }))
                .child(view().flex_1())
                .child(toggle(rules_open))
                .child(leave_controls(ctx)),
        )
        .child(when(
            move || rules_open.get(),
            move || text(rules).text_sm().text_color(muted),
        ))
}

fn toggle(open: Signal<bool>) -> impl IntoElement {
    button("Rules", false, || true, move || open.update(|o| *o = !*o))
}

fn leave_controls(ctx: Ctx) -> impl IntoElement {
    let controller = ctx.controller;
    when(
        move || ctx.is_host(),
        move || {
            view()
                .flex_row()
                .gap_2()
                .child(button(
                    "Pause",
                    false,
                    || true,
                    move || controller.send(Intent::Leave),
                ))
                .child(button(
                    "End table",
                    false,
                    || true,
                    move || controller.send(Intent::End),
                ))
        },
    )
    .otherwise(move || {
        button(
            "Leave",
            false,
            || true,
            move || controller.send(Intent::End),
        )
    })
}

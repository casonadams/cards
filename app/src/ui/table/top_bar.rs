use nsh_core::prelude::*;

use super::super::style::{button, ink, muted, panel, panel_border};
use super::{Ctx, card, model};
use crate::session::Intent;

pub fn bar(ctx: Ctx) -> impl IntoElement {
    let menu_open = signal(false);
    let title = move || {
        ctx.read(|_, v| model::round_title(v.kind, v.round, v.total_rounds, &v.round_label))
            .unwrap_or_default()
    };
    let trump = move || ctx.read(|_, v| v.trump_card).flatten();
    let penalty = move || {
        ctx.read(|_, v| v.hand_type.map(model::penalty_summary))
            .flatten()
    };
    let rules = move || ctx.read(|_, v| v.rules_text.clone()).unwrap_or_default();
    view()
        .relative()
        .z_index(50)
        .w_full()
        .h(move || px(ctx.layout.get().bar_h))
        .flex_shrink_0()
        .flex_row()
        .items_center()
        .gap_2()
        .px_3()
        .bg(panel)
        .border_b_1()
        .border_color(panel_border)
        .child(
            text(title)
                .flex_1()
                .min_w(px(0.0))
                .text_sm()
                .font_weight(FontWeight::BOLD)
                .text_color(ink)
                .truncate(),
        )
        .child(dynamic(move || trump().map(card::mini)))
        .child(dynamic(move || {
            penalty().map(|p| {
                text(p)
                    .text_xs()
                    .font_weight(FontWeight::BOLD)
                    .text_color(ink)
                    .truncate()
            })
        }))
        .child(toggle(menu_open))
        .child(when(
            move || menu_open.get(),
            move || {
                view()
                    .absolute()
                    .top(move || px(ctx.layout.get().bar_h))
                    .left(px(0.0))
                    .right(px(0.0))
                    .gap_3()
                    .p_3()
                    .bg(panel)
                    .border_b_1()
                    .border_color(panel_border)
                    .shadow_lg()
                    .child(text(rules).text_sm().text_color(muted))
                    .child(leave_controls(ctx))
            },
        ))
}

fn toggle(open: Signal<bool>) -> impl IntoElement {
    button("Menu", false, || true, move || open.update(|o| *o = !*o))
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

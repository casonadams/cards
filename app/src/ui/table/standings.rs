use nsh_core::prelude::*;

use super::super::style::{accent, button, ink, muted, panel, panel_border};
use super::super::text::first_name;
use super::{Ctx, model};
use crate::session::Intent;

pub fn final_view(ctx: Ctx) -> impl IntoElement {
    let rows = move || {
        ctx.read(|_, v| model::standings(v.kind, &v.totals))
            .unwrap_or_default()
    };
    let controller = ctx.controller;
    scroll().flex_1().child(
        view()
            .w_full()
            .max_w(px(720.0))
            .self_center()
            .p_4()
            .gap_4()
            .child(
                text("Final standings")
                    .text_2xl()
                    .font_weight(FontWeight::BLACK)
                    .text_color(ink),
            )
            .child(view().gap_2().children(rows().into_iter().map(|row| {
                let name = first_name(&ctx.name(row.seat)).to_owned();
                view()
                    .flex_row()
                    .items_center()
                    .gap_3()
                    .p_3()
                    .rounded_lg()
                    .bg(panel)
                    .border_1()
                    .border_color(if row.place == 1 {
                        accent()
                    } else {
                        panel_border()
                    })
                    .child(
                        text(format!("{}", row.place))
                            .font_weight(FontWeight::BLACK)
                            .text_color(accent),
                    )
                    .child(
                        text(name)
                            .flex_1()
                            .font_weight(FontWeight::BOLD)
                            .text_color(ink),
                    )
                    .child(
                        text(row.total.to_string())
                            .font_family("monospace")
                            .tabular_nums()
                            .text_color(ink),
                    )
            })))
            .child(breakdown(ctx))
            .child(button(
                "Leave table",
                true,
                || true,
                move || controller.send(Intent::End),
            )),
    )
}

fn breakdown(ctx: Ctx) -> impl IntoElement {
    let table = ctx
        .read(|snap, v| {
            let header: Vec<String> = (0..v.seats)
                .map(|i| {
                    first_name(&super::name_of(snap, cards_core::Seat::from_index(i))).to_owned()
                })
                .collect();
            (header, v.round_scores.clone())
        })
        .unwrap_or_default();
    let (header, rounds) = table;
    view()
        .gap_1()
        .child(grid_row("Round".to_owned(), header, true))
        .children(rounds.into_iter().enumerate().map(|(i, scores)| {
            grid_row(
                (i + 1).to_string(),
                scores.iter().map(i32::to_string).collect(),
                false,
            )
        }))
}

fn grid_row(label: String, cells: Vec<String>, head: bool) -> impl IntoElement {
    let weight = if head {
        FontWeight::BOLD
    } else {
        FontWeight::NORMAL
    };
    view()
        .flex_row()
        .gap_2()
        .child(text(label).w(px(48.0)).text_xs().text_color(muted))
        .children(cells.into_iter().map(move |c| {
            text(c)
                .flex_1()
                .text_xs()
                .font_weight(weight)
                .font_family("monospace")
                .text_color(ink)
        }))
}

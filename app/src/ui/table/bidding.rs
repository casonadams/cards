use cards_core::{Action, Rejection, Seat};
use nsh_core::prelude::*;

use super::super::style::{accent, accent_ink, danger, ink, muted, panel, panel_border};
use super::super::text::{first_name, rejection};
use super::Ctx;
use crate::session::Command;

pub fn console(ctx: Ctx) -> impl IntoElement {
    let order = move || {
        ctx.read(|_, v| {
            (0..v.seats)
                .map(|i| Seat::from_index((v.first_actor.index() + i) % v.seats))
                .collect::<Vec<_>>()
        })
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
        .child(
            text("Bidding")
                .text_sm()
                .font_weight(FontWeight::BOLD)
                .text_color(ink),
        )
        .child(view().flex_row().flex_wrap().gap_2().child(each(
            order,
            |s: &Seat| *s,
            move |seat, _| chip(ctx, seat),
        )))
        .child(controls(ctx))
}

fn chip(ctx: Ctx, seat: ReadSignal<Seat>) -> impl IntoElement {
    let seat = seat.get_untracked();
    let bid = move || {
        ctx.read(|_, v| v.bid_of(seat))
            .flatten()
            .map_or("-".to_owned(), |b| b.to_string())
    };
    let role = move || {
        ctx.read(|_, v| {
            let first = seat == v.first_actor;
            let dealer = seat == v.dealer;
            match (first, dealer) {
                (true, true) => "1st bid & lead / Dealer",
                (true, false) => "1st bid & lead",
                (false, true) => "Dealer (bids last)",
                (false, false) => "",
            }
        })
        .unwrap_or_default()
    };
    view()
        .items_center()
        .px_2()
        .py_1()
        .rounded_lg()
        .border_1()
        .border_color(panel_border)
        .child(
            text(move || first_name(&ctx.name(seat)).to_owned())
                .text_xs()
                .text_color(muted),
        )
        .child(
            text(bid)
                .font_family("monospace")
                .font_weight(FontWeight::BOLD)
                .text_color(ink),
        )
        .child(text(role).text_size(px(10.0)).text_color(accent))
}

fn controls(ctx: Ctx) -> impl IntoElement {
    let max = move || {
        ctx.read(|_, v| u8::try_from(v.cards_per_player).unwrap_or(u8::MAX))
            .unwrap_or(0)
    };
    let hook = move || {
        ctx.read(|_, v| (0..=max()).find(|b| !v.legal_bids.contains(b)))
            .flatten()
    };
    when(
        move || ctx.my_turn(),
        move || {
            view()
                .gap_2()
                .child(
                    view()
                        .flex_row()
                        .flex_wrap()
                        .gap_2()
                        .children((0..=max()).map(|n| bid_button(ctx, n))),
                )
                .child(dynamic(move || {
                    hook().map(|forbidden| {
                        text(rejection(Rejection::HookBid { forbidden }))
                            .text_xs()
                            .text_color(danger)
                    })
                }))
        },
    )
}

fn bid_button(ctx: Ctx, amount: u8) -> impl IntoElement {
    let legal = move || {
        ctx.read(|_, v| v.legal_bids.contains(&amount))
            .unwrap_or(false)
    };
    view()
        .size_10()
        .rounded_full()
        .items_center()
        .justify_center()
        .border_2()
        .border_color(accent)
        .bg(accent)
        .role(AccessibilityRole::Button)
        .label(format!("Bid {amount}"))
        .style_when(move || !legal(), |s| s.opacity(0.35))
        .disabled(move || !legal())
        .on_press(move || {
            if legal() {
                ctx.controller.command(Command::Act(Action::Bid(amount)));
            }
        })
        .child(
            text(amount.to_string())
                .font_weight(FontWeight::BOLD)
                .text_color(accent_ink),
        )
}

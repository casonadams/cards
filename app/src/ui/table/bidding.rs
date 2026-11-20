use cards_core::{Action, Rejection};
use nsh_core::prelude::*;

use super::super::style::{accent, accent_ink, danger};
use super::super::text::rejection;
use super::Ctx;
use crate::session::Command;

/// Bid buttons on the felt while it is the viewer's turn to bid; bids placed show on the seat chips.
pub fn console(ctx: Ctx) -> impl IntoElement {
    view()
        .w_full()
        .max_w(px(480.0))
        .px_3()
        .items_center()
        .child(controls(ctx))
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
                .items_center()
                .child(
                    view()
                        .flex_row()
                        .flex_wrap()
                        .justify_center()
                        .gap_2()
                        .children((0..=max()).map(|n| bid_button(ctx, n))),
                )
                .child(dynamic(move || {
                    hook().map(|forbidden| {
                        text(rejection(Rejection::HookBid { forbidden }))
                            .text_xs()
                            .text_center()
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

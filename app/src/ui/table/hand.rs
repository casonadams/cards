use cards_core::Card;
use nsh_core::prelude::*;

use super::super::style::muted;
use super::{Ctx, card, model, seats};
use crate::session::Command;

pub fn hand(ctx: Ctx) -> impl IntoElement {
    let compact = computed(seats::compact);
    let width = signal(untracked(|| window().width.0));
    let cards = computed(move || ctx.read(|_, v| v.hand.clone()).unwrap_or_default());
    dynamic(move || {
        let size = card::hand_size(compact.get());
        let slot_h = size.h + 22.0;
        view()
            .w_full()
            .h(px(slot_h))
            .mb_2()
            .flex_shrink_0()
            .relative()
            .on_layout(move |b: &Bounds<Points>| width.set(b.size.width.0))
            .child(when(
                move || cards.with(Vec::is_empty),
                move || {
                    view()
                        .w_full()
                        .h(px(size.h))
                        .items_center()
                        .justify_center()
                        .child(text("All cards played").text_sm().text_color(muted))
                },
            ))
            .child(each(
                move || cards.get(),
                |c: &Card| *c,
                move |card, index| slot(ctx, size, width, cards, card, index),
            ))
    })
}

fn slot(
    ctx: Ctx,
    size: card::Size,
    width: Signal<f32>,
    cards: Memo<Vec<Card>>,
    card: ReadSignal<Card>,
    index: ReadSignal<usize>,
) -> impl IntoElement {
    let pad = if size.w < 60.0 { 8.0 } else { 16.0 };
    let layout = move || model::hand_layout(width.get(), size.w, cards.with(Vec::len), 6.0, pad);
    let playable = move || {
        let card = card.get();
        ctx.my_turn()
            && ctx
                .read(|_, v| v.playable_cards.contains(&card))
                .unwrap_or(false)
    };
    view()
        .absolute()
        .bottom(px(0.0))
        .left(move || {
            let l = layout();
            px(l.start + l.step * index.get() as f32)
        })
        .z_index(move || i32::try_from(index.get()).unwrap_or(0))
        .child(
            when(playable, move || {
                face(ctx, size, card, card::Tone::Playable, true)
            })
            .otherwise(move || {
                let tone = if ctx.my_turn() {
                    card::Tone::Muted
                } else {
                    card::Tone::Inspect
                };
                face(ctx, size, card, tone, false)
            }),
        )
}

fn face(
    ctx: Ctx,
    size: card::Size,
    card: ReadSignal<Card>,
    tone: card::Tone,
    press: bool,
) -> impl IntoElement {
    let c = card.get_untracked();
    let badge = untracked(|| {
        ctx.read(|_, v| model::card_badge(v.hand_type, v.trump_suit, c))
            .flatten()
    });
    let face = card::face(c, size, tone, badge)
        .transition_transform()
        .duration(120.0)
        .ease_out();
    if press {
        face.role(AccessibilityRole::Button)
            .hover(|s| s.translate_y(px(-18.0)))
            .on_press(move || {
                ctx.controller
                    .command(Command::Act(cards_core::Action::Play(c)))
            })
    } else {
        face
    }
}

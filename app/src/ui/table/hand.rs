use cards_core::Card;
use nsh_core::prelude::*;

use super::super::style::{ink, muted};
use super::super::text::card_label;
use super::{Ctx, card, layout, model, progress, scores};
use crate::session::Command;

const HAND_BOTTOM: f32 = 8.0;

/// A hand card tagged with its round, so a card dealt again later gets a fresh row.
type Dealt = (usize, Card);

pub fn hand(ctx: Ctx, standings_open: Signal<bool>) -> impl IntoElement {
    let round_over = computed(move || ctx.read(|_, v| v.round_over).unwrap_or(false));
    view()
        .w_full()
        .flex_shrink_0()
        .child(
            text(move || ctx.read(|_, v| progress::your_line(v)).unwrap_or_default())
                .h(move || px(ctx.layout.get().header_h))
                .px_3()
                .text_sm()
                .font_weight(FontWeight::BOLD)
                .text_color(ink)
                .truncate(),
        )
        .child(dynamic(move || {
            if round_over.get() {
                let h = ctx.layout.get().card.h + layout::HAND_EXTRA;
                scores::round_panel(ctx, standings_open)
                    .h(px(h))
                    .into_element()
            } else {
                cards(ctx).into_element()
            }
        }))
}

fn cards(ctx: Ctx) -> impl IntoElement {
    let width = signal(untracked(|| window().width.0));
    let cards = computed(move || {
        ctx.read(|_, v| v.hand.iter().map(|c| (v.round, *c)).collect::<Vec<Dealt>>())
            .unwrap_or_default()
    });
    dynamic(move || {
        let size = ctx.layout.get().card;
        let slot_h = size.h + layout::HAND_EXTRA;
        view()
            .w_full()
            .h(px(slot_h))
            .relative()
            .element_ref(&ctx.motion.hand())
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
                |dealt: &Dealt| *dealt,
                move |dealt, index| slot(ctx, size, slot_h, width, cards, dealt, index),
            ))
    })
}

fn slot(
    ctx: Ctx,
    size: card::Size,
    slot_h: f32,
    width: Signal<f32>,
    cards: Memo<Vec<Dealt>>,
    dealt: ReadSignal<Dealt>,
    index: ReadSignal<usize>,
) -> impl IntoElement {
    let pad = if size.w < 60.0 { 8.0 } else { 16.0 };
    let layout = move || model::hand_layout(width.get(), size.w, cards.with(Vec::len), 6.0, pad);
    let left = move || {
        let l = layout();
        l.start + l.step * index.get() as f32
    };
    let centre = move || {
        point(
            px(left() + size.w / 2.0),
            px(slot_h - HAND_BOTTOM - size.h / 2.0),
        )
    };
    let card = dealt.get_untracked().1;
    let playable = move || {
        ctx.my_turn()
            && ctx
                .read(|_, v| v.playable_cards.contains(&card))
                .unwrap_or(false)
    };
    let tone = move || {
        if ctx.my_turn() {
            card::Tone::Muted
        } else {
            card::Tone::Inspect
        }
    };
    view()
        .absolute()
        .bottom(px(HAND_BOTTOM))
        .left(move || px(left()))
        .z_index(move || i32::try_from(index.get()).unwrap_or(i32::MAX))
        .child(
            when(playable, move || {
                face(ctx, size, card, card::Tone::Playable, Some(centre)).into_element()
            })
            .otherwise(move || {
                dynamic(move || face(ctx, size, card, tone(), None::<fn() -> _>).into_element())
            }),
        )
}

/// A hand card; `launch_from` (where it sits in the hand) makes it playable.
fn face(
    ctx: Ctx,
    size: card::Size,
    card: Card,
    tone: card::Tone,
    launch_from: Option<impl Fn() -> Point<Points> + 'static>,
) -> impl IntoElement {
    let badge = untracked(|| {
        ctx.read(|_, v| model::card_badge(v.hand_type, v.trump_suit, card))
            .flatten()
    });
    let face = card::face(card, size, tone, badge)
        .transition_transform()
        .duration(120.0)
        .ease_out();
    match launch_from {
        Some(at) => view()
            .group()
            .role(AccessibilityRole::Button)
            .label(card_label(card))
            .on_press(move || {
                ctx.motion.launch(card, untracked(&at));
                ctx.controller
                    .command(Command::Act(cards_core::Action::Play(card)));
            })
            .child(
                face.group_hover(|s| s.translate_y(px(-18.0)))
                    .group_active(|s| s.translate_y(px(-14.0)).scale(0.97)),
            ),
        None => view().child(face),
    }
}

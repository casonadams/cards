use cards_core::Card;
use nsh_core::prelude::*;

use super::super::style::{accent, accent_ink, suit_color};
use super::super::text::{card_label, rank_glyph, suit_symbol};

pub use super::layout::CardSize as Size;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Tone {
    Playable,
    Inspect,
    Muted,
}

fn white() -> AdaptiveColor {
    AdaptiveColor::rgb(0xffffff, 0xffffff)
}

fn dark() -> AdaptiveColor {
    AdaptiveColor::rgb(0x18181b, 0x18181b)
}

fn penalty_ink() -> AdaptiveColor {
    AdaptiveColor::rgb(0xb91c1c, 0xb91c1c)
}

fn corner(card: Card, size: Size) -> View {
    view()
        .items_center()
        .child(
            text(rank_glyph(card.rank))
                .text_size(px(size.index))
                .font_weight(FontWeight::BOLD)
                .text_color(suit_color(card.suit)),
        )
        .child(
            text(suit_symbol(card.suit))
                .text_size(px(size.index))
                .text_color(suit_color(card.suit)),
        )
}

pub fn face(card: Card, size: Size, tone: Tone, badge: Option<String>) -> View {
    let (bg, border) = match tone {
        Tone::Muted => (
            AdaptiveColor::rgb(0xe2e8f0, 0xe2e8f0),
            AdaptiveColor::rgb(0xcbd5e1, 0xcbd5e1),
        ),
        Tone::Playable | Tone::Inspect => (white(), dark()),
    };
    let badge_ink = if badge.as_deref() == Some("T") {
        accent_ink()
    } else {
        penalty_ink()
    };
    let badge_bg = if badge.as_deref() == Some("T") {
        accent()
    } else {
        white()
    };
    view()
        .relative()
        .w(px(size.w))
        .h(px(size.h))
        .rounded_md()
        .border_1()
        .bg(bg)
        .border_color(border)
        .overflow_hidden()
        .role(AccessibilityRole::Image)
        .label(card_label(card))
        .child(corner(card, size).absolute().top(px(2.0)).left(px(3.0)))
        .child(
            view()
                .absolute()
                .inset_0()
                .items_center()
                .justify_center()
                .child(
                    text(rank_glyph(card.rank))
                        .text_size(px(size.rank))
                        .font_weight(FontWeight::BLACK)
                        .text_color(suit_color(card.suit)),
                ),
        )
        .child(
            corner(card, size)
                .absolute()
                .bottom(px(2.0))
                .right(px(3.0))
                .rotate(deg(180.0)),
        )
        .child(badge.map(|b| {
            view()
                .absolute()
                .bottom(px(3.0))
                .left(px(3.0))
                .px_1()
                .rounded_md()
                .bg(badge_bg)
                .child(
                    text(b)
                        .text_size(px(size.index - 1.0))
                        .font_weight(FontWeight::BOLD)
                        .text_color(badge_ink),
                )
        }))
}

pub fn mini(card: Card) -> View {
    view()
        .flex_row()
        .items_center()
        .gap_1()
        .px_2()
        .rounded_md()
        .border_1()
        .bg(white())
        .border_color(dark())
        .label(format!("Trump: {}", card_label(card)))
        .child(
            text(rank_glyph(card.rank))
                .text_sm()
                .font_weight(FontWeight::BOLD)
                .text_color(dark()),
        )
        .child(
            text(suit_symbol(card.suit))
                .text_sm()
                .text_color(suit_color(card.suit)),
        )
}

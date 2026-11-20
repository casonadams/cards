use cards_core::Suit;
use nsh_core::prelude::*;

pub fn felt() -> AdaptiveColor {
    AdaptiveColor::rgb(0x0b4f2e, 0x0b4f2e)
}

pub fn felt_dark() -> AdaptiveColor {
    AdaptiveColor::rgb(0x07331e, 0x07331e)
}

pub fn panel() -> AdaptiveColor {
    AdaptiveColor::rgb(0x18181b, 0x18181b)
}

pub fn panel_border() -> AdaptiveColor {
    AdaptiveColor::rgb(0x3f3f46, 0x3f3f46)
}

pub fn ink() -> AdaptiveColor {
    AdaptiveColor::rgb(0xf4f4f5, 0xf4f4f5)
}

pub fn muted() -> AdaptiveColor {
    AdaptiveColor::rgb(0xa1a1aa, 0xa1a1aa)
}

pub fn accent() -> AdaptiveColor {
    AdaptiveColor::rgb(0x34d399, 0x34d399)
}

pub fn accent_ink() -> AdaptiveColor {
    AdaptiveColor::rgb(0x052e1a, 0x052e1a)
}

pub fn danger() -> AdaptiveColor {
    AdaptiveColor::rgb(0xfb7185, 0xfb7185)
}

pub fn suit_color(suit: Suit) -> AdaptiveColor {
    match suit {
        Suit::Hearts | Suit::Diamonds => AdaptiveColor::rgb(0xdc2626, 0xdc2626),
        Suit::Clubs | Suit::Spades => AdaptiveColor::rgb(0x18181b, 0x18181b),
    }
}

/// A pill button; `enabled` greys it out and ignores presses when false.
pub fn button(
    label: impl Into<SharedString>,
    primary: bool,
    enabled: impl Fn() -> bool + Copy + 'static,
    on_press: impl Fn() + 'static,
) -> View {
    let label: SharedString = label.into();
    view()
        .px_4()
        .py_2()
        .rounded_full()
        .border_2()
        .items_center()
        .justify_center()
        .role(AccessibilityRole::Button)
        .label(label.clone())
        .bg(move || if primary { accent() } else { panel() })
        .border_color(move || if primary { accent() } else { panel_border() })
        .style_when(move || !enabled(), |s| s.opacity(0.4))
        .disabled(move || !enabled())
        .on_press(move || {
            if enabled() {
                on_press();
            }
        })
        .child(
            text(label)
                .font_weight(FontWeight::BOLD)
                .text_sm()
                .text_color(move || if primary { accent_ink() } else { ink() }),
        )
}

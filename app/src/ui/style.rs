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

pub fn warn() -> AdaptiveColor {
    AdaptiveColor::rgb(0xfbbf24, 0xfbbf24)
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

const COLUMN_MAX: f32 = 384.0;
const PAGE_PADDING: f32 = 12.0;
const COLUMN_GAP: f32 = 12.0;

/// Width of one form column: two side by side when the window is wide enough, or in landscape.
pub fn column_width(window_width: f32, window_height: f32) -> f32 {
    let avail = window_width - 2.0 * PAGE_PADDING;
    let two = (avail - COLUMN_GAP) / 2.0;
    let min_pair = if window_width > window_height {
        250.0
    } else {
        300.0
    };
    if two >= min_pair {
        two.min(COLUMN_MAX)
    } else {
        avail.min(COLUMN_MAX)
    }
}

/// A full-screen form page whose columns wrap; it scrolls only if a tiny screen cannot fit it.
pub fn page(columns: [View; 2]) -> impl IntoElement {
    scroll().flex_1().scrollbar(false).child(
        view()
            .w_full()
            .p(px(PAGE_PADDING))
            .flex_row()
            .flex_wrap()
            .justify_center()
            .items_start()
            .gap(px(COLUMN_GAP))
            .children(columns),
    )
}

/// Short windows (landscape phones) tighten headings and spacing.
pub fn short_window() -> bool {
    window().height.0 < 520.0
}

/// One column of a [`page`].
pub fn column() -> View {
    view()
        .w(move || {
            let size = window();
            px(column_width(size.width.0, size.height.0))
        })
        .gap_3()
}

#[cfg(test)]
mod tests {
    use super::column_width;

    #[test]
    fn columns_pair_up_only_when_both_stay_readable() {
        assert_eq!(column_width(320.0, 568.0), 296.0);
        assert_eq!(column_width(390.0, 664.0), 366.0);
        assert_eq!(column_width(568.0, 320.0), 266.0);
        assert_eq!(column_width(750.0, 342.0), 357.0);
        assert_eq!(column_width(1280.0, 720.0), 384.0);
    }
}

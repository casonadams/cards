//! How the table divides the window: everything fits on one screen, with no page scroll.

/// Card dimensions; trick and hand cards share one size so a played card keeps its size.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct CardSize {
    pub w: f32,
    pub h: f32,
    pub rank: f32,
    pub index: f32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ChipStyle {
    /// Avatar beside name and stats (wide or short windows).
    Row,
    /// Avatar above name and stats (narrow windows or many seats).
    Stack,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct TableLayout {
    pub card: CardSize,
    pub chips: ChipStyle,
    pub bar_h: f32,
    pub chip_h: f32,
    pub header_h: f32,
    pub gap: f32,
    pub short: bool,
}

const MIN_CARD_H: f32 = 60.0;
/// Landscape phones trade card size for fitting on one screen.
const MIN_SHORT_CARD_H: f32 = 48.0;
const MAX_CARD_H: f32 = 150.0;
const CARD_RATIO: f32 = 0.7;
/// Room above hand cards for the hover lift, plus bottom padding.
pub const HAND_EXTRA: f32 = 30.0;
/// The felt's status row, name pills and padding around the trick cards.
pub const FELT_EXTRA: f32 = 68.0;
const SIDE_PADDING: f32 = 16.0;
const CHIP_GAP: f32 = 6.0;
const MIN_ROW_CHIP_W: f32 = 104.0;
/// Fraction of a trick card left visible when the row overlaps.
const TRICK_VISIBLE: f32 = 0.6;

fn card(h: f32) -> CardSize {
    CardSize {
        w: (h * CARD_RATIO).floor(),
        h: h.floor(),
        rank: (h * 0.33).round(),
        index: (h * 0.13).round(),
    }
}

pub fn table_layout(width: f32, height: f32, seats: usize) -> TableLayout {
    let seats = seats.max(1);
    let short = height < 420.0;
    let avail_w = width - SIDE_PADDING;
    let chip_w = (avail_w - CHIP_GAP * (seats - 1) as f32) / seats as f32;
    let chips = if short || chip_w >= MIN_ROW_CHIP_W {
        ChipStyle::Row
    } else {
        ChipStyle::Stack
    };
    let chip_h = match (chips, short) {
        (ChipStyle::Row, true) => 40.0,
        (ChipStyle::Row, false) => 48.0,
        (ChipStyle::Stack, _) => 74.0,
    };
    let (bar_h, header_h, gap) = if short {
        (36.0, 20.0, 4.0)
    } else {
        (44.0, 24.0, 8.0)
    };
    let fixed = bar_h + chip_h + header_h + 4.0 * gap + HAND_EXTRA + FELT_EXTRA;
    let by_height = (height - fixed) / 2.0;
    let trick_w = avail_w / (1.0 + TRICK_VISIBLE * (seats - 1) as f32);
    let by_width = trick_w / CARD_RATIO;
    let min = if short { MIN_SHORT_CARD_H } else { MIN_CARD_H };
    let h = by_height.min(by_width).clamp(min, MAX_CARD_H);
    TableLayout {
        card: card(h),
        chips,
        bar_h,
        chip_h,
        header_h,
        gap,
        short,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Everything but the felt's flexible space.
    fn used_height(layout: &TableLayout) -> f32 {
        layout.bar_h
            + layout.chip_h
            + layout.header_h
            + 4.0 * layout.gap
            + 2.0 * layout.card.h
            + HAND_EXTRA
            + FELT_EXTRA
    }

    const SCREENS: [(&str, f32, f32); 9] = [
        ("iPhone SE", 320.0, 568.0),
        ("iPhone SE landscape", 568.0, 320.0),
        ("iPhone 13", 390.0, 664.0),
        ("iPhone 13 landscape", 750.0, 342.0),
        ("375x560", 375.0, 560.0),
        ("Pixel 7", 412.0, 839.0),
        ("iPad", 820.0, 1180.0),
        ("laptop", 1280.0, 720.0),
        ("desktop", 1920.0, 1080.0),
    ];

    #[test]
    fn the_table_fits_every_screen_without_scrolling() {
        for (name, w, h) in SCREENS {
            for seats in 3..=7 {
                let layout = table_layout(w, h, seats);
                assert!(
                    used_height(&layout) <= h,
                    "{name} with {seats} seats needs {} of {h}",
                    used_height(&layout)
                );
            }
        }
    }

    #[test]
    fn a_full_trick_fits_the_width_with_cards_at_least_partly_visible() {
        for (name, w, h) in SCREENS {
            for seats in 3..=7 {
                let card = table_layout(w, h, seats).card;
                let row = card.w * (1.0 + TRICK_VISIBLE * (seats - 1) as f32);
                assert!(row <= w - SIDE_PADDING + 1.0, "{name} {seats}: row {row}");
            }
        }
    }

    #[test]
    fn big_screens_get_big_cards_and_small_ones_stay_readable() {
        assert_eq!(table_layout(1920.0, 1080.0, 4).card.h, MAX_CARD_H);
        for (name, w, h) in SCREENS {
            let layout = table_layout(w, h, 7);
            let min = if layout.short {
                MIN_SHORT_CARD_H
            } else {
                MIN_CARD_H
            };
            assert!(layout.card.h >= min, "{name}: {}", layout.card.h);
        }
    }

    #[test]
    fn chips_stack_when_a_row_would_be_too_narrow() {
        assert_eq!(table_layout(1280.0, 720.0, 7).chips, ChipStyle::Row);
        assert_eq!(table_layout(390.0, 664.0, 4).chips, ChipStyle::Stack);
        assert_eq!(table_layout(750.0, 342.0, 7).chips, ChipStyle::Row);
        assert_eq!(table_layout(568.0, 320.0, 7).chips, ChipStyle::Row);
    }
}

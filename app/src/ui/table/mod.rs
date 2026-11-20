mod bidding;
mod card;
mod hand;
mod model;
mod scores;
mod seats;
mod standings;
mod top_bar;
mod trick;

use cards_core::{Phase, Seat, SeatView};
use cards_net::{Snapshot, Stage};
use nsh_core::prelude::*;

use super::style::{danger, panel};
use crate::session::{Controller, Role, Status};

#[derive(Clone, Copy)]
struct Ctx {
    controller: Controller,
    snapshot: Memo<Option<Snapshot>>,
}

impl Ctx {
    fn read<R>(&self, f: impl FnOnce(&Snapshot, &SeatView) -> R) -> Option<R> {
        self.snapshot.with(|s| {
            let snap = s.as_ref()?;
            match &snap.stage {
                Stage::Playing { view, .. } => Some(f(snap, view)),
                Stage::Lobby => None,
            }
        })
    }

    fn away(&self) -> bool {
        matches!(self.controller.status.get(), Status::HostAway { .. })
    }

    fn is_host(&self) -> bool {
        self.controller.role.get() == Some(Role::Host)
    }

    fn name(&self, seat: Seat) -> String {
        self.read(|snap, _| name_of(snap, seat)).unwrap_or_default()
    }

    fn my_turn(&self) -> bool {
        !self.away()
            && self
                .read(|snap, v| v.actor == Some(snap.you))
                .unwrap_or(false)
    }
}

fn name_of(snap: &Snapshot, seat: Seat) -> String {
    snap.roster
        .iter()
        .find(|s| s.seat == seat)
        .map(|s| s.name.clone())
        .unwrap_or_default()
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Mode {
    Bidding,
    RoundOver,
    Play,
}

/// Short or narrow windows (phones in either orientation) use small cards and compact stats.
pub fn compact() -> bool {
    let size = window();
    size.width.0 < 520.0 || size.height.0 < 520.0
}

pub fn screen(controller: Controller, snapshot: Memo<Option<Snapshot>>) -> impl IntoElement {
    let ctx = Ctx {
        controller,
        snapshot,
    };
    let standings_open = signal(false);
    dynamic(move || {
        if standings_open.get() {
            standings::final_view(ctx).into_element()
        } else {
            table(ctx, standings_open).into_element()
        }
    })
}

fn table(ctx: Ctx, standings_open: Signal<bool>) -> impl IntoElement {
    let mode = computed(move || {
        ctx.read(|_, v| match v.phase {
            Phase::Bidding => Mode::Bidding,
            Phase::RoundOver | Phase::GameOver => Mode::RoundOver,
            Phase::Playing => Mode::Play,
        })
        .unwrap_or(Mode::Play)
    });
    view()
        .flex_1()
        .flex_col()
        .child(when(
            move || ctx.away(),
            || {
                text("Paused - waiting for the host to return")
                    .text_sm()
                    .text_center()
                    .font_weight(FontWeight::BOLD)
                    .text_color(danger)
                    .p_2()
                    .bg(panel)
            },
        ))
        .child(super::home::notice(ctx.controller))
        .child(top_bar::bar(ctx))
        .child(
            scroll().flex_1().child(
                view()
                    .w_full()
                    .flex_col()
                    .items_center()
                    .gap_3()
                    .px_2()
                    .pt_4()
                    .pb_2()
                    .child(seats::strip(ctx))
                    .child(trick::area(ctx))
                    .child(dynamic(move || match mode.get() {
                        Mode::Bidding => bidding::console(ctx).into_element(),
                        Mode::RoundOver => scores::round_panel(ctx, standings_open).into_element(),
                        Mode::Play => view().into_element(),
                    })),
            ),
        )
        .child(hand::hand(ctx))
}

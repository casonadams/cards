mod bidding;
mod card;
mod hand;
mod layout;
mod model;
mod motion;
mod progress;
mod scores;
mod seats;
mod standings;
mod top_bar;
mod trick;

use cards_core::{Seat, SeatView};
use cards_net::{Snapshot, Stage};
use nsh_core::prelude::*;

use super::style::{danger, panel};
use crate::session::{Controller, Role, Status};

#[derive(Clone, Copy)]
struct Ctx {
    controller: Controller,
    snapshot: Memo<Option<Snapshot>>,
    motion: motion::Motion,
    layout: Memo<layout::TableLayout>,
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

pub fn screen(controller: Controller, snapshot: Memo<Option<Snapshot>>) -> impl IntoElement {
    let ctx = Ctx {
        controller,
        snapshot,
        motion: motion::Motion::new(),
        layout: computed(move || {
            let seats = snapshot.with(|s| s.as_ref().map_or(0, |s| s.capacity));
            let size = window();
            layout::table_layout(size.width.0, size.height.0, seats)
        }),
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
    let gap = move || px(ctx.layout.get().gap);
    view()
        .relative()
        .flex_1()
        .flex_col()
        .overflow_hidden()
        .gap(gap)
        .child(top_bar::bar(ctx))
        .child(seats::strip(ctx))
        .child(trick::area(ctx))
        .child(hand::hand(ctx, standings_open))
        .child(
            view()
                .absolute()
                .top(px(0.0))
                .left(px(0.0))
                .right(px(0.0))
                .z_index(60)
                .gap_1()
                .p_2()
                .child(when(
                    move || ctx.away(),
                    || {
                        text("Paused - waiting for the host to return")
                            .text_sm()
                            .text_center()
                            .font_weight(FontWeight::BOLD)
                            .text_color(danger)
                            .p_2()
                            .rounded_lg()
                            .bg(panel)
                    },
                ))
                .child(super::home::notice(ctx.controller)),
        )
}

use cards_net::{Occupant, SeatInfo, Snapshot};
use nsh_core::prelude::*;

use super::style::{accent, button, danger, ink, muted, panel, panel_border};
use super::text::initials;
use crate::session::{Command, Controller, Intent, Role};

pub fn screen(controller: Controller, snapshot: Memo<Option<Snapshot>>) -> impl IntoElement {
    let is_host = move || controller.role.get() == Some(Role::Host);
    let roster = computed(move || {
        snapshot.with(|s| s.as_ref().map(|s| s.roster.clone()).unwrap_or_default())
    });
    let open_seats = move || {
        snapshot.with(|s| {
            s.as_ref()
                .map_or(0, |s| s.capacity.saturating_sub(s.roster.len()))
        })
    };
    let code = move || {
        controller
            .code
            .get()
            .map(|c| c.to_string())
            .unwrap_or_default()
    };

    scroll().flex_1().child(
        view()
            .w_full()
            .max_w_96()
            .self_center()
            .p_4()
            .gap_4()
            .child(super::home::notice(controller))
            .child(code_card(code))
            .child(
                view()
                    .gap_2()
                    .child(each(
                        move || roster.get(),
                        |s: &SeatInfo| s.seat,
                        move |seat, _| member(controller, seat, is_host),
                    ))
                    .child(
                        text(move || match open_seats() {
                            0 => "Every seat is taken.".to_owned(),
                            1 => "Waiting for 1 more player...".to_owned(),
                            n => format!("Waiting for {n} more players..."),
                        })
                        .text_sm()
                        .text_color(muted),
                    ),
            )
            .child(
                when(is_host, move || {
                    view()
                        .flex_row()
                        .gap_2()
                        .child(button(
                            "+ Add AI player",
                            false,
                            move || open_seats() > 0,
                            move || {
                                controller.command(Command::AddAi);
                            },
                        ))
                        .child(button(
                            "Start game",
                            true,
                            move || open_seats() == 0,
                            move || {
                                controller.command(Command::Start);
                            },
                        ))
                })
                .otherwise(|| {
                    text("The host will start the game.")
                        .text_sm()
                        .text_color(muted)
                }),
            )
            .child(button(
                "Leave table",
                false,
                || true,
                move || controller.send(Intent::End),
            )),
    )
}

fn code_card(code: impl Fn() -> String + Copy + 'static) -> impl IntoElement {
    view()
        .items_center()
        .gap_1()
        .p_4()
        .rounded_xl()
        .bg(panel)
        .border_1()
        .border_color(panel_border)
        .child(text("Table code").text_xs().uppercase().text_color(muted))
        .child(
            text(code)
                .test_id("table-code")
                .text_size(px(40.0))
                .font_weight(FontWeight::BLACK)
                .font_family("monospace")
                .text_color(ink),
        )
        .child(button(
            "Copy code",
            false,
            || true,
            move || set_clipboard(code()),
        ))
}

fn member(
    controller: Controller,
    seat: ReadSignal<SeatInfo>,
    is_host: impl Fn() -> bool + Copy + 'static,
) -> impl IntoElement {
    let removable = move || is_host() && seat.with(|s| s.occupant != Occupant::Host);
    view()
        .flex_row()
        .items_center()
        .gap_3()
        .p_3()
        .rounded_lg()
        .bg(panel)
        .border_1()
        .border_color(panel_border)
        .child(
            view()
                .size_8()
                .rounded_full()
                .border_1()
                .border_color(accent)
                .items_center()
                .justify_center()
                .child(
                    text(move || seat.with(|s| initials(&s.name)))
                        .text_xs()
                        .font_weight(FontWeight::BLACK)
                        .text_color(accent),
                ),
        )
        .child(
            text(move || seat.with(|s| s.name.clone()))
                .flex_1()
                .font_weight(FontWeight::BOLD)
                .text_color(ink)
                .truncate(),
        )
        .child(
            text(move || {
                seat.with(|s| match (s.occupant, s.connected) {
                    (Occupant::Host, _) => "Host",
                    (Occupant::Ai, _) => "AI",
                    (Occupant::Guest, true) => "Joined",
                    (Occupant::Guest, false) => "Disconnected",
                })
            })
            .text_xs()
            .text_color(move || {
                if seat.with(|s| s.connected) {
                    muted()
                } else {
                    danger()
                }
            }),
        )
        .child(when(removable, move || {
            text("Remove")
                .text_xs()
                .text_color(danger)
                .role(AccessibilityRole::Button)
                .on_press(move || controller.command(Command::Remove(seat.with(|s| s.seat))))
        }))
}

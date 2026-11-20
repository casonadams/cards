mod home;
mod lobby;
pub mod style;
mod table;
pub mod text;

use cards_net::Stage;
use nsh_core::prelude::*;

use crate::session::{Controller, Intent};
use style::{button, felt, ink, muted};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Screen {
    Home,
    Waiting,
    Lobby,
    Table,
}

pub fn root(controller: Controller) -> impl IntoElement {
    let snapshot = computed(move || controller.snapshot.get());
    let screen = computed(move || {
        if !controller.in_room() {
            return Screen::Home;
        }
        snapshot.with(|s| match s.as_ref().map(|s| &s.stage) {
            None => Screen::Waiting,
            Some(Stage::Lobby) => Screen::Lobby,
            Some(Stage::Playing { .. }) => Screen::Table,
        })
    });
    view()
        .flex_1()
        .bg(felt)
        .text_color(ink)
        .child(dynamic(move || match screen.get() {
            Screen::Home => home::screen(controller).into_element(),
            Screen::Waiting => waiting(controller).into_element(),
            Screen::Lobby => lobby::screen(controller, snapshot).into_element(),
            Screen::Table => table::screen(controller, snapshot).into_element(),
        }))
}

fn waiting(controller: Controller) -> impl IntoElement {
    let message =
        move || text::status(&controller.status.get()).unwrap_or_else(|| "Connecting...".into());
    view()
        .flex_1()
        .items_center()
        .justify_center()
        .gap_4()
        .p_6()
        .child(text(message).text_center().text_color(muted))
        .child(button(
            "Leave",
            false,
            || true,
            move || controller.send(Intent::End),
        ))
}

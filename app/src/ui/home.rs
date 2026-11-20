use cards_core::GameKind;
use cards_net::RoomCode;
use cards_net::protocol::MAX_NAME_LEN;
use nsh_base::input;
use nsh_core::prelude::*;

use super::style::{accent, button, danger, ink, muted, panel, panel_border};
use crate::identity;
use crate::session::{Controller, Intent};

const GAMES: [GameKind; 2] = [GameKind::OhWell, GameKind::CanadianSalad];
#[allow(clippy::cast_possible_truncation)]
const NAME_INPUT_LIMIT: u32 = MAX_NAME_LEN as u32;

pub fn screen(controller: Controller) -> impl IntoElement {
    let name = signal(identity::saved_name());
    let kind = signal(GameKind::OhWell);
    let seats = signal(4usize);
    let code = signal(String::new());
    let resumable = match identity::saved_host() {
        Ok(saved) => saved.map(|s| s.code()),
        Err(e) => {
            identity::forget_host();
            controller.notice.set(Some(e.to_string()));
            None
        }
    };

    let valid_name = move || {
        let len = name.with(|n| n.trim().chars().count());
        (1..=MAX_NAME_LEN).contains(&len)
    };
    let remember = move || {
        let trimmed = name.with(|n| n.trim().to_owned());
        if let Err(e) = identity::save_name(&trimmed) {
            controller.notice.set(Some(e.to_string()));
        }
        trimmed
    };

    let host = move || {
        let name = remember();
        controller.send(Intent::Host {
            name,
            kind: kind.get_untracked(),
            seats: seats.get_untracked(),
        });
    };
    let join = move || match RoomCode::parse(&code.get_untracked()) {
        Ok(code) => {
            let name = remember();
            controller.send(Intent::Join { name, code });
        }
        Err(_) => controller
            .notice
            .set(Some("Room codes are 6 letters and digits.".into())),
    };

    scroll().flex_1().child(
        view()
            .w_full()
            .max_w_96()
            .self_center()
            .p_4()
            .gap_4()
            .child(
                text("Cards")
                    .text_3xl()
                    .font_weight(FontWeight::BLACK)
                    .text_color(ink),
            )
            .child(notice(controller))
            .child(section(
                "Your name",
                input()
                    .test_id("name")
                    .value(move || name.get())
                    .on_change(move |t: &str| name.set(t.to_owned()))
                    .placeholder("First and last name")
                    .max_length(NAME_INPUT_LIMIT)
                    .px_3()
                    .py_2()
                    .rounded_lg()
                    .border_1()
                    .border_color(panel_border)
                    .text_color(ink),
            ))
            .child(section(
                "New table",
                new_table(kind, seats, valid_name, host),
            ))
            .child(section("Join a table", join_table(code, valid_name, join)))
            .child(resumable.map(|code| {
                section(
                    "Your table",
                    button(
                        format!("Resume table {code}"),
                        false,
                        || true,
                        move || {
                            controller.send(Intent::Resume);
                        },
                    ),
                )
            })),
    )
}

fn new_table(
    kind: Signal<GameKind>,
    seats: Signal<usize>,
    valid_name: impl Fn() -> bool + Copy + 'static,
    host: impl Fn() + 'static,
) -> impl IntoElement {
    view()
        .gap_3()
        .child(view().flex_row().gap_2().children(GAMES.map(|game| {
            choice(
                game.name(),
                move || kind.get() == game,
                move || {
                    batch(|| {
                        kind.set(game);
                        seats.update(|s| *s = (*s).clamp(game.min_players(), game.max_players()));
                    });
                },
            )
        })))
        .child(
            view()
                .flex_row()
                .flex_wrap()
                .gap_2()
                .children((3..=7).map(|n| {
                    choice(
                        format!("{n} players"),
                        move || seats.get() == n,
                        move || seats.set(n),
                    )
                    .style_when(move || n > kind.get().max_players(), |s| s.hidden())
                })),
        )
        .child(button("Create table", true, valid_name, host))
}

fn join_table(
    code: Signal<String>,
    valid_name: impl Fn() -> bool + Copy + 'static,
    join: impl Fn() + Copy + 'static,
) -> impl IntoElement {
    view()
        .flex_row()
        .gap_2()
        .items_center()
        .child(
            input()
                .test_id("code")
                .value(move || code.get())
                .on_change(move |t: &str| code.set(t.to_uppercase()))
                .on_submit(move |_: &str| join())
                .placeholder("ABC234")
                .max_length(7)
                .flex_1()
                .px_3()
                .py_2()
                .rounded_lg()
                .border_1()
                .border_color(panel_border)
                .text_color(ink)
                .font_family("monospace")
                .text_lg(),
        )
        .child(button(
            "Join",
            true,
            move || valid_name() && RoomCode::parse(&code.get()).is_ok(),
            join,
        ))
}

fn section(title: &'static str, body: impl IntoElement) -> impl IntoElement {
    view()
        .gap_2()
        .p_4()
        .rounded_xl()
        .border_1()
        .border_color(panel_border)
        .bg(panel)
        .child(
            text(title)
                .text_xs()
                .uppercase()
                .font_weight(FontWeight::BOLD)
                .text_color(muted),
        )
        .child(body)
}

/// A selectable chip with fixed border width so selection never changes its size.
fn choice(
    label: impl Into<SharedString>,
    selected: impl Fn() -> bool + Copy + 'static,
    on_press: impl Fn() + 'static,
) -> View {
    let label: SharedString = label.into();
    view()
        .px_3()
        .py_1p5()
        .rounded_full()
        .border_2()
        .role(AccessibilityRole::Button)
        .label(label.clone())
        .border_color(move || if selected() { accent() } else { panel_border() })
        .transition_colors()
        .duration(150.0)
        .on_press(on_press)
        .child(
            text(label)
                .text_sm()
                .font_weight(FontWeight::BOLD)
                .text_color(move || if selected() { accent() } else { ink() }),
        )
}

pub fn notice(controller: Controller) -> impl IntoElement {
    when(
        move || controller.notice.with(Option::is_some),
        move || {
            view()
                .flex_row()
                .gap_2()
                .items_center()
                .p_3()
                .rounded_lg()
                .border_1()
                .border_color(danger)
                .child(
                    text(move || controller.notice.get().unwrap_or_default())
                        .flex_1()
                        .text_sm()
                        .text_color(danger),
                )
                .child(
                    text("Dismiss")
                        .text_xs()
                        .text_color(muted)
                        .role(AccessibilityRole::Button)
                        .on_press(move || controller.notice.set(None)),
                )
        },
    )
}

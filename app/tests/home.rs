use std::sync::Arc;

use cards_core::GameKind;
use cards_net::{HostSession, PlayerId, RoomCode};
use nsh_core::element::Root;
use nsh_engine::EngineConfig;
use nsh_testing::{Headless, MemoryStorage};

fn start(stored: &[(&str, &str)]) -> Headless {
    let mut config = EngineConfig::new(Root::of::<cards_app::App>());
    let entries: Vec<(String, String)> = stored
        .iter()
        .map(|(k, v)| ((*k).to_owned(), (*v).to_owned()))
        .collect();
    config.storage = Some(MemoryStorage::new(entries) as Arc<_>);
    let mut app = Headless::start(config).expect("engine starts");
    app.wait_for("text:Create table").expect("home screen");
    app
}

#[test]
fn creating_a_table_needs_a_name_and_joining_needs_a_valid_code() {
    let mut app = start(&[]);
    assert_eq!(app.screen().enabled("label:Create table"), Ok(false));

    app.type_text("id:name", "Cason Adams").unwrap();
    assert_eq!(app.screen().enabled("label:Create table"), Ok(true));
    assert_eq!(app.screen().enabled("label:Join"), Ok(false));

    app.type_text("id:code", "abc23").unwrap();
    assert_eq!(app.screen().enabled("label:Join"), Ok(false));
    app.type_text("id:code", "4").unwrap();
    assert_eq!(app.screen().enabled("label:Join"), Ok(true));
}

#[test]
fn a_saved_name_is_remembered() {
    let app = start(&[("cards.name", "Cason Adams")]);
    assert_eq!(app.screen().enabled("label:Create table"), Ok(true));
}

#[test]
fn a_saved_table_offers_to_resume() {
    let code = RoomCode::parse("ABC234").unwrap();
    let session = HostSession::new(code, PlayerId([7; 32]), "Host", GameKind::OhWell, 4).unwrap();
    let saved = serde_json::to_string(&session).unwrap();
    let app = start(&[("cards.host", &saved)]);
    assert!(app.shows("Resume table ABC234"));
}

#[test]
fn an_unreadable_saved_table_is_reported_and_dropped() {
    let mut app = start(&[("cards.host", "{not json")]);
    app.wait_for("text:Dismiss").unwrap();
    assert!(
        !app.screen()
            .texts()
            .iter()
            .any(|t| t.starts_with("Resume table"))
    );
    assert!(
        app.screen()
            .texts()
            .iter()
            .any(|t| t.contains("could not be read"))
    );
}

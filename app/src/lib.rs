#[cfg(target_arch = "wasm32")]
mod entropy;
mod identity;
mod session;
mod ui;

use nsh_core::prelude::*;

#[native_module("cards/app")]
fn native(registry: &mut Registry) {
    registry.register::<App>();
}

/// The whole app: home screen, waiting room and card table.
#[component]
pub fn App() -> impl IntoElement {
    ui::root(session::Controller::start())
}

pub mod game_bindings;
pub mod net;
pub mod ticket;

use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

pub mod card;
pub mod games;
pub mod trick;

pub use card::{Card, Rank, SeededRng, Suit, create_deck};
pub use games::canadian_salad::CanadianSaladGame;
pub use games::oh_well::OhWellGame;
pub use trick::{TrickPlay, resolve_trick, validate_follow_suit};

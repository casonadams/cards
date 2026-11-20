use std::fmt;

use cards_core::Rng;
use serde::{Deserialize, Serialize};

pub const CODE_LEN: usize = 6;
const ALPHABET: &[u8; 32] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LOBBY_CONTEXT: &str = "cards 2026-11 lobby key v1";
const JOIN_CONTEXT: &str = "cards 2026-11 join proof v1";

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[serde(try_from = "String", into = "String")]
pub struct RoomCode([u8; CODE_LEN]);

impl TryFrom<String> for RoomCode {
    type Error = CodeError;

    fn try_from(text: String) -> Result<RoomCode, CodeError> {
        RoomCode::parse(&text)
    }
}

impl From<RoomCode> for String {
    fn from(code: RoomCode) -> String {
        code.to_string()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CodeError {
    WrongLength { found: usize },
    InvalidCharacter(char),
}

impl fmt::Display for CodeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CodeError::WrongLength { found } => {
                write!(f, "codes have {CODE_LEN} characters, not {found}")
            }
            CodeError::InvalidCharacter(c) => write!(f, "'{c}' is not used in codes"),
        }
    }
}

impl RoomCode {
    pub fn generate(rng: &mut Rng) -> RoomCode {
        let mut code = [0; CODE_LEN];
        for slot in &mut code {
            *slot = ALPHABET[rng.below(ALPHABET.len())];
        }
        RoomCode(code)
    }

    pub fn parse(input: &str) -> Result<RoomCode, CodeError> {
        let chars: Vec<char> = input
            .chars()
            .filter(|c| !c.is_whitespace() && *c != '-')
            .map(|c| c.to_ascii_uppercase())
            .collect();
        if chars.len() != CODE_LEN {
            return Err(CodeError::WrongLength { found: chars.len() });
        }
        let mut code = [0; CODE_LEN];
        for (slot, c) in code.iter_mut().zip(chars) {
            *slot = u8::try_from(c)
                .ok()
                .filter(|b| ALPHABET.contains(b))
                .ok_or(CodeError::InvalidCharacter(c))?;
        }
        Ok(RoomCode(code))
    }

    /// Seed of the signing key whose public half names the room's lookup record.
    pub fn lobby_secret(&self) -> [u8; 32] {
        blake3::derive_key(LOBBY_CONTEXT, &self.0)
    }

    /// Proof that a guest knows the code, bound to both endpoints of one connection.
    pub fn join_proof(&self, host: &[u8; 32], guest: &[u8; 32]) -> [u8; 32] {
        let key = blake3::derive_key(JOIN_CONTEXT, &self.0);
        let mut hasher = blake3::Hasher::new_keyed(&key);
        hasher.update(host);
        hasher.update(guest);
        *hasher.finalize().as_bytes()
    }
}

impl fmt::Display for RoomCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0
            .iter()
            .try_for_each(|&b| write!(f, "{}", char::from(b)))
    }
}

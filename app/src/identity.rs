use std::fmt;

use cards_net::HostSession;
use iroh::SecretKey;
use nsh_core::storage::Storage;

const IDENTITY_KEY: &str = "cards.identity";
const NAME_KEY: &str = "cards.name";
const HOST_KEY: &str = "cards.host";

#[derive(Debug)]
pub enum StoreError {
    Entropy(getrandom::Error),
    StorageFull,
    Encode(serde_json::Error),
    Decode(serde_json::Error),
}

impl fmt::Display for StoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            StoreError::Entropy(e) => write!(f, "no secure randomness available: {e}"),
            StoreError::StorageFull => f.write_str("browser storage is full"),
            StoreError::Encode(e) => write!(f, "could not save the table: {e}"),
            StoreError::Decode(e) => write!(
                f,
                "the saved table could not be read and was discarded: {e}"
            ),
        }
    }
}

fn save(key: &str, value: String) -> Result<(), StoreError> {
    Storage::set_item(key, value).map_err(|_| StoreError::StorageFull)
}

/// This device's long-lived iroh key, so a host or guest is recognised after a reload.
pub fn secret_key() -> Result<SecretKey, StoreError> {
    if let Some(bytes) = Storage::get_item(IDENTITY_KEY)
        .as_deref()
        .and_then(decode_hex)
    {
        return Ok(SecretKey::from_bytes(&bytes));
    }
    let mut bytes = [0; 32];
    getrandom::fill(&mut bytes).map_err(StoreError::Entropy)?;
    save(IDENTITY_KEY, encode_hex(&bytes))?;
    Ok(SecretKey::from_bytes(&bytes))
}

pub fn random_u64() -> Result<u64, StoreError> {
    getrandom::u64().map_err(StoreError::Entropy)
}

pub fn saved_name() -> String {
    Storage::get_item(NAME_KEY).unwrap_or_default()
}

pub fn save_name(name: &str) -> Result<(), StoreError> {
    save(NAME_KEY, name.to_owned())
}

/// The table this device was hosting, if any; Err when the stored copy is unreadable.
pub fn saved_host() -> Result<Option<HostSession>, StoreError> {
    Storage::get_item(HOST_KEY)
        .map(|json| serde_json::from_str(&json).map_err(StoreError::Decode))
        .transpose()
}

pub fn save_host(session: &HostSession) -> Result<(), StoreError> {
    save(
        HOST_KEY,
        serde_json::to_string(session).map_err(StoreError::Encode)?,
    )
}

pub fn forget_host() {
    Storage::remove_item(HOST_KEY);
}

fn encode_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn decode_hex(text: &str) -> Option<[u8; 32]> {
    if text.len() != 64 {
        return None;
    }
    let mut out = [0; 32];
    for (slot, pair) in out.iter_mut().zip(text.as_bytes().chunks(2)) {
        *slot = u8::from_str_radix(std::str::from_utf8(pair).ok()?, 16).ok()?;
    }
    Some(out)
}

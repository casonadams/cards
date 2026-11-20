use std::time::Duration;

use cards_core::Rng;
use iroh::address_lookup::{EndpointInfo, N0_DNS_PKARR_RELAY_PROD, PkarrRelayClient, UserData};
use iroh::{Endpoint, EndpointId, SecretKey};

use super::NetError;
use crate::code::RoomCode;
use crate::guest::reconnect_delay;

const RECORD_TTL_SECS: u32 = 30;
pub const RECORD_REFRESH: Duration = Duration::from_secs(20);
const CLAIM_ATTEMPTS: usize = 5;

/// Maps a room code to the host's endpoint.
pub trait Directory {
    fn publish(
        &self,
        code: RoomCode,
        host: EndpointId,
    ) -> impl Future<Output = Result<(), NetError>>;
    fn resolve(&self, code: RoomCode) -> impl Future<Output = Result<EndpointId, NetError>>;
}

/// Room records signed by a code-derived key on n0's public pkarr relay.
#[derive(Clone, Debug)]
pub struct PkarrDirectory {
    client: PkarrRelayClient,
}

fn lobby_key(code: RoomCode) -> SecretKey {
    SecretKey::from_bytes(&code.lobby_secret())
}

impl PkarrDirectory {
    pub fn new(endpoint: &Endpoint) -> Result<PkarrDirectory, NetError> {
        let url: url::Url = N0_DNS_PKARR_RELAY_PROD
            .parse()
            .map_err(|e: url::ParseError| NetError::Publish(e.to_string()))?;
        #[cfg(all(target_family = "wasm", target_os = "unknown"))]
        let client = {
            let _ = endpoint;
            PkarrRelayClient::new(url)
        };
        #[cfg(not(all(target_family = "wasm", target_os = "unknown")))]
        let client = {
            let dns = endpoint
                .dns_resolver()
                .map_err(|e| NetError::Publish(e.to_string()))?
                .clone();
            PkarrRelayClient::new(url, endpoint.tls_config().clone(), dns)
        };
        Ok(PkarrDirectory { client })
    }
}

impl Directory for PkarrDirectory {
    async fn publish(&self, code: RoomCode, host: EndpointId) -> Result<(), NetError> {
        let key = lobby_key(code);
        let user_data: UserData = host
            .to_string()
            .parse()
            .map_err(|e| NetError::Publish(format!("{e}")))?;
        let packet = EndpointInfo::new(key.public())
            .with_user_data(Some(user_data))
            .to_pkarr_signed_packet(&key, RECORD_TTL_SECS)
            .map_err(|e| NetError::Publish(e.to_string()))?;
        self.client
            .publish(&packet)
            .await
            .map_err(|e| NetError::Publish(e.to_string()))
    }

    async fn resolve(&self, code: RoomCode) -> Result<EndpointId, NetError> {
        let packet = self
            .client
            .resolve(lobby_key(code).public())
            .await
            .map_err(|e| NetError::Lookup(e.to_string()))?;
        let info = EndpointInfo::from_pkarr_signed_packet(&packet)
            .map_err(|e| NetError::Lookup(e.to_string()))?;
        info.user_data()
            .ok_or_else(|| NetError::Lookup("record names no host".into()))?
            .as_ref()
            .parse()
            .map_err(|e| NetError::Lookup(format!("{e}")))
    }
}

/// Picks a code no other host is using and publishes it for `host`.
pub async fn claim_code(
    directory: &impl Directory,
    rng: &mut Rng,
    host: EndpointId,
) -> Result<RoomCode, NetError> {
    let mut last_error = NetError::Publish("no free room code".into());
    for _ in 0..CLAIM_ATTEMPTS {
        let code = RoomCode::generate(rng);
        if directory
            .resolve(code)
            .await
            .is_ok_and(|owner| owner != host)
        {
            continue;
        }
        match directory.publish(code, host).await {
            Ok(()) => return Ok(code),
            Err(err) => last_error = err,
        }
    }
    Err(last_error)
}

/// Republishes the room record before it expires; reports failures and keeps retrying.
pub async fn keep_published(
    directory: &impl Directory,
    code: RoomCode,
    host: EndpointId,
    mut on_error: impl FnMut(NetError),
) {
    let mut failures = 0;
    loop {
        let wait = match directory.publish(code, host).await {
            Ok(()) => {
                failures = 0;
                RECORD_REFRESH
            }
            Err(err) => {
                on_error(err);
                failures += 1;
                reconnect_delay(failures, 1.0).min(RECORD_REFRESH)
            }
        };
        n0_future::time::sleep(wait).await;
    }
}

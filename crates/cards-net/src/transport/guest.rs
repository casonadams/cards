use std::time::Duration;

use iroh::endpoint::{Connection, RecvStream, SendStream};
use iroh::{Endpoint, EndpointId};

use super::frame::{read_frame, write_frame};
use super::{ALPN, Directory, NetError};
use crate::code::RoomCode;
use crate::protocol::{ToGuest, ToHost, decode, encode};

const LEAVE_GRACE: Duration = Duration::from_secs(2);

/// A joined connection to the host, split so sending and receiving can run concurrently.
#[derive(Debug)]
pub struct GuestLink {
    pub host: EndpointId,
    pub sender: GuestSender,
    pub receiver: GuestReceiver,
}

#[derive(Debug)]
pub struct GuestSender {
    connection: Connection,
    send: SendStream,
}

#[derive(Debug)]
pub struct GuestReceiver {
    recv: RecvStream,
}

impl GuestSender {
    pub async fn send(&mut self, message: &ToHost) -> Result<(), NetError> {
        write_frame(&mut self.send, &encode(message)?).await
    }

    pub fn close(&self) {
        self.connection.close(0u8.into(), b"leaving");
    }

    /// Tells the host this player is leaving and lets the message arrive before closing.
    pub async fn leave(mut self) {
        if self.send(&ToHost::Leave).await.is_ok() && self.send.finish().is_ok() {
            let delivered = async {
                let _ = self.send.stopped().await;
            };
            let give_up = n0_future::time::sleep(LEAVE_GRACE);
            n0_future::future::race(delivered, give_up).await;
        }
        self.close();
    }
}

impl GuestReceiver {
    pub async fn recv(&mut self) -> Result<ToGuest, NetError> {
        Ok(decode(&read_frame(&mut self.recv).await?)?)
    }
}

/// Finds the room by code and joins it.
pub async fn join(
    endpoint: &Endpoint,
    directory: &impl Directory,
    code: RoomCode,
    name: &str,
) -> Result<GuestLink, NetError> {
    let host = directory.resolve(code).await?;
    rejoin(endpoint, host, code, name).await
}

/// Joins a host whose endpoint is already known, e.g. after a dropped connection.
pub async fn rejoin(
    endpoint: &Endpoint,
    host: EndpointId,
    code: RoomCode,
    name: &str,
) -> Result<GuestLink, NetError> {
    let connection = endpoint
        .connect(host, ALPN)
        .await
        .map_err(|e| NetError::Connect(e.to_string()))?;
    let (send, recv) = connection
        .open_bi()
        .await
        .map_err(|e| NetError::Connect(e.to_string()))?;
    let mut sender = GuestSender { connection, send };
    let proof = code.join_proof(host.as_bytes(), endpoint.id().as_bytes());
    sender
        .send(&ToHost::Join {
            name: name.to_string(),
            proof,
        })
        .await?;
    Ok(GuestLink {
        host,
        sender,
        receiver: GuestReceiver { recv },
    })
}

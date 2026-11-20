use iroh::endpoint::{RecvStream, SendStream};

use super::NetError;
use crate::protocol::{FrameError, MAX_FRAME_LEN};

pub async fn write_frame(send: &mut SendStream, frame: &[u8]) -> Result<(), NetError> {
    let len = u32::try_from(frame.len())
        .ok()
        .filter(|_| frame.len() <= MAX_FRAME_LEN)
        .ok_or(FrameError::TooLarge { len: frame.len() })?;
    send.write_all(&len.to_be_bytes())
        .await
        .map_err(|e| NetError::Stream(e.to_string()))?;
    send.write_all(frame)
        .await
        .map_err(|e| NetError::Stream(e.to_string()))
}

pub async fn read_frame(recv: &mut RecvStream) -> Result<Vec<u8>, NetError> {
    let mut len = [0; 4];
    recv.read_exact(&mut len)
        .await
        .map_err(|_| NetError::Closed)?;
    let len = usize::try_from(u32::from_be_bytes(len)).unwrap_or(usize::MAX);
    if len > MAX_FRAME_LEN {
        return Err(FrameError::TooLarge { len }.into());
    }
    let mut frame = vec![0; len];
    recv.read_exact(&mut frame)
        .await
        .map_err(|_| NetError::Closed)?;
    Ok(frame)
}

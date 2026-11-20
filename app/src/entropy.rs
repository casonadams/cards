//! Browser entropy for getrandom, which iroh's keys and QUIC need.
//!
//! nsh builds the web runtime with getrandom's "custom" backend and serves
//! `env.__nsh_random_fill` (Web Crypto) from its page script; TSX apps get this
//! hook from nsh-js, Rust-only apps must export it themselves.

#[link(wasm_import_module = "env")]
unsafe extern "C" {
    fn __nsh_random_fill(ptr: *mut u8, len: usize) -> i32;
}

#[allow(unsafe_code)]
#[unsafe(no_mangle)]
unsafe extern "Rust" fn __getrandom_v03_custom(
    ptr: *mut u8,
    len: usize,
) -> Result<(), getrandom::Error> {
    // SAFETY: getrandom passes a writable range of exactly `len` bytes, and the
    // browser fills it synchronously before returning.
    if unsafe { __nsh_random_fill(ptr, len) } == 0 {
        Ok(())
    } else {
        Err(getrandom::Error::UNSUPPORTED)
    }
}

# Vendored crates

## getrandom 0.4.3

Unmodified upstream source except for one added line in `src/error.rs`:
`not(getrandom_backend = "custom"),` in the `cfg` guarding `Error::WEB_CRYPTO`.

Why: nsh 0.6 builds the web runtime with `--cfg getrandom_backend="custom"`, while iroh
enables getrandom's `wasm_js` feature. With both set, getrandom 0.4.3 (and its `master`
as of 2026-11-19) references `Error::WEB_CRYPTO`, which only exists when the custom
backend is *not* selected, so the browser build fails to compile.

The patch is applied through `[patch.crates-io]` in `.cargo/config.toml`.

Upstream will not change this: rust-random/getrandom#840 (the same failure) was closed as
"not planned" on 2026-05-18, since enabling `wasm_js` alongside a custom backend is treated
as a downstream problem. It goes away if iroh stops enabling `wasm_js` on the web or nsh
stops forcing the custom backend; drop this directory and the patch entry then.

# Vendored crates

## getrandom 0.4.3

Unmodified upstream source except for one added line in `src/error.rs`:
`not(getrandom_backend = "custom"),` in the `cfg` guarding `Error::WEB_CRYPTO`.

Why: nsh 0.6 builds the web runtime with `--cfg getrandom_backend="custom"`, while iroh
enables getrandom's `wasm_js` feature. With both set, getrandom 0.4.3 (and its `master`
as of 2026-11-19) references `Error::WEB_CRYPTO`, which only exists when the custom
backend is *not* selected, so the browser build fails to compile.

The patch is applied through `[patch.crates-io]` in `.cargo/config.toml`. Remove this
directory and that entry once a getrandom release fixes the `cfg`.

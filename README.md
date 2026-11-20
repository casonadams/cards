# Cards

Oh Well and Canadian Salad for 3 to 7 players, in the browser, with no server of our own.
Written in Rust: an [nsh](https://nsh.dev) app for the UI and [iroh](https://iroh.computer)
for peer-to-peer networking, hosted statically on GitHub Pages.

## How it works

- **Join with a 6-character code.** The host's browser claims a code such as `ABC234` and
  publishes a short-lived record, signed by a key derived from the code, on n0's public
  pkarr relay. Guests type the code, look up the host and connect through iroh (relayed in
  the browser, encrypted end to end). Inside the connection the guest proves it knows the
  code, bound to both endpoints. Limits: a 6-character code is not a strong secret; the
  record's name is derived from it, so someone collecting record names could recover a
  code with hours of offline guessing while the table is open, and anyone who has the
  code can join an open seat or claim the code. Fine for a card game; do not reuse it for
  anything sensitive.
- **The host is the single source of truth.** Guests send only their moves; the host
  validates them against the rules and answers every change with a numbered snapshot of
  that player's view. Each player receives only their own hand.
- **Drops heal themselves.** Guests reconnect with exponential backoff and get a fresh
  snapshot. If the host leaves or reloads, the game pauses for everyone until the host
  returns (the table is saved in the host's browser and resumes from the home screen).
  The host can let the AI play a disconnected guest's seat until they come back.

## Games

1. **Oh Well (Oh Hell)**: 3-7 players, descending then ascending hand sizes, trump card
   cut, exact bidding with the dealer "hook" rule.
2. **Canadian Salad**: 3-6 players, six hands (No Tricks, No Hearts, No Queens, No King of
   Spades, No Last Trick, Combination); lowest total wins.

## Layout

| Path | What it is |
|---|---|
| `crates/cards-core` | Rules, seeded deal, scoring, per-seat views and the AI. Pure, no I/O. |
| `crates/cards-net` | Room codes, wire protocol, host session, guest state, iroh transport. |
| `app` | The nsh app: home, lobby and table screens, and the session controller. |
| `vendor/getrandom-0.4.3` | One-line patch needed for the web build (see `vendor/README.md`). |

## Development

Tools are pinned in `mise.toml` ([mise](https://mise.jdx.dev)); the Rust toolchain in
`rust-toolchain.toml`. Packaging for the web also needs a wasm-capable `clang` and
`llvm-ar` (on macOS: `brew install llvm`).

```bash
mise install       # nsh and wasm-bindgen-cli
mise run rust      # cargo fmt --check, clippy -D warnings, cargo test
mise run web       # package the web app into dist/Cards
mise run serve     # package and serve at http://127.0.0.1:4173/cards/
mise run all       # every gate plus the web package
```

Pushes to `main` run the gates in CI and deploy `dist/Cards` to GitHub Pages.

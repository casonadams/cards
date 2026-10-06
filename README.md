# Cards &middot; Free P2P Card Game Platform

A zero-database, serverless card game platform powered by **Rust WebAssembly** and **Iroh P2P Gossip Networking**, hosted 100% for free on **GitHub Pages**.

## Highlights

- **Pure Rust Game Engine**: Deterministic rules, seeded PRNG shuffling, trick resolution, and scoring.
- **Iroh P2P Gossip Networking**: Direct peer-to-peer room connections running in the browser via WebAssembly over Iroh's free public relay. Zero centralized database needed.
- **Zero Operating Costs**: Hosted statically on GitHub Pages with $0/month infrastructure cost.
- **Strict Code Quality**: Gated on Cognitive Complexity $\le 15$ (`cccc`), CRAP score $\le 30$ (`cargo-crap`), and 100% Clippy compliance.

## Implemented Games

1. **Oh Well (Oh Hell)**: 3–7 players, ascending/descending card rounds, trump card cut, exact bidding with the "Hook" dealer rule.
2. **Canadian Salad**: 3–6 players, 6 contract rounds (No Tricks, No Hearts, No Queens, No King of Spades, No Last Trick, Combination).

## Development & Checks

```bash
# Run all quality checks (fmt, clippy, test, complexity, CRAP)
make all

# Run test suite
cargo test --workspace

# Evaluate CRAP score threshold
make crap

# Evaluate Cognitive Complexity threshold (<= 15)
make complexity

# Build WASM package
make build-wasm

# Run web frontend locally
cd web
pnpm install
pnpm dev
```

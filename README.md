# Cards &middot; Free P2P Card Game Platform

A zero-database, serverless card game platform powered by **Svelte 5**, **WebRTC Peer-to-Peer DataChannels**, and static hosting on **GitHub Pages**.

## Highlights

- **Direct P2P WebRTC Networking**: Direct encrypted peer-to-peer room connections running in the browser via WebRTC DataChannels. Connect using deterministic 6-letter codes or 1-click invite URLs. Zero centralized database needed.
- **Pure Deterministic Game Engine**: Deterministic rules, seeded PRNG shuffling, trick resolution, and state machine orchestration.
- **Zero Operating Costs**: Hosted 100% statically on GitHub Pages with $0/month infrastructure cost.
- **Strict Code Quality**: Gated on Cognitive and Cyclomatic Complexity (`cccc`), fast AST linting (`oxlint`), strict TypeScript type safety (`svelte-check`), and code intelligence analysis (`ripwire`).

## Implemented Games

1. **Oh Well (Oh Hell)**: 3–7 players, ascending/descending card rounds, trump card cut, exact bidding with the "Hook" dealer rule.
2. **Canadian Salad**: 3–6 players, 6 contract rounds (No Tricks, No Hearts, No Queens, No King of Spades, No Last Trick, Combination).
3. **Rook**: 4-player partnership trick-taking with bids, trump colors, nest exchange, and point scoring.
4. **Regicide**: 1–4 player cooperative boss-battling card combat.

## Development & Quality Checks

```bash
# Run all quality checks and production build
make all

# Run fast AST linting across TypeScript/JS web code
make lint

# Run Svelte and TypeScript type checking
make check

# Enforce Cognitive and Cyclomatic complexity thresholds
make complexity

# Run ripwire code intelligence map and symbol ranking
make ripwire

# Build production distribution for GitHub Pages
make build
```

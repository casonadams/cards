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

## Development & Quality Checks

Tools are pinned in `mise.toml` ([mise](https://mise.jdx.dev)).

```bash
# Install the pinned tools and web dependencies
mise install
mise run install

# Run all quality checks and production build
mise run all

# Run fast AST linting across TypeScript/JS web code
mise run lint

# Run Svelte and TypeScript type checking
mise run check

# Run unit tests (and `mise run e2e` for Playwright)
mise run test

# Enforce Cognitive and Cyclomatic complexity thresholds
mise run complexity

# Run ripwire code intelligence map and symbol ranking
mise run ripwire

# Start the dev server, or build production distribution for GitHub Pages
mise run dev
mise run build
```

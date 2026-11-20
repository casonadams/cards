# Cards Repository Rules & Standards

## Architecture
- `crates/cards-core`: deterministic game rules, seeded deal, scoring, per-seat views (`SeatView`) and the AI. No I/O, no UI or network types. The AI decides only from a `SeatView`, never from hidden hands.
- `crates/cards-net`: room codes, versioned postcard protocol, `HostSession` (host-authoritative, serializable for resume) and `GuestState` (pure state machines), plus the iroh transport in `transport/`. Keep session logic transport-free so it stays testable in memory.
- `app`: the nsh 0.6 Rust app. `session/` is the only place that runs networking; screens in `ui/` read `Controller` signals and send `Intent`/`Command`s. Pure UI logic (stat lines, slot math, standings) lives in `ui/table/model.rs` with unit tests.
- The host is the single source of truth: guests send `ToHost::Act`, the host answers with a numbered full `Snapshot` per seat. Never send another seat's cards to a guest.
- When the host leaves or reloads, the game pauses for everyone until the host resumes; do not add host migration.

## nsh pitfalls
- Signals may only be touched on the engine thread. Network futures run in `spawn` (engine thread); data from other tasks (e.g. iroh protocol handlers) must come through a channel.
- A `spawn`ed task ends with the component that created it. Long-lived session tasks run under the root `App` (`Controller::start`).
- Do not race (`n0_future::future::race`) a future that is not cancel-safe, such as reading a QUIC frame; read in its own task and forward over a channel.
- Never name a function `view` inside the UI: it shadows nsh's `view()` builder.
- Run clippy with `--color never` (or check the exit code); colored output hides `^error` from grep.
- Web builds need the vendored getrandom patch (`vendor/README.md`) and `app/src/entropy.rs`.

## UX & UI Design Rules

### Cards and the hand
- Card faces: a bold rank glyph centered on every card (`2`-`10`, `J`, `Q`, `K`, `A`), corner rank+suit indices, no suit watermark.
- Fanned hands stack left to right (z order rising), so each card covers the right edge of the previous one. Put penalty points (`+10`, `+25`, `+100`) and the Oh Well trump `T` badge in the bottom-left corner, which stays visible; keep the top-right clean.
- Only playable cards lift on hover. Unplayable cards stay seated and use a solid, opaque muted background; never put opacity below 1 on cards in a fanned hand (overlaps brighten and indices bleed through).
- The hand container has a fixed height and never collapses when the last card is played; show a quiet `All cards played` placeholder the height of a card.
- Measure the hand's width: cards that fit sit centered with small gaps; otherwise overlap with step `(avail - card_w) / (count - 1)` to span the full width between the side paddings (8 points compact, 16 otherwise).
- During bidding the real hand stays visible in a non-interactive inspection state; card presses must never dispatch plays outside the playing phase.

### Table flow
- Embed phase transitions (bidding console, round summary) in the table between the trick area and the hand, not as full-screen modals. Only final standings may take over the screen, and only after the player presses `View final standings ->`.
- The bidding console shows who bids first and leads trick 1 (`1st bid & lead`) and who is the dealer (`Dealer (bids last)`), and explains a disabled hook bid.
- When a round ends, keep the final trick on the felt with the winner callout and dock the round summary beneath it.
- Anything dialog-like must fit 375x560 and scroll inside when needed.

### Top bar, seats and trick area
- One top bar only: game name, round label, trump mini card (white card, dark border, rank and colored pip) or Canadian Salad penalty badge, a collapsible rules drawer, and the leave controls.
- The turn indicator (`YOUR TURN - PLAY A CARD` / `- BID`) is absolutely positioned over the top of the trick area with zero flow height, so turn changes never shift layout.
- The trick area has a fixed height and one fixed slot per seat. Cards land in their slot and never move while the trick fills. Empty slots are dashed placeholders at z-index 0; played cards sit at 10 + slot. Trick cards are never smaller than hand cards, and each name pill is no wider than its card (first name only).
- Seats stay in fixed seat order. Each badge has an order number 1..N anchored to the avatar: 1 is the trick leader (first bidder for bidding and trick 1, then the last trick's winner), never whoever is acting; the acting seat's badge is highlighted in emerald.
- Badge dimensions never change with state: fixed border widths, fixed font weight, color-only transitions.
- Compact stat lines with monospace digits: Canadian Salad `{tricks}t | {total}p`, Oh Well `{bid} | {total}p`.
- Names allow 20 characters. Avatars show first+last initials (`Cason Adams` -> `CA`); seats show the first name (`John Doe` -> `John`) except bots (`Bot Bob`).
- Selection chips (game, table size) keep identical dimensions selected or not.
- Compact layout applies when the window is under 520 points wide or tall (phones in either orientation).

## Quality Tooling & CI/CD Pipeline
- **mise** (`mise.toml` pins nsh 0.6.0 and wasm-bindgen-cli 0.2.130; Rust comes from `rust-toolchain.toml`):
  - `mise run rust`: `cargo fmt --check`, `cargo clippy --workspace --all-targets -D warnings`, `cargo test --workspace`. Clippy enforces `cognitive_complexity` and `too_many_lines`.
  - `mise run web`: packages the app into `dist/Cards` (needs a wasm-capable clang/llvm-ar); `mise run serve` serves it at `http://127.0.0.1:4173/cards/`.
  - `mise run all`: every gate plus the web package.
  - `mise run ripwire`: code intelligence and symbol ranking via `ripwire crates app/src --top-k=30`.
- **GitHub Actions (`deploy.yml`)**: every push and pull request runs `mise run rust` and packages the web app; pushes to `main` deploy `dist/Cards` to GitHub Pages.

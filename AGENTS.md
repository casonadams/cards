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
- `ElementRef::measure()` answers with the layout of the next commit: measure a newly created element only after `next_frame().await`, and never make a game action wait on a measurement (no commit may follow, and the action would never be sent).
- Each `transition_*` call replaces the previous one; use `transition_all()` to transition several groups. Card motion uses `AnimatedValue`s (`table/motion.rs`) instead.
- A hover lift must move a child, never the hovered element itself (`group()` + `group_hover`), or the card slides out from under the pointer and flickers.

## UX & UI Design Rules

### Cards and the hand
- Card faces: a bold rank glyph centered on every card (`2`-`10`, `J`, `Q`, `K`, `A`), corner rank+suit indices, no suit watermark.
- Fanned hands stack left to right (z order rising), so each card covers the right edge of the previous one. Put penalty points (`+10`, `+25`, `+100`) and the Oh Well trump `T` badge in the bottom-left corner, which stays visible; keep the top-right clean.
- Only playable cards lift on hover. Unplayable cards stay seated and use a solid, opaque muted background; never put opacity below 1 on cards in a fanned hand (overlaps brighten and indices bleed through).
- The hand container has a fixed height and never collapses when the last card is played; show a quiet `All cards played` placeholder the height of a card.
- Measure the hand's width: cards that fit sit centered with small gaps; otherwise overlap with step `(avail - card_w) / (count - 1)` to span the full width between the side paddings (8 points for small cards, 16 otherwise).
- A one-line header above the hand tells the viewer where they stand: Oh Well `You bid B, won W: need N more` / `on target, avoid winning more` / `over by N` / `can no longer make it` (or how many to bid); Canadian Salad `You: T tricks taken, +P this hand`.
- During bidding the real hand stays visible in a non-interactive inspection state; card presses must never dispatch plays outside the playing phase.

### Table flow
- The table always fits one screen with no page or section scroll, on phones in either orientation and on desktops (`table/layout.rs`, tested per screen size and seat count). Cards size from the window: trick and hand cards share one size, between 60 and 150 points tall (48 on landscape phones), small enough that a full trick shows at least 60% of each card.
- Phase transitions stay on the table, never full-screen modals. While bidding, the viewer's bid buttons sit on the empty felt and explain a disabled hook bid; bids already placed show on the seat chips. When a round ends, the final trick stays on the felt with its winner message and the round summary takes the hand's place (the summary alone may scroll inside). Only final standings take over the screen, after the player presses `Final standings ->`.
- Home and lobby use one or two form columns (two when each stays at least 300 points wide, 250 in landscape) and fit common phones without scrolling; scrollbars stay hidden.

### Top bar, seats and trick area
- One fixed-height top bar: the round label (`Round 4 of 19`, `Hand 2 of 6: No Hearts`), the trump mini card (white card, dark border, rank and colored pip) or Canadian Salad penalty badge, and a `Menu` button whose drawer holds the rules and the leave controls. Paused and error notices float over the top of the table instead of pushing it down.
- The trick area has a fixed height and one fixed slot per seat, in seat-strip order. Cards land in their slot and never move while the trick fills. Empty slots are dashed placeholders at z-index 0; played cards sit at 10 + play order. Trick cards are never smaller than hand cards, and each name pill is no wider than its card (first name only).
- Card motion (`table/motion.rs`): a played card flies into its slot from where it sat in the hand (local player) or from the player's seat badge (420ms). A won trick then pauses 500ms, gathers to the centre in a slight fan (700ms), holds 250ms, and flies into the winner's seat badge, shrinking and fading (750ms); the host's AI waits 2.4s after a trick so the collection finishes first. The final trick of a round is not collected: it stays on the felt with the round summary docked beneath. Cards already on the felt never replay their entrance (keyed by round and card).
- One status row sits over the top of the trick area with zero flow height and shows a single message: `YOUR TURN - BID`, `YOUR TURN - LEAD ANY CARD`, `YOUR TURN - FOLLOW {suit}`, `YOUR TURN - NO {suit}, PLAY ANY CARD`, `YOU WON THE TRICK - YOUR LEAD`, `{Name} won the trick!`, `{Name} is bidding...` or `Waiting for {Name}...`.
- The led card is marked: an amber border, and its name pill is amber and reads `{Name} led`.
- Seats stay in fixed seat order, in one row of equal-width chips that never wraps: avatar beside the text on wide or short windows, above it on narrow ones. Each badge has an order number 1..N anchored to the avatar: 1 is the trick leader (first bidder for bidding and trick 1, then the last trick's winner), never whoever is acting; the acting seat's avatar shows a ping halo and its number pulses in emerald.
- Badge dimensions never change with state: fixed border widths, fixed font weight, color-only transitions.
- Chip stats in monospace digits: a coloured headline and the running total. Oh Well `{won}/{bid}` (amber while short, emerald on target, red when over or unreachable, `bid ?` before bidding); Canadian Salad `{tricks}t +{points}` this hand (red once points are taken). During bidding a tag names who leads and who deals; otherwise tags show `away` or `AI`.
- Names allow 20 characters. Avatars show first+last initials (`Cason Adams` -> `CA`); seats show the first name (`John Doe` -> `John`) except bots (`Bot Bob`).
- Selection chips (game, table size) keep identical dimensions selected or not.

## Quality Tooling & CI/CD Pipeline
- **mise** (`mise.toml` pins nsh 0.6.0 and wasm-bindgen-cli 0.2.130; Rust comes from `rust-toolchain.toml`):
  - `mise run rust`: `cargo fmt --check`, `cargo clippy --workspace --all-targets -D warnings`, `cargo test --workspace`. Clippy enforces `cognitive_complexity` and `too_many_lines`.
  - `mise run web`: packages the app into `dist/Cards` (needs a wasm-capable clang/llvm-ar); `mise run serve` serves it at `http://127.0.0.1:4173/cards/`.
  - `mise run all`: every gate plus the web package.
  - `mise run ripwire`: code intelligence and symbol ranking via `ripwire crates app/src --top-k=30`.
- **GitHub Actions (`deploy.yml`)**: every push and pull request runs `mise run rust` and packages the web app; pushes to `main` deploy `dist/Cards` to GitHub Pages.

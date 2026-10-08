# Cards Repository Rules & Standards

## UX & UI Design Rules

### CSS Layering & Tailwind Precedence
- Never define unlayered CSS resets (such as `* { margin: 0; padding: 0; }`) in HTML `<style>` tags or unlayered stylesheets. In CSS Cascade Layers, unlayered declarations override all `@layer utilities` regardless of specificity, breaking Tailwind layout classes.
- Consolidate design tokens inside `@theme` in `app.css`. Do not maintain parallel, conflicting CSS custom properties in `index.html`.

### Card Hand & Fanning Conventions
- In fanned hands with left-to-right stacking (`z-index` increasing left to right), each card overlaps the right edge of the preceding card. Never place critical status badges (penalties, points, trump marks) on the top-right corner alone; anchor them along the exposed top-left rail.
- Visually distinguish Aces from regular number cards (2-10). Do not render identical oversized center suit glyphs on number cards; show crisp rank numerals with subtle suit watermarks.
- Scope hover and focus elevation to playable cards (`.card-hand-slot.is-playable:hover`). Disabled and unplayable cards must remain seated and subdued (no translation).
- Never apply container opacity (`opacity < 1`) to cards in fanned hands. Translucent card backgrounds cause additive overlap brightening (white capsule stripes) and ghosted bleed-through of the underlying card's rotated indices. Unplayable cards must use solid opaque muted backgrounds (e.g. `bg-slate-200 border-slate-300 text-zinc-700`).
- Horizontal scroll containers (`overflow-x-auto`) must not use `mx-auto` or `justify-center` on overflowing children (`w-max`), as CSS centering clips the left edge and prevents scrolling back to initial items. Use `inline-flex min-w-full justify-start sm:justify-center px-4`.

### In-Table Flow vs Blocking Overlays
- Prefer embedding phase transitions (such as bidding consoles and round-end summaries) directly in the tabletop arena between the trick area and the hand rather than full-screen blackout modals.
- During bidding, keep the player's real hand visible at the bottom of the table with full trump highlights and indices; do not build duplicate hand displays inside detached modals.
- Hand cards during non-playing phases (such as bidding) must remain in a non-interactive inspection state (`inspection={true}`, `playable={false}`, `pointer-events-none`, `disabled`, and `onclick={undefined}`). Players must never be able to click or dispatch card play actions during bidding, which breaks engine round state machines.
- Bidding consoles must explicitly display who bids first and leads trick 1 (`🎯 1st Bid & Lead`) versus who is the dealer (`Dealer (bids last)`), and annotate player bid chips with matching role tags so players can calculate their contract strategy.
- When a round completes, keep the final trick visible on the felt playing area (`TrickArea` showing `lastCompleteTrick`) with the winner callout, docking the round score summary beneath it so players can review the final trick outcome.
- Reserve full-screen celebratory modals exclusively for final match conclusions (`GameOverOverlay`).
- Modal dialogs and overlays that are used must fit viewports down to 576px height and 375px width with `max-h-[92vh]` and scrollable bodies.
- Decorative accent bars placed at the top of rounded cards must explicitly specify matching rounded top corners (`rounded-t-lg`, `rounded-t-xl`) to prevent subpixel corner clipping artifacts.

### Header & Footer Vertical Conservation
- Never stack multiple sub-header bars above the game table. Consolidate title, round counter, round rules trigger, and trump/contract metadata into the single top navigation bar (`NavBar`) with a collapsible rules drawer.
- Position active turn notifications directly in the focal transition zone between the played trick arena and the player's hand (`● YOUR TURN — PLAY A CARD` with glowing emerald border and animated pulse). Anchor the notification absolutely (`position: absolute` with zero flow height) to the top seam of the hand container rather than inserting a dynamic block into the flex flow; dynamic flow insertion alters parent flex heights and causes jarring Cumulative Layout Shift (CLS) / screen bouncing every time turns change.
- When displaying cut cards establishing trump in the navbar, render a distinct mini playing card badge (solid white background, dark border, rank numeral, and suit-colored pip) rather than plain text.
- Focal play areas (trick arena) must render cards at prominent scale (`size="md"`), never smaller than inactive hand cards.
- Trick fade-out animations must remain concise (1.5s to 2.0s) so completed tricks do not obscure subsequent lead plays.
- Active player turn indicators must use a dual-span structure (a stationary solid dot over an animated ping pulse), avoiding erratic border scaling artifacts from isolated `animate-ping` elements.
- Avatar initials must split on whitespace (e.g. `Bot Bob` -> `BB`, `Bot Carol` -> `BC`), preventing identical multi-bot initials (`BO`).
- Button selection groups (such as Table Size and Game Selector) must maintain stable dimensions between selected and unselected states without text wrapping shifts or layout jumps.

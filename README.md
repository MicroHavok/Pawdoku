# Rydoku

Offline logic puzzle: one Ry per row, column and color region; Rys can't touch (incl. diagonally).
Runs 100% on-device. No accounts, no ads, no network calls. Sizes 5x5 to 14x14.

## Files
- `dist/` – the installable app (upload this folder as-is)
- `engine.js` – generator, uniqueness validator, logic solver/grader
- `src/app.html` + `build.js` – source; `node build.js` rebuilds `dist/index.html`

## Install on phones (one-time host, then fully offline)
Service workers require HTTPS, so host `dist/` once on any static HTTPS host
(GitHub Pages, Cloudflare Pages, Netlify, or your own web server). Nothing runs server-side.

- **Android (Chrome):** open the URL → ⋮ menu → *Install app* / *Add to Home screen*.
- **iPhone (Safari):** open the URL → Share → *Add to Home Screen*.

Open it once online so it caches; after that it works in airplane mode.
Progress/stats are stored locally on each phone.

## Controls
Tap = X · swipe = X many (start on an X to erase) · double-tap or long-press = Ry ·
Hint explains the next deduction · Reveal places one correct Ry · Undo · Clear X's.

## Engine
1. Random valid cat layout (1 per row/col, non-touching).
2. Grow n contiguous color regions from those cats.
3. Exact solver (propagation + most-constrained-unit branching) checks for a 2nd solution;
   regions are reshaped until the solution is unique.
4. Human-style solver must solve it with pure logic (no guessing); techniques graded:
   L1 singles · L2 "all candidates attack this cell" · L3 k-regions-in-k-rows/cols · L4 short forcing chains.
5. Hard/expert targets are reached by hill-climbing region shapes while keeping uniqueness.
6. `validate()` re-checks uniqueness + logic-solvability before any puzzle is shown.

Modes: Levels (sizes ramp 5→12), Quick play (any size/difficulty, 14x14 = extra hard), Daily puzzle.
Settings: Hearts (3 mistakes) or relaxed mode, auto-X, conflict outline, vibration, theme.

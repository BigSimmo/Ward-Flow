# F06 Network workspace correction r28

Date: 2026-09-13  
Scope: `src/components/ward-management/ward-management-network.module.css` only

## Evidence and diagnosis

I viewed all six supplied `network-workspace-app-{390,820,1440}-{light,dark}-r28.png` captures at original detail and read `F06-network-workspace-visual-review-r28.md`.

- The 1440 px P1 came from `.networkGrid` requiring `13.5rem + minmax(38rem, 1fr) + 23rem` in addition to gaps inside the already-mounted desktop rail. That minimum exceeded the route's available inline size and put the shortlist beyond the viewport.
- The large apparently empty constellation was not an absent-data state. The default grid stretch made `.canvasPanel` as tall as the much longer queue/shortlist row; its flexing `.canvas` then vertically centred the real service columns below the initial viewport.
- The light-theme table header, priority note, selected queue row, and selected detail card inherited legacy `--surface-subtle` / `--clinical-accent-soft` palette roles rather than the third-edition route's resolved canonical roles.

## Correction

- `.networkGrid` now uses `13.5rem minmax(0, 1fr) minmax(20rem, 23rem)`. The middle diagram takes only available space, the shortlist retains a useful bounded width, and its existing `.tableScroll` remains the local overflow owner.
- The collapsed-shortlist variant likewise changes its diagram track from `minmax(38rem, 1fr)` to `minmax(0, 1fr)`.
- `.networkGrid { align-items: start; }` stops the long queue from stretching the diagram and shortlist panels. The existing canvas minimum height and its full node population remain unchanged.
- Network-local aliases now resolve surfaces, ink, muted text, accent, and good/warn/danger roles through `--surface-2`, `--ink`, `--muted`, `--accent*`, `--good*`, `--warn*`, and `--danger*`. Existing high-contrast border restoration remains unchanged.

The existing 80 rem single-column breakpoint, phone layout, shortlist table scroller, all queues, controls, candidates, gates, selection state, links, callbacks, print rules, and engine derivations are untouched.

## Source evidence

- Before snapshot: `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-network-workspace-r28/ward-management-network.module.css`
- Before SHA-256: `0C1361C8081181B586140A9A0E0FC43F4723A20B36152A858DC3038966EF315F`
- After SHA-256: `9BCB0CC26A7F649C0D0B503D1580B365F99024DE48ACA464254AB890059EC394`
- Formatting: `node_modules/.bin/prettier.cmd --write src/components/ward-management/ward-management-network.module.css` completed; the formatter made no further change.

Tests and browser checks were not run by instruction. The P1 width correction, initial diagram visibility, and light-theme palette require the controller's fresh served captures before visual closure.

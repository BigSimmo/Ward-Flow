# 11 Nov 2026, Performance audit fixes (PR #1624)

Changed on top of `main` at `5b08a5e`: ward `/ward-flow/ward/rph-adult-secure` raised 613.8 to 614.6. The raise is under 1 KB, within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured locally (production build with `npm run build`, as CI): ward 614.2 KB. The new limit is the measurement plus 0.4.

Why it changed: the ward screen's heavy figures (capacity, bed states, occupancy, breakdown, roster and form alerts) moved into a memoised hook, `ward/use-ward-screen-figures.ts`, so they are no longer recomputed on every render. The shared shell also gained a small freshness context so unchanged polls stop redrawing the app. Both add a few hundred bytes.

Trim tried: the hook is needed on the first render of the ward screen, so lazy loading would only delay it. No other safe trim was found.

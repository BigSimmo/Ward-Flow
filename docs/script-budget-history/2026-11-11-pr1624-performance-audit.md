# 11 Nov 2026, Performance audit fixes (PR #1624)

Changed on top of `main` at `5b08a5e`: ward `/ward-flow/ward/rph-adult-secure` raised 613.8 to 614.6. The raise is under 1 KB, within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured locally (production build with `npm run build`, as CI): ward 614.2 KB. The new limit is the measurement plus 0.4.

Why it changed: the ward screen's heavy figures (capacity, bed states, occupancy, breakdown, roster and form alerts) moved into a memoised hook, `ward/use-ward-screen-figures.ts`, so they are no longer recomputed on every render. The shared shell also gained a small freshness context so unchanged polls stop redrawing the app. Both add a few hundred bytes.

Trim tried: the hook is needed on the first render of the ward screen, so lazy loading would only delay it. No other safe trim was found.

## After merging `main` at `35c7ccd`

Main has since raised its own limits. This PR now keeps main's values for every screen except the ward, which goes from main's 614.1 to 614.8 (0.7 KB, within the 5 KB allowance). An earlier 0.2 KB raise to three screens is withdrawn.

Measured locally with `npm run build` and `node scripts/check-script-budget.mjs --write`, main alone against this PR merged with main: the ward screen is 613.91 KB on main and 614.39 KB with this PR (+0.47 KB, the memoised figures hook). Every other phone screen is the same or about 0.06 KB smaller with this PR. The sign-in start helper keeps a Ward Flow copy so the ward's first load does not carry the front door's signing code.

Later the same day `main` raised its limits again (last at `daacf21`). This PR keeps main's values and adds only its own ward change on top: 616.8 to 617.5 (+0.7 KB, as above).

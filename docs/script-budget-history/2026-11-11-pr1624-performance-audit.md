# 11 Nov 2026, Performance audit fixes (PR #1624)

Changed on top of `main` at `5b08a5e`: ward `/ward-flow/ward/rph-adult-secure` raised 613.8 to 614.6. The raise is under 1 KB, within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured locally (production build with `npm run build`, as CI): ward 614.2 KB. The new limit is the measurement plus 0.4.

Why it changed: the ward screen's heavy figures (capacity, bed states, occupancy, breakdown, roster and form alerts) moved into a memoised hook, `ward/use-ward-screen-figures.ts`, so they are no longer recomputed on every render. The shared shell also gained a small freshness context so unchanged polls stop redrawing the app. Both add a few hundred bytes.

Trim tried: the hook is needed on the first render of the ward screen, so lazy loading would only delay it. No other safe trim was found.

## Second raise, after merging `main` at `a5d880c`

Raised `/ward-flow` 575.4 to 575.6, `/ward-flow/referrals` 583.6 to 583.8 and `/ward-flow/capacity` 654.3 to 654.5 (0.2 KB each, within the 5 KB allowance).

Measured locally with `npm run build` and `node scripts/check-script-budget.mjs --write`, main alone against this PR merged with main: every phone screen grows by 0.07 to 0.09 KB from the shared freshness context and sign-in start helper (ward 0.61 KB, statistics 0.14 KB for their own hooks). Main alone already sits within 0.1 KB of these three limits (575.32, 583.56 and 654.23 KB), so the shared growth tips them over: this PR measures 575.41, 583.63 and 654.30 KB. CI could not build main alone to compare (its worktree build failed to parse `instrumentation-client.ts`), so it counted all of it against this PR.

Trim tried: the freshness context is what stops unchanged polls redrawing the app, so removing it would undo the fix.

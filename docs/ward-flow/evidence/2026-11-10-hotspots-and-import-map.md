# Change hotspots and import map, 10 November 2026

Tier 7 plan items M142 and M139 (first slices, approved by Josh). Baseline: `main` at `29352cd0`,
measured in a cloud checkout on 10 November 2026. Read-only: no network, provider or build.

## The answer first

- **The history here is shallow.** The checkout holds only 7 to 10 November 2026. The hotspot
  counts below cover about three days, not 90, so treat the order as a hint. A full-history run
  needs Josh's yes to download history, or a CI run.
- **There is no import cycle today.** The plan's "one 7-file cycle" was a measuring error: the
  scratch script counted TypeScript type queries such as `import("./referral-submission").T` (in
  `ward-model.ts` and `ward-model-movement-parts.ts`) as imports. They are types and vanish at run
  time. `tests/architecture-boundaries.test.ts` already proves no runtime cycle, and the new guard
  freezes that at zero.
- **The kit and `src/lib` import no ward code, and live code imports no mockup.** Both are now
  guarded at zero.
- **Screen folders import each other 564 times**, across 235 folder pairs (shell folders apart).
  That figure is frozen: it may only fall.

## M142: change hotspots

Command: `node scripts/ward-flow/hotspots.mjs --top 20` (defaults: last 90 days, `src` and
`backend`, non-merge commits, tests left out). Score is commits times current lines.

Result: 348 non-merge commits counted, 7 November 21:09 UTC to 10 November 05:34 UTC; 567 files
ranked. **Shallow history: 6 grafted boundary commits left out.** A grafted commit "adds" every
file, so counting it would add one change to every file.

| Rank | File                                        | Commits | Lines | Score  |
| ---- | ------------------------------------------- | ------- | ----- | ------ |
| 1    | `ward-flow-reducer.ts`                      | 10      | 2,556 | 25,560 |
| 2    | `ward-flow-events.ts`                       | 9       | 2,750 | 24,750 |
| 3    | `coordinator/shortlist-panel.tsx`           | 7       | 2,850 | 19,950 |
| 4    | `handover/handover-page.tsx`                | 13      | 1,498 | 19,474 |
| 5    | `discharges/discharge-board.tsx`            | 11      | 1,500 | 16,500 |
| 6    | `ward-flow-storage-validation.ts`           | 11      | 1,490 | 16,390 |
| 7    | `coordinator/coordinator-screen.tsx`        | 15      | 1,006 | 15,090 |
| 8    | `movements/movements-screen.tsx`            | 10      | 1,476 | 14,760 |
| 9    | `shell-next/next-rail-body.tsx`             | 9       | 1,500 | 13,500 |
| 10   | `delays/delays-board.tsx`                   | 9       | 1,498 | 13,482 |
| 11   | `help/ward-help-content.ts`                 | 9       | 1,431 | 12,879 |
| 12   | `ward/ward-screen.tsx`                      | 5       | 2,567 | 12,835 |
| 13   | `bed-meeting/bed-meeting-agenda-screen.tsx` | 10      | 1,223 | 12,230 |
| 14   | `settings/settings-screen.tsx`              | 8       | 1,476 | 11,808 |
| 15   | `patients/patient-now-screen.tsx`           | 7       | 1,473 | 10,311 |

All paths are under `src/components/ward-management/`. The most-changed file is
`coordinator/coordinator-screen.tsx` (15 commits). `backend/ward-flow/postgres.mjs` (3,238 lines)
ranks 25th with 2 commits.

**Differences from the plan's table.** The plan's scratch count gave higher commit numbers (for
example the reducer at 17, not 10). It most likely counted the grafted snapshots as changes. The
top three files are the same, so the M141 order does not change: the reducer, the event list and
the shortlist panel first.

## M139: import map

Command: `node scripts/run-tsx.mjs scripts/ward-flow/import-map.ts` (add `--json` or `--check`).
It walks the same runtime graph as `tests/architecture-boundaries.test.ts`: `src/` only,
type-only imports left out.

- 1,803 files, 9,392 runtime imports.
- Files per layer: screens 1,032, ward root 349, shell 121, other components 100, routes 89,
  kit 63, `src/lib` 29, mockups 17.
- Largest flows: screens to the ward root 2,835, screens within or between screen folders 2,479
  (564 of them between different folders), ward root to ward root 915, screens to the kit 513.
  The ward root imports screen folders 165 times (engine slices that live in screen folders).
- Most imported: the kit `wf/index.ts` (602 importers), `ward-clock.ts` (461),
  `ward-flow-provider.tsx` (292), `ward-sites.ts` (182), `shell/ward-access-store.ts` (167).
- Cycles 0. Kit or `src/lib` into ward code 0. Live code into mockups 0.

**Frozen baseline** (`scripts/ward-flow/import-map-baseline.json`, checked by
`tests/ward-import-map-guard.test.ts`): no cycle, no kit or `src/lib` import of ward code, no live
import of a mockup, and no more than 564 screen-to-screen imports. Lower the count with
`--update-baseline` when a split removes imports; it refuses to raise it.

## M149: mockups

`tests/ward-mockup-production-guard.test.ts` names the two mockup families
(`ward-flow-redesign`, `ward-flow-digest`) with a reason each, and proves both refusals in
production: the proxy answers 404, and the family's own layout or route answers 404 too. It fails
on a new family, a mockup page outside a guarded layout, a route handler without its own check, a
mockup route outside `src/app/mockups`, or a new mockup file in `public/`.

**Note for Josh.** `public/capacity-table-mockup.html` and `public/referral-board-mockup.html`
are served in production on purpose (12 October review, A4-7): static HTML, noindexed. The test
keeps that list exact rather than blocking them.

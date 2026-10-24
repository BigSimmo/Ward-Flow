# Page Wiring and Bundle Budget

_Updated 2026-10-24 - navigation file reference matches current source; Documentation owns._

## Current Ward Flow wiring and browser proof

Follow the [Ward entry point](../ward-flow/README.md), current source and accepted app.
Navigation is defined by `src/components/ward-management/ward-nav.ts` and rendered by the shell
in `src/components/ward-management/shell/` (for example `ward-rail.tsx`); routes live in
`src/app/ward-flow/`.
Every offered action must work, or expose its unavailable reason accessibly. Preserve focus,
keyboard use and status meaning; do not copy a foreign route catalogue or widen lint exemptions.

For a new route, wire it into the actual role navigation and verify its reachable URL and
interaction. Use the [screen map](../ward-flow/SCREEN-MAP.md), selected route/nav tests and
affected browser journey. Ward's `chromium-mockups` project is used by
`npm run test:e2e:ward-journeys`; its prototype path does not make the required selected browser
proof advisory. The [public CI policy](../ward-flow/PUBLIC-CI.md) and actual workflow define
the selected gate. Declaration, local result and hosted result remain separate evidence.

Before browser work, run `npm run ensure`, use the printed URL and verify `/api/local-project-id`
identifies the intended project/worktree/runtime. Screenshots alone do not prove controls;
exercise relevant interactions. For visual exploration follow Fast Preview; retain the
selected production-stage checks when integration/release validation is commissioned.

## Build output and bundle claims

The bundle-budget incident below belongs to the former PsychSift repository. Its absent
catalogues, routes and checker are not a current Ward gate; do not claim those budgets passed.
For current bundle/build measurements, inspect the actual Ward build command and attribution
before making a budget claim. Build identity and inputs must match the result being reported.

Do not delete a preview's `.next` output as a routine measurement step. Use an owned isolated
build run and output path accepted by `next.config.ts` (`.next-playwright/<run-id>/dist` via
`NEXT_DIST_DIR`), or a separate owned build worktree. Check process/output ownership first,
keep the preview intact, and clean only the validated run directory after its processes stop.
The existing Playwright wrapper manages its own isolated build output; inspect its contract
instead of inventing a second cleanup procedure.

The older PsychSift wiring and bundle procedure that used to follow is kept in Git history (commit `cac245b`). It does not describe current Ward Flow routes or budgets.

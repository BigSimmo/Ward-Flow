# Task 1 shared foundation and shell review — revision 1

Review scope: independent source/spec review of the controller-owned Ward bar, rail and shell-test changes, plus the Task 1 primitive/statistics-frame report and diff. The Hub implementation itself is excluded from the independence claim. Post-change browser captures and computed-style acceptance are still pending.

App HEAD reviewed: `1ef9ed3975078b789e9b5d70b3f000c64edc3809` with uncommitted controller and worker changes present.

## Finding requiring correction before visual acceptance

### P1 — Rebuilt screens do not reach the single ground painter

**Trigger.** A rebuilt route emits `data-ward-design="third-edition"` and composes the canonical tokens on its screen root, as Hub currently does, while the ancestor `WardGround` remains the legacy `.shell` in `ward-shell.module.css`.

**Evidence.** `hub.module.css:1-2` supplies canonical variables only on the descendant `.screen`. `ward-shell.module.css:19-22` paints the ancestor with `background: var(--ward-ground)` from legacy `wardTokens`. CSS custom properties do not inherit from a descendant to its ancestor, so the canonical `--ground` material cannot affect that painter. The controller's exact pre-correction captures show the resulting white ground rather than the drawing's ground geometry.

**Impact.** The rebuilt panels lose the intended separation from the page ground. This is a material mismatch with the authoritative third-edition drawing and weakens the shared surface hierarchy even though route behavior remains intact.

**Smallest scoped correction.** Keep `WardGround` as the only visible ground surface. When `.shell` contains a rebuilt marker, make its legacy background transparent; make the rebuilt screen root paint canonical `--ground` (including any approved geometry/gradient) and cover the route area. Leave the existing `.shell` background unchanged when no rebuilt marker is present, so untouched screens retain their inherited palette. Preserve the existing print contract by resetting both the marked shell state and the rebuilt root to `Canvas`/white in print. A marker-scoped `.shell:has([data-ward-design="third-edition"])` branch plus the screen-root background is a suitably narrow implementation if the supported browser matrix permits `:has()`.

## Bar and rail source review

No additional P0–P2 source defect was found in the reviewed diff.

- The bar derives a visible route title for exact `WARD_VIEWS`/`WARD_NAV` routes and the two statistics subroutes while preserving place names for ward-scoped routes. It remains a styled `span`; the local screen must therefore retain its accessible `h1`.
- The universal `WardGlobalSearch` remains mounted with its patient/movement/ward scope. Hub's directory search is a distinct local scope and must remain separately labelled in the integrated screen.
- Activity, Tasks and Tools retain text alternatives when compact icon treatments hide visible labels. The service announcement now truthfully states that filtering is not wired.
- The rail retains every route entry, groups them under Operations, Network and Records, and states the absence of shift scheduling and movement pinning rather than inventing state.
- Desktop collapse hides text/group adornments while keeping links; the responsive branch returns the rail to static horizontal flow.

## Primitive and statistics-frame review

No additional P0–P2 source defect was found in the Task 1 primitive/frame diff and report.

- Opt-in selectors are marker-scoped and legacy consumers remain on their prior classes when `design` is omitted.
- `WardFigure` retains the numeric/prose distinction; the intentional prose-safe `panelCount` treatment is consistent with the brief.
- The statistics frame emits the marker only for `design="third-edition"`; actual consumer adoption and computed-style proof remain acceptance items.
- Demonstration-chart overrides are marker-scoped and do not change chart logic or geometry.

## Verification state

- Controller-reported shell test run: 51 tests, 50 passed, 1 failed on an icon selector. The controller then narrowed the selector from `[aria-hidden]` to `[data-tone][aria-hidden]` without weakening the neutral-tone assertion. A post-fix rerun has not yet been supplied, so this review does not record the shell suite as green.
- No test or browser command was run by this reviewer, consistent with controller ownership.
- Visual review remains pending for the controller's post-correction 390 px, 820 px and 1440 px light captures, dark-theme captures, keyboard/focus checks, overflow checks and print output.

## Requested source correction batch

1. Apply the marker-scoped single-painter ground correction described above, including the print reset.
2. Rerun the focused shell test after the selector correction.
3. Capture the rebuilt routes only after the source batch is coherent; use those captures for final drawing and responsive review.

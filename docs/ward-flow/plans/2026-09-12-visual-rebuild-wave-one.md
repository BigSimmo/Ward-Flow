# Ward Flow visual rebuild — first implementation plan

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/plans/README.md`.** Kept for history; do not follow.

> **For agentic workers:** Use superpowers:subagent-driven-development to execute the tasks below. The controller dispatches bounded workers and independent reviewers; workers never dispatch their own agents. Steps use checkboxes. Read [current progress and next action](visual-rebuild-wave-one/PROGRESS.md) and the [agent protocol](visual-rebuild-wave-one/AGENT-PROTOCOL.md) before dispatch; this plan is the specification, not a second live status ledger.

**Goal:** Match the third-edition design in the shared header/sidebar and seven existing screens, while retaining their working state, actions, role boundaries and truthful limitations.

**Architecture:** Refine the mounted React components and CSS Modules. Establish the shared visual foundation once, then change separate screen presentations in parallel. Keep the existing provider, reducer, derivations, navigation registries and reconciliation store as the behavioural sources of truth.

**Tech stack:** Existing Next.js 16, React 19, TypeScript, CSS Modules, Vitest and Playwright installation. Package engines specify Node >=24.15.0 <25 and npm 11.x; restore only from the existing lockfile if needed. Read installed Next.js documentation before changing framework code.

**Spec:** The current user brief; `../README.md`; `../SCREEN-DEFINITION-OF-DONE.md`; `../mockups/WARD-FLOW-DESIGN-SYSTEM.md`; the seven named third-edition drawings below; applicable owner rulings; existing screen contracts. Design comes from the served drawings, not the historical build-plan status lines.

## Scope and current evidence

Inspected on branch `codex/task-ward-flow-live-state-20260831`, HEAD `1ef9ed3975078b789e9b5d70b3f000c64edc3809`, in `D:/Worktrees/Database/ward-lead` on 2026-09-12. These are source observations, not browser or test results.

- First implementation: shared header and sidebar; Search hub; Statistics overview; Statistics compare; Command; Delays; Community team; Bed board.
- The wider programme remains all 34 application drawings. The remaining pages, including the unrouted Sign-in and Ward answer drawings, stay in subsequent waves. The design-system page and digest are references, not product screens.
- The layout already mounts `shell/ward-bar.tsx` and `shell/ward-rail.tsx`. Service, Activity, Tasks and Tools are already present in the new bar. Do not implement the handover's stale claim against `ward-chrome-header.tsx`, or create a second header.
- Canonical third-edition tokens live in `src/app/ward-flow-shell-tokens.module.css`. The similarly named file under `components/ward-management/shell/` is a retained stub.
- The historical close-seven assessment is a prioritisation lead. No visual comparison has yet been performed in this task.
- Search hub and the statistics pair have relatively contained presentation work. Command has more coupled presentation files; Bed board has a large component and stylesheet. Use Command as the shell reference, but do the smaller screen implementations before these two.
- The central verification roster currently has 17 entries and excludes Statistics compare. Its screen already exists and its contract is `../build-contracts-2026-09-12/contract-statistics-compare.md`; include it in the roster before recording this wave's checks.
- Preserve the pre-existing changes in `.codex/config.toml`, `docs/agents/codex-reasoning-effort.md`, `scripts/check-codex-cloud-setup.mjs`, `tests/codex-cloud-setup.test.ts`, and `.claude/launch.json`. None belongs to this task.

## Global constraints

- The drawings are authoritative on DESIGN; the working engine is authoritative on BEHAVIOUR. Record every necessary departure and its reason.
- Ward Flow is never pushed. No commit, staging, merge, PR, deployment, remote Git or provider operation is part of this implementation authorisation.
- Never delete or move protected Ward Flow files, handovers, decisions, branches or worktrees. Keep existing files and modify their presentation in place.
- Preserve every app-only action, field, absence state, disclosure and role boundary. Before each screen edit, record a three-way inventory: drawing and app, drawing only, app only. Reuse current contracts and update only what fresh inspection disproves.
- Do not fabricate a value to fill a drawing. Preserve the visual container with a truthful existing absence state where appropriate; record any panel that cannot honestly be supported. Do not invent new engine policies or silently wire currently unavailable capabilities.
- No new HTML text below 12px. Use the adopted third-edition type scale at each rebuilt screen root only after proving its tokens resolve. Preserve the specifically ruled schematic-text exception and its full-size equivalent content.
- Serve mockups over HTTP with their scripts and assets. Never use `file://` as design evidence.
- Call `npm run ensure` before runtime/browser work and verify `/api/local-project-id` against this project and task checkout. Use only the printed application URL. Reuse healthy task resources.
- Every completed screen requires comparison at 390px, 820px and 1440px, light and dark, with evidence recorded against the drawing hash. Automated DOM assertions are not visual proof.
- Only one test/browser execution owner. Never run concurrent ward suites, mutation harnesses, typechecks or browser jobs, or bypass another worktree's heavy-run admission.
- Reuse successful unchanged evidence. No repeated full-suite runs, dependency reinstalls, whole-repository formatting or production builds for reassurance.

## Smart subagent routing

Use the existing collaboration tools; do not build a new orchestration application or edit machine-wide configuration. Each dispatch explicitly sets model and reasoning effort and uses `fork_turns: none` with a small task brief.

| Work                                                                         | Default model and effort        | Escalation condition                                                                            |
| ---------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------- |
| Controller, architecture, cross-screen decisions, adversarial plan review    | Astra, high                     | Increase effort only for a concrete unresolved problem                                          |
| Shell and visual screen implementation from a prose contract                 | Sol, medium; high for the shell | Escalate to Astra when a shared architecture or behavioural question survives source inspection |
| Mechanical, fully specified edits; small inventories and evidence formatting | Luna, medium                    | Move to Sol if interpretation or multiple interacting files are required                        |
| Independent task review, design compliance and code quality together         | Sol, high                       | Astra for subtle role, state, privacy or shared-shell issues                                    |
| Final integrated review of this wave's diff                                  | Astra, high                     | Review the wave only, not the accumulated history of the ward branch                            |

- At most four active agents: this controller plus three workers/reviewers. Do not spawn helpers inside workers.
- Work-conserving schedule: use free slots for ready disjoint work or a completed task's review. Never spawn a worker merely to keep a slot occupied.
- One owner for shared shell/tokens/layout and shared primitives. Other agents request exact shared edits through the controller.
- One statistics writer owns the overview/compare pair, because they share CSS. Do not let another statistics agent edit those styles concurrently.
- Each implementer also owns the named focused tests in its row of the verification table. A test shared between tasks belongs to the foundation owner and is changed serially. Classify any apparently stale assertion against the current owner ruling before altering it; preserve real behavioural assertions and record changed presentation contracts.
- One independent review per coherent task, combining specification and code quality. Reviewers consume the supplied diff and evidence instead of rerunning passing tests.
- Aim for one implementation pass and one batched correction pass. On a repeated failure, diagnose missing context, excessive scope or model mismatch and change the approach; never retry an unchanged failing command. A real unresolved defect remains open, regardless of the iteration budget.
- A worker returns changed paths, app-only retention, deviations, exact check output or unrun status, and remaining blockers. Keep reports in this plan's task workspace; return only a compact summary to the controller.
- The user's request for simultaneous workers supersedes generic SDD serial-implementer guidance for disjoint files. Repository protection rules supersede skill suggestions to commit, delete task workspaces or finish by publishing.

## Dependency order and file ownership

All component paths below are relative to `src/components/ward-management/` unless stated otherwise. Ownership is permission to edit only when the task requires it, not a request to touch every file.

1. **Foundation and acceptance pilot:** one shell writer establishes the shell and shared opt-in presentation; the Hub worker then implements Task 2 against that draft foundation. Shared corrections still belong to the foundation writer. Neither Task 1 nor Task 2 is accepted until the real Hub root AND its nested primitives pass the visual/computed-style checks. Other workers can prepare screen inventories while this happens; no parallel styling against an unproved recipe.
2. **First parallel screen batch:** statistics pair, Command, Delays — three disjoint writers after the foundation/Hub pilot is accepted and the shared contract is frozen.
3. **Next ready tasks:** Community team and Bed board consume that foundation as slots open. Completed tasks move into review without waiting for every member of a batch. Bed board is last priority among ready implementations, not a reason to leave a free slot idle.
4. **Integration:** freeze the wave's source, complete independent visual inspection and the single broad verification milestone.

### Task 1: Refine the mounted header/sidebar and establish screen tokens

**Owner:** Sol high. **Review:** independent Sol high, escalating architectural questions to Astra.

**Files:** `shell/ward-live-region.tsx` (cached hydration snapshot for the reproduced warning), `ward-shell.module.css` (marker-scoped ancestor ground transparency only), `shell/ward-bar.tsx`, `shell/ward-bar.module.css`, `shell/ward-rail.tsx`, `shell/ward-rail.module.css`, `shell/ward-reconciliation-line.tsx`, `shell/ward-reconciliation-line.module.css`; `src/app/mockups/ward-flow/layout.tsx` and `ward-flow-layout.module.css`; `src/app/ward-flow-shell-tokens.module.css`; `ward-panel.tsx`/`.module.css`, `ward-figure.tsx`/`.module.css`, `ward-table/ward-table.tsx`/`.module.css`; `statistics/statistics-section-frame.tsx` and a new `statistics/statistics-section-frame-third-edition.module.css` for that frame's opt-in presentation; `docs/ward-flow/build-contracts-2026-09-12/AGENT-BRIEF-COMMON.md` for the token-mechanism amendment. The controller owns the verification roster/count correction described in Task 8 and performs it during this foundation stage. Any shared primitive change needs its own named consumers and reason in the task report.

**Interfaces:** retain `WardBarMount`, `WardRail`, `WardBarProps`, `WardFlowProvider` and the existing screen check-store contract. Consumers continue using existing exports and route builders. Rebuilt screen roots opt in with `data-ward-design="third-edition"` and compose the canonical token class locally. Add an optional `design?: "third-edition"` prop to `StatisticsSectionFrame`; omission preserves its current root and styles, while the explicit value supplies the opt-in marker and styles from `statistics-section-frame-third-edition.module.css`. Task 1 creates and exclusively owns that frame module before foundation acceptance; it never imports Task 3's later screen stylesheet. Both frame variants are available when parallel work starts. No new global state interface.

**Primitive contract:** the foundation owns the opt-in rules for panels, figures and table wrappers under that root marker. Override old token bindings at the primitive element where they are redeclared, not merely on its ancestor. Keep the legacy default path for unrebuilt consumers. No screen worker adds a competing local fix to a shared primitive. Measure nested panel heading/count, figure, table header/cell and disclosure typography/surfaces wherever actually rendered. For a primitive not present on Hub, use its first real statistics/board consumer as a narrow acceptance check before considering that primitive accepted; do not invent a demonstration page for the test.

- [x] Inspect current file claims, register this task's ownership and preserve the dirty-file exclusions. The task bootstrap ran during planning; do not repeat it for this continuation. Reconfirm ownership immediately before source edits.
- [x] Establish the local application and a served Command drawing. Make a shell-specific three-way inventory, including route title, prototype treatment, shift block, navigation groups, service marker, pinned rows, closed-rail presentation, Activity tally and Tools contents. For unsupported data/actions, decide the truthful visual treatment and record the departure before coding; do not quietly drop the region or invent a feature.
- [x] Compare shell geometry, rail open/closed states, header wrapping, drawer layout, surfaces, density, focus and theme at the required widths before editing. Include reload with remembered theme/rail state; fix first-paint mismatch only if reproduced, using the existing application startup conventions.
- [x] Refine the mounted shell. Retain Service selection's actual semantics, search, primary actions, drawer content, role controls, remembered appearance and rail state, and reconciliation wording. A styled Service menu must not imply global filtering that does not exist.
- [x] Correct the Service Escape announcement that says choosing All services widens the queue while the visible explanation says filtering is unwired. Keep the selection behaviour; align the sentence with its actual effect. Preserve separate numeric/prose treatments in count slots according to their current data, rather than making all prose monospace to copy sample digits.
- [x] Make the existing token class composable at rebuilt screen roots. Do not apply a global palette/type migration to untouched screens. In the same change, amend the common brief's obsolete prohibition and its explanation, as required by O-17.1/D-6.
- [x] Complete the Task 2 pilot before releasing parallel styling. Prove all three standard §4.4 conditions: root `--t-0` resolves to `0.75rem`; named elements compute to their exact target sizes; the rebuilt screen's stylesheet has no remaining `--text-*` reference. Verify the nested primitive contract as well as the root. Publish the accepted recipe once and reuse it.
- [x] Run the focused shell contracts once after a coherent patch; inspect header/sidebar visually and review the patch before freezing the shared contract for page work.

### Task 2: Search hub

**Files:** `hub/hub-screen.tsx`, `hub/hub.module.css`; retain `hub-derivations.ts`, `hub-browser-memory.ts` and `hub-provenance.ts` behaviour.

**Interfaces:** consumes the verified screen-root token recipe and existing hub derivations; produces the same `HubScreen` route output and navigation actions.

- [x] Capture the three-way inventory against `search-hub-third-edition.html` and the existing route.
- [x] Match the result rows, Search hub regions, At a glance, spacing, typography and provenance presentation. Preserve app-only statistics links, search behaviour, memory and truthful empty results.
- [x] Apply the root token recipe, verify computed values, run the focused hub tests, and submit one complete task report for independent review.

### Task 3: Statistics overview and compare together

**Files:** `statistics/statistics-overview-screen.tsx`, `statistics/statistics-compare-screen.tsx`; create `statistics/statistics-third-edition.module.css` for the migrated pair's screen contents only. Legacy `statistics-sections.module.css` and `statistics-v4.module.css` remain the default styles for unrebuilt consumers. The shared frame's optional design prop and separate frame stylesheet are produced and owned by Task 1; Task 3 consumes them without editing them. Later changes to that interface or frame styles return to the foundation owner.

**Interfaces:** retain existing statistics derivations, suppression/absence vocabulary and exported screen props. No new calculations or seed data. Both screens pass `design="third-edition"` to the frame. The new module is the certified screen stylesheet: it contains no `--text-*` references. Move only the styles these screens require into this module and apply the new tokens deliberately; do not copy both entire legacy stylesheets. Shared primitives use Task 1's opt-in rules, whose active third-edition branch also uses only the new scale. Old-scale rules remain only on the legacy path for untouched screens.

- [x] Reconcile the existing overview/compare contracts against both drawings and current source; identify all other consumers of any shared selector before changing it.
- [x] Match overview's panel order, card/band treatments and typography, then compare's two table regions and responsive presentation. Preserve missing-data statements, suppression and incomparable measures.
- [x] Check that necessary columns remain available on phones with the existing honest overflow affordance. No hidden clinical fields to obtain a visual match.
- [x] Run the focused statistics tests and inspect the affected shared-style consumers. Submit the pair as one reviewable patch.
- [x] Check unchanged ward, service, ED and community statistics consumers retain the default frame path. Run their existing focused contracts only if a shared frame/primitive change affects them, and visually sample a legacy route at phone/desktop in both themes to establish isolation without a second full seven-screen matrix.

### Task 4: Command

**Files:** presentation components and CSS under `coordinator/`, centred on `coordinator-screen.tsx` and `coordinator.module.css`. Engine modules outside that directory are not owned by this task.

**Interfaces:** retains the current coordinator screen, selection state, eligibility results, actions and provider access; consumes the same shell and screen token recipe.

- [x] Inventory the pressure cards, queue, candidate/detail regions and diagram against `command-third-edition.html`, including all current app-only controls and refusal explanations.
- [x] Apply the drawing's visual hierarchy and responsive arrangement to the real contents. Keep selection, gates, overrides, paused/stale states and disclosures unchanged.
- [x] Verify candidate selection and one existing action/refusal journey. Run the relevant Command DOM contract and submit for review.

### Task 5: Delays

**Files:** `delays/delays-screen.tsx`, `delays/delays.module.css` and the directly affected screen-local presentation components only.

**Interfaces:** retain current delay groups, two-tab register, deadline semantics and resolved outcomes.

- [x] Inventory against `delays-third-edition.html` and preserve the app's additional honest panels.
- [x] Match regions, bands, row density, status wording hierarchy and disclosure styling while retaining filters, tabs and destinations.
- [x] Run the focused Delays DOM tests. Check one filter/tab/navigation journey and submit the task report.

### Task 6: Community team

**Files:** `community/community-screen.tsx`, `community/community.module.css`; no changes to catchment, linkage, event permissions or derivations.

**Interfaces:** retains `CommunityScreen` props, team switching and current capability limitations.

- [x] Inventory against `community-team-third-edition.html` and preserve app-only links, facts and explanations for unavailable actions.
- [x] Match panels, figures, team switcher, surfaces, typography and disclosures, including empty teams and absent links. Do not invent referrals to make a sparse screen look busy.
- [x] Run the focused Community tests, check team switching and empty-state presentation, then submit for review.

### Task 7: Bed board

**Files:** `board/ward-board.tsx`, `board/board.module.css`; `board/ward-daily-sheet.tsx` only if a proven presentation dependency requires it. Controller alone adds the canonical `wardBoardHref(unitId)` builder in `shell/ward-facade.ts` and its case in `tests/ward-facade-agrees-with-screens.test.ts` for the drawing's Change ward navigation; the board worker consumes this interface without editing the facade.

**Interfaces:** retain `WardBoard` props, bed facts/actions, selection, leave capacity, and the existing handover/print path.

- [x] Inventory the board against `bed-board-third-edition.html`, including the app-only action set and all three existing flow regions.
- [x] Match bed tiles, board regions and the drawing's tabbed presentation. Tabs may reorganise visibility, but must preserve access to every action and fact and retain state on switching. Do not hide a mandatory warning or change what a bed permits. If a concrete role/clinical conflict prevents that arrangement, keep the affected behaviour and record the precise design deviation.
- [ ] Preserve phone access to all clinical columns and print content. Run focused board contracts, check tab switching, bed selection and print preview, and submit for review.

### Task 8: Record and accept the integrated wave

Integration amendment, 2026-09-13: finish the known collapsed-rail hover/focus-card gap using the existing portal Tooltip. Task 1 may make a backward-compatible addition in `src/components/ui/tooltip.tsx` for right placement and presentation-only content, with wrapper sizing, and consume it only in the closed desktop Ward rail. Existing Tooltip defaults remain unchanged. Add focused geometry/accessibility coverage; use only real route names and current count labels, documenting the absent drawing-only purpose/state prose. This is a required shell design correction, not a new screen or engine feature.

Integration correction scope, 2026-09-13: the first full Ward run executed451/451 files and exposed fifteen failures. The controller may correct the affected Ward guard tests and the Community switcher claim citation where exact source/layout contracts changed; preserve their non-vacuity, exact populations and refusal behavior. Source corrections stay limited to canonical token alias ownership in `ward-tokens.module.css`, the affected Panel/Delays consumers, a Ward-local printable-disclosure hook (replacing DocumentViewer coupling), and Hub's reuse of canonical table styling. Update breakpoint/threshold provenance only for the inspected design, never by broadly accepting unknown values. Diagnose the unchanged mutation-harness failure before any rerun or proposed fix. Run only the affected checks after this correction batch; retain the full run's honest failed verdict and unchanged passing evidence. Controller owns scheduling and shared files; bounded worker scopes and reports are recorded in `PROGRESS.md`.

**Owner:** controller-managed verifier. **Files:** `scripts/ward-flow/screen-pairs.mjs`, `scripts/ward-flow/screen-map.mjs`, `docs/ward-flow/screen-verification.json`, generated `SCREEN-MAP.md`/`SCREEN-VERIFICATION.md`, this plan's progress/evidence documents.

- [x] During Task 1, mark Statistics compare as contracted in the existing roster and add its `verified: null` row. Generate the build-contract heading from the roster count rather than leaving a literal seventeen. Preserve existing rows and do not mark anything verified merely because its route exists. This makes 18 tracked screens; it does not claim the other 16 application drawings were built in this wave.
- [x] For each of the seven screens, inspect the served drawing and current route at all six width/theme combinations. Include full-page content and the screen's key interaction state. Use fixed demonstration state and record differences caused by real app data rather than forging matching data.
- [x] Have a reviewer other than the implementer inspect contemporaneous paired browser captures/live pages for EVERY matrix cell. Reference one shared-shell interaction evidence set from all seven screen records instead of repeating the same drawer/rail checks seven times. Record actual agent/model identity and explicit human acceptance status.
- [x] Record date, reviewer, widths, themes, verdict, drawing hash and deviation reasons in `screen-verification.json`. Notes link evidence to the app revision or working-diff fingerprint. Record blocked/deviating states honestly; an entry or a current hash alone is not completion.
- [ ] Run the consolidated verification below once with source frozen, then one Astra integrated review of this wave's diff. Bundle any genuine correction requests; rerun only affected checks unless shared regression risk justifies another broad pass.
- [ ] Finish with changed files, visual results, exact test summaries, deviations and remaining work. Agent-verified implementation may be ready for owner inspection; the checklist's actual-human visual acceptance remains outstanding until it happens. Preserve all task evidence and leave the work uncommitted and local.

Final integration amendment, 2026-09-13: Windows UNKNOWN/open errors were reproduced in the mutation harness restore. Controller added restoration-only bounded retries and diagnostic controls in `scripts/ward-flow/mutation-run.mjs`; independent Sol review confirms captured-byte identity, unchanged hash verification and loud exit 3 on exhaustion. The final diagnostic still fails at the initial mutation write. Do not retry mutation application/test execution or claim this gate passed. Exact evidence and resumption boundary: `visual-rebuild-wave-one/tasks/final-gate-checkpoint-r1.md`.

## Verification budget and commands

The controller schedules every execution. Workers can request focused tests but must not independently launch competing suites. Select the smallest named set whose contracts cover the actual diff; the following are candidate sets verified to exist, not a mandate to run every file after every edit.

| Task       | Focused test files under `tests/`                                                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell      | `ward-shell-third-edition.dom.test.tsx`, `ward-shell-mounted.dom.test.tsx`, `ward-shell-print-ancestor.test.ts`                                                                              |
| Hub        | `ward-hub-screen.dom.test.tsx`, `ward-hub-route.test.ts`, `ward-hub-bar-colours.test.ts`, `ward-hub-reconciliation-line.test.ts`                                                             |
| Statistics | `ward-statistics-sections.dom.test.tsx`, `ward-statistics-overview-invented.dom.test.tsx`, `ward-statistics-overview-parked.dom.test.tsx`, `ward-statistics-compare-two-tables.dom.test.tsx` |
| Command    | `ward-command-third-edition.dom.test.tsx`                                                                                                                                                    |
| Delays     | `ward-delays-third-edition.dom.test.tsx`, `ward-delays-screen.dom.test.tsx`                                                                                                                  |
| Community  | `ward-community-third-edition-headings.dom.test.tsx`, `ward-community-team-hub.dom.test.tsx`                                                                                                 |
| Board      | `ward-board-page.dom.test.tsx`, `ward-board-third-edition-headings.dom.test.tsx`                                                                                                             |

Example focused command (the wrapper accepts positional filenames):

```text
node scripts/run-ward-tests.mjs tests/ward-shell-third-edition.dom.test.tsx tests/ward-shell-mounted.dom.test.tsx tests/ward-shell-print-ancestor.test.ts
```

- At iteration time, use focused DOM/behaviour tests for changed interactions and static checks for styling/contracts. Add a regression test only for a changed interaction, uncovered contract or reproduced defect. Do not create tests that merely duplicate CSS implementation, or run mutation harnesses for routine styling.
- Do not run a global typecheck from every worker. Run `npx tsc -p tsconfig.typecheck.json --noEmit` once at the integrated milestone; run earlier only for an actual interface/type uncertainty.
- Run `node scripts/run-ward-tests.mjs` once for integrated-wave completion, not once per screen. Read all runner summary counts: handed-in equals ran, and failures, missing files and skipped work are accounted for. Equality alone is not a passing test result. The wrapper takes no repository coordinator lease, so check resource availability before starting and do not use it to evade contention.
- Browser automation: use selected tests from `ui-ward-chrome-header.spec.ts`, `ui-ward-coordinator.spec.ts`, `ui-ward-search.spec.ts`, `ui-ward-statistics-compare.spec.ts`, `ui-ward-statistics-journey.spec.ts` and relevant role/board coverage only where the diff requires them. The project is `chromium-mockups`. Inspect selectors against the mounted shell before trusting legacy-named tests. One example: `node scripts/run-playwright.mjs --project=chromium-mockups tests/ui-ward-statistics-compare.spec.ts`.
- Reuse the browser session for the required six visual comparisons per screen and shared-shell interaction checks. No second browser pass just to repeat unchanged evidence. Recheck affected cells after fixes.
- Run `node scripts/ward-flow/screen-map.mjs` and `node scripts/ward-flow/screen-verification.mjs` when their source data changes, then their `--check` modes. If a drawing is edited for an approved reason, regenerate `mockups/MANIFEST.json` with `node scripts/ward-flow/mockup-manifest.mjs`; affected visual evidence must be renewed.
- Shell changes warrant keyboard/Escape/focus-return, rail state, light/dark/auto, one narrow-layout overflow check and focused print/forced-colours checks. These complement the seven-screen matrix; they do not justify the entire production browser suite.
- No live providers, hosted CI, production builds or whole-repository lint/format runs by default. Local evidence never proves hosted or physical-device behaviour.

## Completion and resumption

The canonical task progress ledger is `docs/ward-flow/plans/visual-rebuild-wave-one/PROGRESS.md`. It records task ID, owner/model/effort, allowed files, input revision, app-only retention, output diff fingerprint, review verdict, commands/results and next action. Follow its adjacent `AGENT-PROTOCOL.md` for durable task briefs/reports, message acknowledgements and plan-hash drift checks. Keep detailed briefs/reports out of repeated dispatch prompts. Never redispatch a completed unchanged task after context compaction. Any SDD scratch ledger points here; it never duplicates current task states.

Two completion states are deliberately separate. **Agent-verified implementation ready for owner inspection:** all seven screens and shared shell have passed independent agent visual review, necessary functional deviations are explicit, required evidence is recorded and integrated checks pass. **Owner-accepted screen completion:** the actual human comparison required by the screen checklist has also happened. Record `human acceptance: pending` in each verification note until it does; never infer it from an agent review. Human inspection does not require another automated full-suite run. A blocker on one screen does not prevent independent work; report implementation as partial until that blocker is resolved.

## Plan review record

- Planning scouts: Sol medium for screen decomposition; Sol high for the mounted shell; Luna medium for verification command discovery. Read-only; no runtime or test proof claimed.
- Independent adversarial review: Astra high, 2026-09-12, verdict on the first draft: revise before implementation. Six findings addressed in this revision: foundation/pilot sequencing; nested primitive migration; statistics isolation and complete type migration; human acceptance distinction; explicit shell inventory and truthful announcements; test-file ownership.
- One scoped closure review confirmed five findings addressed and found one remaining frame-stylesheet dependency. The controller applied the reviewer's minimal correction: a separate frame stylesheet created and owned by Task 1, independent of Task 3's later screen stylesheet. This final narrow documentation correction was checked by the controller; no further broad review was run.
- Review and resolution details: `2026-09-12-visual-rebuild-wave-one-review.md`. No code, test execution or browser verification was performed during this planning pass.

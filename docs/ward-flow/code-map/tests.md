# Tests

This part covers every Ward Flow test file: everything matching `tests/ward-*`, `tests/ui-ward-*`
and `tests/helpers/ward-*`, plus the two further files that import from
`src/components/ward-management` or `src/app/mockups/ward-flow` without carrying a `ward-` name
(`tests/pressure-strip.dom.test.tsx`, `tests/tracker-derivations.test.ts` — found by
`grep -rl 'from "@/components/ward-management` over `tests/`). It also covers how these tests run:
`vitest.config.mts`, the `chromium-mockups` Playwright project, `scripts/check-ward-expected-reds.mjs`
and `tests/ward-expected-reds.json`, and `scripts/run-vitest.mjs`.

Written against tip `ace8e9ee8d` on branch `ward/extend-ward-flow-code-map`, dated 25 September 2026. **File counts:** `git ls-files` for the patterns above, unioned and de-duplicated (656 files
total: 269 `*.dom.test.tsx`, 367 `*.test.ts`, 13 `*.spec.ts`, 6 helper `.ts` files, 1 `.json`
manifest). **Line counts:** `wc -l` on every file individually (656 files, 189,433 lines total,
each bullet below carries its own file's count). **Per-file "what it protects" text:** scripted —
for each file, the first `describe(`/`describe.skip(`/`test(`/`it(` title found by grep, lightly
cleaned (quote-stripped, template-literal expressions collapsed to `<value>`). About a dozen
titles that a naive first-match grabbed from a comment instead of code, or from `test.describe(`
(which the first regex pass missed), were corrected by hand after inspection — each such fix is
visible as ordinary prose rather than a raw `describe(...)` fragment. Where a title is a bare
function or component name (e.g. `WardBar`, `bedKindGaps`), that is genuinely the file's own
first `describe(...)` argument, not a mistake — the test authors often name the suite after the
unit under test rather than writing a sentence. **Subject grouping** below is a keyword
classification over each file's path and title, scripted and then spot-checked; treat category
_boundaries_ as approximate (a handful of files, noted at the point they occur, were moved by hand
after reading their content) — the file list itself, with its real line count and its author's own
first-describe wording, is the reliable part. Back to [the code map index](README.md).

## How the suite runs

- **`vitest.config.mts`** (repo root) defines two Vitest projects under one `npm run test`
  invocation. **`node`** collects `tests/**/*.test.ts` under Node — the plain `.test.ts` ward
  files (367 of the 656). **`jsdom`** collects `tests/**/*.dom.test.tsx` under jsdom with
  `@testing-library/react`, using `tests/setup/jsdom.setup.ts` — the `.dom.test.tsx` ward files
  (269 of the 656). Neither project's glob matches `tests/helpers/ward-*.ts` (no `.test.ts`
  suffix) or `tests/ward-expected-reds.json`: the six helper files are only ever imported by other
  test files, and the manifest is data, never collected as a test itself. The 13
  `tests/ui-ward-*.spec.ts` browser specs are outside Vitest entirely (Playwright, below). Both
  Vitest projects share one `resolve.alias` (`@` → `src/`) and the coverage thresholds defined at
  the top of the file, which are repo-wide and not ward-specific.
- **`playwright.config.ts`** defines a `chromium-mockups` project restricted to
  `mockupSpecPattern` (a fixed filename list, one alternation per file — a new `ui-ward-*.spec.ts`
  must be added to this pattern **and** to the root `testMatch` regex, or it silently never runs;
  `tests/playwright-project-isolation.test.ts` is the guard that catches a spec on disk with
  neither) AND the `@mockup` tag (`mockupTag = /@mockup/`, matched against each `test.describe`'s
  own title — every one of the 13 ward specs opens with `@mockup ...` for exactly this reason).
  The project runs single-worker (`workers: 1`, `fullyParallel: false`) with `reducedMotion:
"reduce"` and `serviceWorkers: "block"` inherited from the shared `use` block. It is advisory —
  kept in its own project "so a red mockup can never mask a production-journey regression" (the
  config's own comment) — and is reached by `npm run test:e2e:ward-journeys`, which runs
  `node scripts/run-playwright.mjs --project=chromium-mockups ui-ward-` (the `ui-ward-` argument
  is itself a further filename filter, on top of the project's own pattern).
- **`scripts/check-ward-expected-reds.mjs`** (427 lines) is the full offline ward gate, run once
  at fold time (`node scripts/check-ward-expected-reds.mjs`, no npm script wraps it under a
  shorter name at this tip). What it actually does:
  - **Discovers the ward population itself**, independent of this map: every `tests/**/*.{test,spec}.tsx?`
    file matching `tests/ward-*` (minus `tests/ui-*`), **plus** any other test file with a
    non-comment line matching `/ward-(management|flow)/` — the same union rule this map's brief
    used to find `pressure-strip.dom.test.tsx` and `tracker-derivations.test.ts`.
  - **Two floors, not one, and they are deliberately far below the real population**: at least 200
    files discovered and at least 2,500 tests executed. Both exist only to catch a _broken_
    discovery or run (an empty failing set compared against an empty manifest reports success,
    which is the exact vacuity the floors close) — they are not meant to track the real count, and
    `tests/ward-expected-reds-manifest.test.ts` separately asserts the real population still
    clears them.
  - **A third floor most gates don't have**: `filesRan` (what Vitest's JSON reporter actually
    returned) must equal `files` (what was asked for). The script's own comments say this machine
    has silently dropped test files from a run more than once — a dropped file's reds simply don't
    appear in the failing set, which a manifest comparison alone cannot distinguish from "that file
    is clean".
  - **Invokes Vitest directly**, not through `scripts/run-vitest.mjs`, specifically so a cached
    gate-receipt pass elsewhere cannot satisfy this check — and consequently this script does not
    take the repo's heavy-run lock, so it should not run beside another heavy suite.
  - **Compares the failing set against `tests/ward-expected-reds.json` in both directions**, keyed
    by file path plus a `failing` count (not by test name, so a rename can't be misread as a fix,
    but an exactly-compensating swap of one red for another inside an already-listed file is
    invisible): an unlisted failing file fails the gate; a listed file that has **stopped**
    failing also fails the gate (the property the script's own comments call "the one nobody
    tests" — an `it.fails` tripwire cannot give it, because it keeps passing after the underlying
    defect is fixed); and a listed file failing a **different number of times** than recorded
    fails the gate too.
  - **`tests/ward-expected-reds.json`** is the manifest `check-ward-expected-reds.mjs` reads. At
    this tip its `expected` array is **empty** — so the gate currently tolerates zero ward
    failures, and any ward test failing at all is an unsanctioned red. Its `kinds` distinguish
    `owner-question` (holds open a question only the owner can answer — clearing it answers the
    question by default, and nobody may clear one just to go green) from `backlog` (ours to fix,
    and fixing it is the correct way to clear it).
- **`scripts/run-vitest.mjs`** (188 lines) is the general-purpose Vitest wrapper used everywhere
  else in the repo (including, per `CLAUDE.md`, `node scripts/run-vitest.mjs <affected-files>` for
  focused iteration). It does not itself pick "changed files plus up to three importers" — that
  selection is the caller's job (see `npm run test:focused`, `scripts/test-focused.mjs`, which is
  documented in the sibling scripts-and-tooling map). What this wrapper adds over calling Vitest
  directly: a gate-receipt cache keyed on the exact argument list (so an identical prior pass can
  short-circuit a re-run — this is exactly why `check-ward-expected-reds.mjs` deliberately bypasses
  it), a gate-arbiter consultation, a cross-worktree "heavy run" lock, and reporter-argument
  validation. A coverage/watch/update/UI run is never treated as memoisable.

## Which tests to run for a change in X

| Change touches                                                            | Run (glob, relative to `tests/`)                                                                                                                                                                                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ward-flow-reducer.ts` / `ward-flow-events.ts` (event union, guard order) | Wide blast radius — start with `ward-flow-reducer.test.ts`, `ward-event-permissions.test.ts`, `ward-refusal-gaps-*.test.ts`, every `ward-*-reducer.test.ts`, then widen to the full ward suite before folding                            |
| `ward-model.ts` / `ward-derivations.ts` (shared types and selectors)      | `ward-model*.test.ts`, `ward-derivations.test.ts`, plus `grep -rl` the changed export name across `tests/ward-*` first — these two files have 125 and 71 importers respectively (per the engine map), so a narrow glob under-selects     |
| `ward-eligibility.ts`, gender/sex placement rules                         | `ward-eligibility.test.ts`, `ward-gender-*.test.ts`, `ward-non-binary-*.test.ts`, `ward-*gender*.dom.test.tsx`, `ward-referral-matching.test.ts`, `ward-physical-facts-are-not-overridable.test.ts`                                      |
| `ward-referrals.ts`, `ward-catchment.ts`, referral screens                | `ward-referral-*.test.ts`, `ward-referral-*.dom.test.tsx`, `ward-referrals-print.test.ts`                                                                                                                                                |
| `ward-legal-clock.ts`, legal forms, MHA vocabulary                        | `ward-legal-*.test.ts`, `ward-*legal*.dom.test.tsx`, `ward-act-section-citation-guard.test.ts`, `ward-five-gaps.test.ts`, `ward-mha-calculator.test.ts`, `ward-repeat-examination.test.ts`                                               |
| `ward-bed-availability.ts`, bed release, morning roll-up, capacity screen | `ward-capacity-*.test.ts`, `ward-capacity-*.dom.test.tsx`, `ward-bed-*.test.ts`, `ward-morning-rollup.test.ts`, `ward-pending-preparation-populations.test.ts`                                                                           |
| One screen folder (e.g. `community/`, `ed/`, `board/`)                    | `ward-<screen>-*.test.ts`, `ward-<screen>-*.dom.test.tsx`, and check the corresponding `ward-statistics-<screen>-*` files (statistics re-reads every domain)                                                                             |
| `shell/` (rail, top bar, drawers)                                         | `ward-shell*.dom.test.tsx`, `ward-bar*.dom.test.tsx`, `ward-chrome-*.dom.test.tsx`, `ward-sidebar*.dom.test.tsx`, `ward-tasks-drawer.dom.test.tsx`, `ward-registers-drawer.dom.test.tsx`                                                 |
| `ward-nav.ts`, routes, redirect stubs                                     | `ward-nav.test.ts`, `ward-*-reachability.test.ts`, `ward-no-dead-ends.dom.test.tsx`, `ward-links-never-point-at-redirect-stubs.test.ts`, `ward-route-component-binding.test.ts`, `ward-specs-never-navigate-into-redirect-stubs.test.ts` |
| Any Ward Flow CSS module / design token                                   | The whole "Design tokens, raw colour and table/type rules" group below — these are whole-tree scans, not scoped to one file, so a targeted run cannot substitute (see the `readFileSync` pitfall)                                        |
| A generator or its manifest (screen map, owner rulings, drawing rules)    | `ward-expected-reds-*.test.ts`, `ward-owner-decisions-*.test.ts`, `ward-screen-verification-lib.test.ts`, `ward-drawing-*.test.ts`, `ward-errata-freshness-gate.test.ts`, plus the generator's own `--check` invocation                  |
| Anything, before folding                                                  | `node scripts/check-ward-expected-reds.mjs` (the full offline suite, both-direction manifest check) and `npm run test:e2e:ward-journeys` (13 browser specs, `chromium-mockups`)                                                          |

## The test files, by subject

### Engine, reducer and cross-cutting domain rules (155 files)

- **`tests/pressure-strip.dom.test.tsx`** (85 lines) — PressureStrip
- **`tests/tracker-derivations.test.ts`** (79 lines) — trackerRowState
- **`tests/ward-absence-wording-is-one-per-fact.test.ts`** (109 lines) — an absent fact has one rendered wording
- **`tests/ward-acting-unit-guards.test.ts`** (215 lines) — a ward cannot act on another ward's bed release
- **`tests/ward-acuity-override-num.dom.test.tsx`** (245 lines) — the ward screen's high-acuity override: the tick
- **`tests/ward-acuity-override-num.test.ts`** (198 lines) — the high-acuity override needs both a reason and the nurse unit manager tick
- **`tests/ward-admission-model.test.ts`** (735 lines) — admission vocabulary
- **`tests/ward-admissions-seed.test.ts`** (604 lines) — the seeded admissions are a fixture that can fail
- **`tests/ward-advanced-clinical-features.test.ts`** (211 lines) — Advanced clinical coordination features & behaviors
- **`tests/ward-advanced-features.dom.test.tsx`** (207 lines) — Ward Flow Advanced Clinical Features DOM Suite
- **`tests/ward-agent2-stress-test.test.ts`** (341 lines) — Agent 2 Stress Test Suite
- **`tests/ward-arrival-divergence.test.ts`** (168 lines) — the two arrivedAt fields are allowed to disagree
- **`tests/ward-arrived-in-department.test.ts`** (128 lines) — recording that a referred person is physically in the department
- **`tests/ward-audit-engine-fixes-2026-09-16.test.ts`** (801 lines) — Fix 1: no dead duplicate switch cases
- **`tests/ward-audit-engine-repairs-20260923.test.ts`** (642 lines) — 23 September engine audit repairs
- **`tests/ward-audit-integrity-20260922.test.ts`** (169 lines) — WFA-001: cancellation describes the retained bed after a stage correction
- **`tests/ward-audit-provider.dom.test.tsx`** (94 lines) — provider session record API
- **`tests/ward-audit.test.ts`** (416 lines) — session audit capture and review
- **`tests/ward-away-at-emergency-department.test.ts`** (255 lines) — recording that a patient is away at an emergency department, and back
- **`tests/ward-bar-zero-is-reachable.test.ts`** (103 lines) — measured-zero derivations and WardBar callers remain guarded
- **`tests/ward-bed-availability-model.test.ts`** (335 lines) — bed release model
- **`tests/ward-bed-availability.test.ts`** (276 lines) — release bands
- **`tests/ward-board-derivations.test.ts`** (411 lines) — the accepts rule is never an equality
- **`tests/ward-builder-2-features.dom.test.tsx`** (234 lines) — Builder 2 - ED statutory form dropdown (ED-FORM-DROPDOWN)
- **`tests/ward-catchment-resolver.dom.test.tsx`** (475 lines) — resolveCatchmentQuery & resolveSuburb - Suburb Search
- **`tests/ward-catchment.test.ts`** (504 lines) — ward-catchment — non-vacuity
- **`tests/ward-change-audit-enumeration.dom.test.tsx`** (85 lines) — the change-audit panel's description of itself
- **`tests/ward-change-reasons.test.ts`** (250 lines) — ward-change-reasons
- **`tests/ward-chrome-role.test.ts`** (72 lines) — route-derived Ward Flow chrome roles
- **`tests/ward-clock-decoupling-and-history.dom.test.tsx`** (139 lines) — Issue 2: coherent clock across board and event consumers
- **`tests/ward-clock.test.ts`** (219 lines) — ward clock
- **`tests/ward-command-activity.test.ts`** (146 lines) — Command activity from current records
- **`tests/ward-community-collision-coverage.test.ts`** (249 lines) — the shared near-duplicate derivation
- **`tests/ward-community-decline-reasons.test.ts`** (105 lines) — the community decline vocabulary
- **`tests/ward-community-notices.dom.test.tsx`** (112 lines) — a community team sees its own notices and can mark them read
- **`tests/ward-community-teams-table.dom.test.tsx`** (139 lines) — CommunityTeamsTable [describe.skip — retired/disabled]
- **`tests/ward-configuration-read-sites.test.ts`** (227 lines) — configuration constants are read only through state.configuration
- **`tests/ward-configuration-reducer.test.ts`** (287 lines) — SET_CONFIGURATION
- **`tests/ward-configuration.test.ts`** (142 lines) — defaultWardConfiguration
- **`tests/ward-console-controls.dom.test.tsx`** (1413 lines) — the movement workspace's urgent-flag control
- **`tests/ward-contention.test.ts`** (417 lines) — contention
- **`tests/ward-coordinator-refusal-marker.dom.test.tsx`** (143 lines) — the persistent refusal marker
- **`tests/ward-coordinator-service-scope.dom.test.tsx`** (235 lines) — fixture sanity: South Metro actually splits the Command populations both ways
- **`tests/ward-data-checker.test.ts`** (593 lines) — the ward data checker is a check that can fail
- **`tests/ward-declined-by-all-precedence.test.ts`** (355 lines) — WF-23: declined-by-all precedence against acceptance
- **`tests/ward-delay-cause-vocabulary.test.ts`** (158 lines) — a delay cause's note agrees with its own title about what the event is called
- **`tests/ward-delays-derivations.test.ts`** (714 lines) — delayGroups
- **`tests/ward-delays-service-scope.dom.test.tsx`** (385 lines) — fixture sanity: South Metro actually splits the open population both ways
- **`tests/ward-derivations.test.ts`** (524 lines) — buildActionInbox
- **`tests/ward-device-claim-reason.dom.test.tsx`** (203 lines) — a live board's stated reason for not being a medical device
- **`tests/ward-discharge-dates.test.ts`** (435 lines) — derivedBedReleases — expected releases
- **`tests/ward-discharge-records.test.ts`** (165 lines) — guarded discharge projection
- **`tests/ward-diversion-controls.dom.test.tsx`** (137 lines) — officer diversion control — T4b
- **`tests/ward-diversion.test.ts`** (325 lines) — RECORD_DIVERSION — build plan item 29 / R2-7
- **`tests/ward-ed-access-target-configuration.dom.test.tsx`** (106 lines) — the ED screen reads the coordinator-configured ED access target
- **`tests/ward-ed-expects-derivation.test.ts`** (225 lines) — what counts as being in the department
- **`tests/ward-ed-home-derivations.test.ts`** (311 lines) — isDetainedUnderTheAct
- **`tests/ward-engine-defects.test.ts`** (542 lines) — PULL_PATIENT checks high-acuity places that are LEFT, not merely authored
- **`tests/ward-escalation.test.ts`** (162 lines) — escalationBoard
- **`tests/ward-event-permissions.test.ts`** (501 lines) — who may raise which event
- **`tests/ward-facade-agrees-with-screens.test.ts`** (802 lines) — the shell facade agrees with the screens that own its figures
- **`tests/ward-flow-chat-control.test.ts`** (2089 lines) — a Ward Verifier is given a criterion, not just a commit
- **`tests/ward-flow-contracts.test.ts`** (732 lines) — invariants across every reachable state
- **`tests/ward-flow-core-engine-fixes.test.ts`** (255 lines) — Ward Flow Core Engine & Reducer Fixes
- **`tests/ward-flow-data-boundary.test.ts`** (181 lines) — ward flow keeps its changeable data in one place
- **`tests/ward-flow-diagram-scroll-notice.dom.test.tsx`** (103 lines) — FlowDiagram's sideways-scroll affordance
- **`tests/ward-flow-offline-boundary.test.ts`** (104 lines) — Ward Flow's database-free runtime boundary
- **`tests/ward-flow-provider-persistence-privacy.dom.test.tsx`** (800 lines) — ward-flow-provider default-deny persistence privacy
- **`tests/ward-flow-reducer.test.ts`** (2060 lines) — seeding
- **`tests/ward-flow-sandbox.test.ts`** (42 lines) — Ward Flow is a developer-gated sandbox
- **`tests/ward-flow-seam.test.ts`** (291 lines) — ward flow keeps its seam with the rest of the repository
- **`tests/ward-flow-service-coverage.test.ts`** (110 lines) — no health service can go missing from the screens that group by it
- **`tests/ward-flow-single-source.test.ts`** (833 lines) — one source of truth
- **`tests/ward-governance-claims.test.ts`** (213 lines) — the governance data and audit disclosures
- **`tests/ward-governance-configuration-audit.dom.test.tsx`** (74 lines) — a saved configuration change appears in the governance register
- **`tests/ward-governance-registers.dom.test.tsx`** (128 lines) — GovernanceOverridesRegisterPanel
- **`tests/ward-governance.test.ts`** (330 lines) — changeAudit
- **`tests/ward-hub-community-real-teams.test.ts`** (68 lines) — the search hub lists real community teams
- **`tests/ward-hub-derivations.test.ts`** (231 lines) — hub-derivations fixture assumptions (floors the discriminating population)
- **`tests/ward-inbox-events.test.ts`** (352 lines) — ACKNOWLEDGE_INBOX_ITEM
- **`tests/ward-informational-gates.test.ts`** (51 lines) — INFORMATIONAL_GATES — the second list, and what keeps it honest
- **`tests/ward-instant-display.test.ts`** (136 lines) — nothing renders a bare clock face unless it is entitled to assert today
- **`tests/ward-leaving-destinations.test.ts`** (80 lines) — where a patient goes when they leave a ward
- **`tests/ward-management-print-coverage.test.ts`** (941 lines) — the specificity comparator itself, proven against the scenario that motivated it
- **`tests/ward-model-phase3.test.ts`** (163 lines) — Phase 3 model additions
- **`tests/ward-model.test.ts`** (271 lines) — ward model constants
- **`tests/ward-movement-fixture-reducer-reachable.test.ts`** (422 lines) — counting discipline — the generated-id matcher, proven before it is trusted (test 35)
- **`tests/ward-movement-step-back-reducer.test.ts`** (785 lines) — STEP_BACK_STAGE — refusals
- **`tests/ward-movements-corridors.test.ts`** (144 lines) — corridorCounts
- **`tests/ward-movements-derivations.test.ts`** (663 lines) — journeyStages
- **`tests/ward-movements-screen.dom.test.tsx`** (979 lines) — the Movements screen
- **`tests/ward-movements-service-scope.dom.test.tsx`** (389 lines) — Movements — service scoping (build plan D2, item 44)
- **`tests/ward-movements-traffic-diagram.dom.test.tsx`** (224 lines) — TrafficDiagram hover isolation and visual elevations
- **`tests/ward-network-queue-count.dom.test.tsx`** (95 lines) — the network's priority queue counts only people still waiting
- **`tests/ward-no-control-characters.test.ts`** (137 lines) — no ward file carries a raw control character
- **`tests/ward-notice-mark-read.dom.test.tsx`** (157 lines) — Item 48, Q2 — the Activity drawer's Mark as read control
- **`tests/ward-notice-read.test.ts`** (177 lines) — MARK_NOTICE_READ — item 48, Q2 (owner answer 48)
- **`tests/ward-notices.test.ts`** (968 lines) — assertion 1 — each decision in §1.3's table raises the notice(s) it names
- **`tests/ward-officer-blocked-reason-parity.test.ts`** (271 lines) — every officer action the screen enables is one the reducer will accept
- **`tests/ward-origin-department-absence.test.ts`** (141 lines) — what a ward surface says when an origin department will not resolve
- **`tests/ward-out-of-area-live-state.dom.test.tsx`** (154 lines) — the out-of-area board reads live admissions, not the frozen seed
- **`tests/ward-output.test.ts`** (810 lines) — ward output helpers
- **`tests/ward-override-control.dom.test.tsx`** (201 lines) — ward screen's override reason control
- **`tests/ward-override-register-render.dom.test.tsx`** (682 lines) — the coordinator's override register
- **`tests/ward-override-register.test.ts`** (169 lines) — the override register is scoped to the ward it was made against
- **`tests/ward-override-surfaces.test.ts`** (739 lines) — ward override-surface guard
- **`tests/ward-patient-page.dom.test.tsx`** (204 lines) — ward patient page — declines, changes, and escalation
- **`tests/ward-place.test.ts`** (104 lines) — wardPlaceFor
- **`tests/ward-pressure.test.ts`** (242 lines) — emergency department pressure
- **`tests/ward-priority.test.ts`** (518 lines) — operational score
- **`tests/ward-pull-admission-lifecycle.test.ts`** (238 lines) — a pull allocates a bed and marks nobody as arrived
- **`tests/ward-pull-judgement-gate.test.ts`** (117 lines) — PULL_PATIENT refuses a judgement gate on the coordinator's own path
- **`tests/ward-pull-readiness.test.ts`** (168 lines) — a patient cannot be pulled to a bed that is not ready
- **`tests/ward-pull-release-reasons.test.ts`** (35 lines) — PULL_RELEASE_REASONS
- **`tests/ward-pull-vocabulary.dom.test.tsx`** (547 lines) — the ward screen says pull, never hold, about an incoming patient
- **`tests/ward-reanchor-single-application.test.ts`** (117 lines) — the clock offset can only be applied once
- **`tests/ward-reanchor.test.ts`** (149 lines) — re-anchoring moves every instant and nothing else
- **`tests/ward-record-leaving.test.ts`** (389 lines) — recording that a patient has left
- **`tests/ward-refer-prior-decline-control.dom.test.tsx`** (133 lines) — the Refer control for a ward that only declined before
- **`tests/ward-reference-distances.test.ts`** (85 lines) — measured metropolitan road distances
- **`tests/ward-reference-teams.test.ts`** (76 lines) — the register's community-team contact detail
- **`tests/ward-refusal-gaps-bed-holding.test.ts`** (171 lines) — DECLINE refuses to waitlist a movement at more wards than the cap
- **`tests/ward-refusal-gaps-intake.test.ts`** (128 lines) — the front door refuses what it does not recognise
- **`tests/ward-refusal-gaps-new-actions.test.ts`** (196 lines) — RECORD_REPATRIATION refuses a log with any answer missing or off its list
- **`tests/ward-refusal-gaps-transport.test.ts`** (160 lines) — the states these four refusals describe are always closed movements
- **`tests/ward-refusal-gaps-vocabulary.test.ts`** (310 lines) — a value outside the model's own vocabulary is refused at runtime, not merely by the type
- **`tests/ward-role-switch-architecture.test.ts`** (195 lines) — FD-23 as architecture, not a flag that could be passed the other way
- **`tests/ward-rulings-demo.test.ts`** (88 lines) — rulingsDemoOverlay
- **`tests/ward-scenarios.test.ts`** (362 lines) — ward scenarios
- **`tests/ward-screen-refusal-surface.dom.test.tsx`** (185 lines) — ward screen surfaces a refused action to the ward user
- **`tests/ward-screen.dom.test.tsx`** (472 lines) — ward screen restriction notice
- **`tests/ward-search-refusals.test.ts`** (39 lines) — what search refuses, in the standard's own words
- **`tests/ward-service-colors.test.ts`** (75 lines) — WA Health Services Color Key & Brand Specification
- **`tests/ward-service-scope.test.ts`** (605 lines) — unitHealthService / edHealthService — the base rule (§2: a unit or ED belongs to its site's service)
- **`tests/ward-settings-configuration.dom.test.tsx`** (156 lines) — settings screen configuration draft
- **`tests/ward-shortlist-road-distance.dom.test.tsx`** (104 lines) — road distance on the shortlist
- **`tests/ward-source-control-chars-gate.test.ts`** (118 lines) — the ward source-control-character gate is reachable and still guards
- **`tests/ward-specialling-detail-claims-no-headroom.test.ts`** (97 lines) — the specialling gate's detail line
- **`tests/ward-stage-reached-at.test.ts`** (168 lines) — stageReachedAt reports the current visit, not the first one ever
- **`tests/ward-statistics-community-comparison-unlinked.dom.test.tsx`** (164 lines) — the comparison table, when the join cannot run for some admissions
- **`tests/ward-statistics-decline-reporting.dom.test.tsx`** (178 lines) — readDeclinesByReason
- **`tests/ward-statistics-derivations.test.ts`** (920 lines) — admissionStagePosition — the one place an AdmissionState VALUE is read
- **`tests/ward-statistics-discharge-date-coverage.test.ts`** (136 lines) — discharge-date coverage on one ward
- **`tests/ward-statistics-discharge-date-populations.dom.test.tsx`** (209 lines) — the discharge-dates block keeps its two populations apart
- **`tests/ward-statistics-today-counts.test.ts`** (171 lines) — Admissions today and Discharges today are bound to the calendar day, not the state alone
- **`tests/ward-teams.test.ts`** (87 lines) — ward-teams
- **`tests/ward-transit-arrival-clocks.test.ts`** (305 lines) — Coordinator & ED Transit Clocks and Telemetry
- **`tests/ward-travel-bands.test.ts`** (304 lines) — travel bands
- **`tests/ward-travel-grouping.test.ts`** (1162 lines) — grouping candidates by travel band
- **`tests/ward-urgent-figure-flags.test.ts`** (117 lines) — urgent figures: the ceiling decides the colour, never what the reader is told
- **`tests/ward-urgent-flag.dom.test.tsx`** (205 lines) — the urgent flag is visible on the row it moved
- **`tests/ward-urgent-flag.test.ts`** (420 lines) — the urgent flag — the mechanism the owner asked for and nobody could reach
- **`tests/ward-waiting-on-longest-clause.dom.test.tsx`** (104 lines) — the waiting-on picker
- **`tests/ward-withdraw-acceptance-refusal.test.ts`** (331 lines) — withdrawing an acceptance is refused without inventing a cause
- **`tests/ward-wording-lists.test.ts`** (176 lines) — ward wording lists (item 55, owner answers 2026-09-17)

### Eligibility (bed suitability) (19 files)

- **`tests/ward-console-record-gender.dom.test.tsx`** (109 lines) — coordinator console: recording gender clears the gender_designation refusal
- **`tests/ward-ed-raise-from-referral-gender-prefill.dom.test.tsx`** (157 lines) — ED screen: raising into a movement prefills gender from the linked referral
- **`tests/ward-eligibility.test.ts`** (482 lines) — authorisation
- **`tests/ward-gender-at-referral.test.ts`** (250 lines) — engine: gender decides the incoming bed check, never sex (property 1)
- **`tests/ward-gender-forward-recheck.test.ts`** (436 lines) — P1-3 scenario 1: a binary gender correction while a bed is held is caught at the next forward step
- **`tests/ward-gender-gate.test.ts`** (186 lines) — the gender gate — owner ruling 2026-09-09/2026-09-10, closing P1 #BAY1TY
- **`tests/ward-locked-not-authorised.test.ts`** (76 lines) — a locked ward that cannot lawfully detain
- **`tests/ward-non-binary-placement.test.ts`** (289 lines) — engine: a non-binary movement cannot be referred without a coordinator's recorded check (property 1)
- **`tests/ward-non-binary-single-gender-ward-placement.test.ts`** (123 lines) — engine: a Non-binary patient can be placed on a single-gender ward with a covering GenderPlacement record
- **`tests/ward-physical-facts-are-not-overridable.test.ts`** (325 lines) — physical facts cannot be overridden — no allocatable bed
- **`tests/ward-raise-referral-gender-diagnosis-guard.test.ts`** (81 lines) — engine: RAISE_REFERRAL refuses an off-list gender or diagnosis (Opus review round 2)
- **`tests/ward-referral-match-gender-placement-single-gender-ward.dom.test.tsx`** (112 lines) — ReferralMatchView: a single-gender ward offers the non-binary placement form instead of the decline branch
- **`tests/ward-referral-match-gender-placement.dom.test.tsx`** (135 lines) — ReferralMatchView: a non-binary placement explains itself, then succeeds once answered
- **`tests/ward-refusal-gaps-referrals.test.ts`** (284 lines) — ACCEPT_REFERRAL's gender-placement gate refuses a coordinator's incomplete record (line 5878)
- **`tests/ward-screen-eligibility-warning.dom.test.tsx`** (179 lines) — ward screen eligibility warning — fixture sanity
- **`tests/ward-screen-eligibility-warning.test.ts`** (101 lines) — eligibility warning
- **`tests/ward-screen-gender-designation-privacy.dom.test.tsx`** (120 lines) — ward screen gender_designation privacy — a single-gender mismatch
- **`tests/ward-shortlist-gender-placement-single-gender-ward.dom.test.tsx`** (84 lines) — ShortlistPanel: a single-gender ward offers the non-binary placement form instead of hiding as unavailable (WF-012)
- **`tests/ward-shortlist-gender-placement.dom.test.tsx`** (103 lines) — ShortlistPanel: a non-binary placement explains itself, then succeeds once answered (WF-012)

### Referrals (module and pipeline) (68 files)

- **`tests/ward-ban-scope.test.ts`** (289 lines) — every retired-wording ban reads a whole page or screen
- **`tests/ward-chrome-tap-targets.test.ts`** (90 lines) — Wave-2 chrome tap targets — rail Raise Referral and home link
- **`tests/ward-community-demonstration-data.test.ts`** (190 lines) — the Midland demonstration referrals
- **`tests/ward-community-referral-survives.test.ts`** (99 lines) — a ward accepting a patient does not cancel their community follow-up
- **`tests/ward-decline-reason-by-destination.test.ts`** (200 lines) — DECLINE_REFERRAL reason is scoped to the destination kind that is answering
- **`tests/ward-diagnosis-from-referral.test.ts`** (221 lines) — engine: a referral's tentative diagnosis survives raise and pull unchanged (property 1)
- **`tests/ward-ed-no-referral-raised.dom.test.tsx`** (48 lines) — recording that nobody raised a referral
- **`tests/ward-ed-referral-is-not-a-bed-request.test.ts`** (71 lines) — an ED referral is a notification, not a bed request
- **`tests/ward-ed-to-community-referral.test.ts`** (540 lines) — an emergency department may refer a discharged patient to a community team
- **`tests/ward-ed-withdraw-referral.dom.test.tsx`** (166 lines) — withdrawing a referral from the emergency department
- **`tests/ward-movement-referral-link.test.ts`** (509 lines) — a journey raised from a referral resolves back to that exact referral
- **`tests/ward-network-referral-clocks.dom.test.tsx`** (128 lines) — the referral clocks on the network diagram
- **`tests/ward-network-referral-placement.dom.test.tsx`** (1144 lines) — network diagram, referral placement
- **`tests/ward-parallel-referral-cap-ui.dom.test.tsx`** (128 lines) — coordinator/shortlist-panel.tsx reads the configured parallel referral cap
- **`tests/ward-pull-keeps-referral-link.test.ts`** (194 lines) — PULL_PATIENT keeps the referral link its own movement already carries
- **`tests/ward-raise-referral-uniqueness.test.ts`** (370 lines) — RAISE_REFERRAL refuses a second journey while an earlier one is still open
- **`tests/ward-re-referral-adds.test.ts`** (194 lines) — re-referring adds wards and keeps the live ones (item 18)
- **`tests/ward-referral-awaiting-answer.test.ts`** (217 lines) — isAwaitingAnswer — one rule, at the destination level
- **`tests/ward-referral-clocks.test.ts`** (169 lines) — a referral's two clocks
- **`tests/ward-referral-content-is-immutable-after-sending.test.ts`** (209 lines) — a sent referral's content is immutable (C2)
- **`tests/ward-referral-control-labels.dom.test.tsx`** (97 lines) — the two referral controls are findable by the words on them
- **`tests/ward-referral-decided-heading.dom.test.tsx`** (136 lines) — the referral board's decided heading names the total, not the display cap
- **`tests/ward-referral-decision-scope.test.ts`** (357 lines) — a role may only answer the destination it is
- **`tests/ward-referral-destination-list-clears-legend.test.ts`** (64 lines) — the referral form's destination list clears the floated legend
- **`tests/ward-referral-destinations.dom.test.tsx`** (759 lines) — Referral destinations — the option list itself
- **`tests/ward-referral-duplicate.test.ts`** (266 lines) — the duplicate sentence
- **`tests/ward-referral-ed-destination-validation.test.ts`** (105 lines) — an emergency-department destination is validated like every other governed field
- **`tests/ward-referral-ed-destination.test.ts`** (110 lines) — the emergency-department destination
- **`tests/ward-referral-ed-medical-source.test.ts`** (211 lines) — a referral from ED medical staff must come from a hospital that has an ED
- **`tests/ward-referral-history-honesty.test.ts`** (123 lines) — K2 — referral history honesty (2026-09-17 pin)
- **`tests/ward-referral-history-immutable.test.ts`** (196 lines) — ADD_REFERRAL_CORRECTION — RB7, build plan item 27 (2026-09-17)
- **`tests/ward-referral-history-is-one-optional-field.test.ts`** (106 lines) — the referral's history — one field, optional, last
- **`tests/ward-referral-intake-sections.dom.test.tsx`** (278 lines) — raise a referral — grouping, state and the rulings the drawing lost
- **`tests/ward-referral-intake-sending-team.dom.test.tsx`** (129 lines) — the sending-team question exists and is optional
- **`tests/ward-referral-intake-third-edition.dom.test.tsx`** (219 lines) — ReferralIntakeForm — Third Edition Sovereign Person & Rapid Search
- **`tests/ward-referral-kind-pair-gap.test.ts`** (116 lines) — RECEIVE_REFERRAL — GAP: the reducer does not reject {psychiatric_ward, community_team}
- **`tests/ward-referral-match-hooks-order.dom.test.tsx`** (138 lines) — ReferralMatchView — every hook is called above the not-a-bed-question early return
- **`tests/ward-referral-match-non-ward-decline.dom.test.tsx`** (283 lines) — the emergency-department decline control on the 'no bed shortlist' panel
- **`tests/ward-referral-match-suburb.dom.test.tsx`** (113 lines) — the seed actually holds a referral with an unknown suburb
- **`tests/ward-referral-matching.test.ts`** (888 lines) — eligibility matching field by field: age, legal_status, gender_designation, sex_mix independence, forensic, and more (many `describe` blocks; first is "age")
- **`tests/ward-referral-model.test.ts`** (1849 lines) — bed category — SexDesignation
- **`tests/ward-referral-no-bed-breakdown.test.ts`** (157 lines) — why nobody can take this patient
- **`tests/ward-referral-producers.test.ts`** (212 lines) — every Referral field has something that can write it
- **`tests/ward-referral-query-prefill.dom.test.tsx`** (277 lines) — the intake form reads the query contract
- **`tests/ward-referral-receipt-integrity.dom.test.tsx`** (71 lines) — accepted referral receipt
- **`tests/ward-referral-reducer.test.ts`** (1751 lines) — RECEIVE_REFERRAL
- **`tests/ward-referral-referrer.test.ts`** (105 lines) — referralReferrerName (D-12 — the referrer is the recorded source, never a source type)
- **`tests/ward-referral-screen-boundary.test.ts`** (886 lines) — FD-23 at the screen boundary
- **`tests/ward-referral-screens.dom.test.tsx`** (3665 lines) — the largest test file in the suite: `ReferralIntakeForm` and `ReferralBoard` DOM behaviour end to end, including the recently-decided cap, refusal-then-acceptance ordering, and cancelled-destination wording (first `describe` is a helper, `clickExpectingNoError`)
- **`tests/ward-referral-sending-team-display.test.ts`** (122 lines) — the sending team as a display fragment
- **`tests/ward-referral-sending-team.test.ts`** (167 lines) — a referral records the team or service that sent it
- **`tests/ward-referral-sex-absence-split.test.ts`** (71 lines) — the absent sex is stated on the board and left inferable for an ED
- **`tests/ward-referral-sex-cell.test.ts`** (90 lines) — the referral board's Sex column
- **`tests/ward-referral-suburb-pin.test.ts`** (261 lines) — the suburb note, and the model fact that is the only reason it is true
- **`tests/ward-referral-suburb.test.ts`** (183 lines) — a referral records its suburb
- **`tests/ward-referral-unsaved-history-warning.dom.test.tsx`** (173 lines) — the referral history's unsaved-departure warning (D-11)
- **`tests/ward-referral-visibility.test.ts`** (3021 lines) — FD-23 — a ward cannot see where else a patient has been referred
- **`tests/ward-referral-wait-line.test.ts`** (111 lines) — the wait figure the referral board and match view print
- **`tests/ward-referral-withdrawn-counts.test.ts`** (89 lines) — WF-13 T11 — the nav count drops when a referral is withdrawn
- **`tests/ward-referrals-print.test.ts`** (262 lines) — Ward referrals — print background stays ink-on-paper under dark theme
- **`tests/ward-referrer-withdrawal.test.ts`** (328 lines) — recording that a referrer withdrew their referral
- **`tests/ward-seed-referral-census.test.ts`** (184 lines) — K1 — seedWardFlowState() referral census (2026-09-17 pin)
- **`tests/ward-statistics-null-referral-id.dom.test.tsx`** (105 lines) — the statistics screen's account of a null referral id
- **`tests/ward-statistics-ward-referrals-section.dom.test.tsx`** (175 lines) — the ward statistics screen's referral counts
- **`tests/ward-statistics-ward-referrals.test.ts`** (144 lines) — referrals into one ward
- **`tests/ward-track-c-fixes.dom.test.tsx`** (217 lines) — Track C Referral Matching fixes
- **`tests/ward-withdraw-referral.test.ts`** (450 lines) — a referrer taking its referral back
- **`tests/ward-withdrawal-reason-privacy.test.ts`** (367 lines) — the leak detector itself, proved before it is trusted against real reasons

### Legal status and Mental Health Act forms (21 files)

- **`tests/ward-act-section-citation-guard.test.ts`** (273 lines) — no Mental Health Act section citations in product code, comments, tests or drawings (D5)
- **`tests/ward-audit-legal-recorded-time.dom.test.tsx`** (63 lines) — Legal Forms current paper facts
- **`tests/ward-delays-breached-clock-urgency.dom.test.tsx`** (175 lines) — a lapsed legal authority is never quieter than one still running
- **`tests/ward-delays-legal-deadline.dom.test.tsx`** (216 lines) — the delays screen states the legal deadline it is already reacting to
- **`tests/ward-ed-legal-clock.dom.test.tsx`** (61 lines) — the emergency department board does not merge the ED clock into a form clock
- **`tests/ward-engine-rulings-wave1.test.ts`** (462 lines) — ward-legal-clock durations (Mental Health Act 2014)
- **`tests/ward-five-gaps.test.ts`** (190 lines) — RECORD_LEGAL_FORM_RECEIVED accepts the nine clock forms
- **`tests/ward-form-labels-from-register.test.ts`** (111 lines) — every rendered form label comes from the Chief Psychiatrist register
- **`tests/ward-legal-clock-needs-written-time.dom.test.tsx`** (182 lines) — the ED screen's form-expiry line never reads formedAt
- **`tests/ward-legal-figure-guard.test.ts`** (3359 lines) — Mental Health Act figures cannot return to the ward model
- **`tests/ward-legal-form-audit-outcome.test.ts`** (89 lines) — legal-form events are audited with the outcome they actually had
- **`tests/ward-legal-form-due-at-capture.test.ts`** (432 lines) — a coordinator's own transport order can carry a deadline
- **`tests/ward-legal-form-receipt-correction.test.ts`** (194 lines) — CORRECT_LEGAL_FORM_RECEIPT — the undo RECORD_LEGAL_FORM_RECEIVED has never had
- **`tests/ward-legal-forms-derivations.test.ts`** (311 lines) — legalFormPopulation (anti-vacuity floor)
- **`tests/ward-legal-forms-not-wired-and-register.dom.test.tsx`** (120 lines) — Legal forms — unwired confirm controls (F2.1)
- **`tests/ward-legal-forms-screen.dom.test.tsx`** (185 lines) — the Legal forms screen
- **`tests/ward-legal-language.test.ts`** (110 lines) — ward legal-language scanner
- **`tests/ward-mha-calculator.test.ts`** (362 lines) — Mental Health Act Statutory Deadline Calculator
- **`tests/ward-refusal-gaps-legal-and-diversion.test.ts`** (483 lines) — RECORD_DIVERSION: has no transport job to divert (line 7358)
- **`tests/ward-repeat-examination.test.ts`** (434 lines) — PATIENT_COLLECTED — refused while examinationRevokedWhileBedHeld (T9, owner answer 5, second round 2026-09-17)
- **`tests/ward-restriction-notice.test.ts`** (35 lines) — restriction notice

### Capacity, bed release and preparation (36 files)

- **`tests/ward-acuity-gate.test.ts`** (441 lines) — the acuity gate discriminates, on both paths
- **`tests/ward-audit-capacity-observation.dom.test.tsx`** (59 lines) — capacity observations on the answer screen
- **`tests/ward-bed-designation.test.ts`** (79 lines) — bed designation arithmetic
- **`tests/ward-bed-kind-pull.test.ts`** (440 lines) — PULL_PATIENT decides bed kind from the request's own security (item 11, owner answer 11)
- **`tests/ward-bed-release-lifecycle.test.ts`** (795 lines) — ward bed release lifecycle
- **`tests/ward-bed-release-threshold-provenance.test.ts`** (280 lines) — the bed-release threshold is the owner's operational figure, and is pinned apart from the Act
- **`tests/ward-bed-release.dom.test.tsx`** (419 lines) — ward bed release flag
- **`tests/ward-board-leave-beds.dom.test.tsx`** (113 lines) — the bed board's On leave figure counts real leave beds
- **`tests/ward-capacity-absorbed-morning-coverage.dom.test.tsx`** (209 lines) — 20 cases proving the Capacity screen absorbed what the retired standalone Morning Rollup page used to cover (Case 1: "Capacity identifies synthetic data beside its current provenance")
- **`tests/ward-capacity-bed-map.dom.test.tsx`** (187 lines) — BedMap — the network's whole bed supply, one square per bed
- **`tests/ward-capacity-bed-map.test.ts`** (177 lines) — bedMapWards — the bed map's per-ward figures
- **`tests/ward-capacity-controls.dom.test.tsx`** (321 lines) — the Capacity screen's Wards controls
- **`tests/ward-capacity-derivation-agreement.test.ts`** (129 lines) — the two capacity derivations agree, unit by unit
- **`tests/ward-capacity-derivations.test.ts`** (486 lines) — bedKindGaps
- **`tests/ward-capacity-figure-one-word.test.ts`** (193 lines) — R-B-09: one word for min(allocatable, empty), product-wide
- **`tests/ward-capacity-freshness-source.dom.test.tsx`** (116 lines) — the Capacity screen's freshness stamp reflects allocatable.source, never an unconditional ward confirmation
- **`tests/ward-capacity-network-fold-empty-service.dom.test.tsx`** (105 lines) — a health service with no reporting unit renders a sentence, never a heading over nothing
- **`tests/ward-capacity-network-fold.dom.test.tsx`** (441 lines) — the Capacity network table walks every health service, or the suite below is vacuous
- **`tests/ward-capacity-reconciliation.test.ts`** (88 lines) — unit bed-state reconciliation
- **`tests/ward-capacity-screen.dom.test.tsx`** (710 lines) — the Capacity screen
- **`tests/ward-capacity-service-scope.dom.test.tsx`** (344 lines) — Capacity screen service scope — the fixture actually has something to prove
- **`tests/ward-capacity-sexmix-release.dom.test.tsx`** (210 lines) — the Capacity screen says when a ward's bed records are mid-update
- **`tests/ward-capacity-view.dom.test.tsx`** (470 lines) — ward capacity board
- **`tests/ward-capacity-zero-spelling.dom.test.tsx`** (196 lines) — the capacity network table spells zero one way per row
- **`tests/ward-flow-reducer-confirm-capacity.test.ts`** (110 lines) — CONFIRM_CAPACITY bounds a ward's restated allocatable count
- **`tests/ward-morning-rollup.test.ts`** (215 lines) — Morning Bed Rollup and Ward Buzz state tracking
- **`tests/ward-pending-preparation-populations.test.ts`** (97 lines) — the two preparation populations
- **`tests/ward-refinement-discharge-ui.dom.test.tsx`** (142 lines) — Q004 Capacity and Discharges refinement journeys
- **`tests/ward-release-band-day-boundary.test.ts`** (120 lines) — releaseBand across a day boundary
- **`tests/ward-release-day-chooser.dom.test.tsx`** (178 lines) — ward release/leave forms — Today/Tomorrow day chooser
- **`tests/ward-release-day.test.ts`** (82 lines) — parseReleaseDayInstant
- **`tests/ward-screen-capacity-wording.dom.test.tsx`** (155 lines) — the ward screen's word for min(allocatable, empty)
- **`tests/ward-screen-morning-rollup.dom.test.tsx`** (134 lines) — WardScreen 09:30 Morning Rollup & Notification Center
- **`tests/ward-service-capacity-tracker.test.ts`** (310 lines) — service-capacity-tracker: deriveBedCapacityTone
- **`tests/ward-specialling-capacity.test.ts`** (583 lines) — the bench is a clinically coherent placement, not just a convenient one
- **`tests/ward-statistics-ward-capacity.dom.test.tsx`** (202 lines) — ward capacity — Ready, Empty, Allocatable

### Per-screen DOM tests, by screen

#### Community (28 files)

- **`tests/ward-community-corrected-claims.test.ts`** (627 lines) — the community screens rendered something to scan at all
- **`tests/ward-community-durations-not-dates.test.ts`** (167 lines) — the community route prints durations, never calendar dates
- **`tests/ward-community-figures.dom.test.tsx`** (93 lines) — CommunityFigures [describe.skip — retired/disabled]
- **`tests/ward-community-gateway.dom.test.tsx`** (405 lines) — Community gateway — the floor this whole file stands on
- **`tests/ward-community-governance-claims.dom.test.tsx`** (174 lines) — the claims the live community screens make
- **`tests/ward-community-hub.dom.test.tsx`** (1421 lines) — community hub — an unknown team is never another team
- **`tests/ward-community-hub.test.ts`** (430 lines) — the community hub's team pages
- **`tests/ward-community-index.test.ts`** (602 lines) — the numeral guard's own controls — it must fire on the defect and not on the fix
- **`tests/ward-community-membership-resolution.test.ts`** (255 lines) — a team's empty list says which kind of empty it is
- **`tests/ward-community-near-duplicate-warning.dom.test.tsx`** (276 lines) — the near-duplicate warning appears exactly where it is true
- **`tests/ward-community-ratified-alias-on-screen.dom.test.tsx`** (238 lines) — a ratified service ruling reaches the reader
- **`tests/ward-community-ratified-aliases.test.ts`** (220 lines) — the ratified service aliases
- **`tests/ward-community-ratified-provenance.dom.test.tsx`** (195 lines) — an agent-decided alias never renders as a person's signature
- **`tests/ward-community-scope.dom.test.tsx`** (101 lines) — CommunityHome — the coordinator's scope switch [describe.skip — retired/disabled]
- **`tests/ward-community-team-contact-mapping.test.ts`** (129 lines) — community team contact mapping
- **`tests/ward-community-team-count.test.ts`** (145 lines) — Community team count — the number on screen, checked against its own source
- **`tests/ward-community-team-hub.dom.test.tsx`** (207 lines) — CommunityTeamHub — the community role's own, restricted landing [describe.skip — retired/disabled]
- **`tests/ward-community-team-list-source.test.ts`** (95 lines) — the community team screen's list source
- **`tests/ward-community-team-single-source.test.ts`** (137 lines) — the community hub's one source
- **`tests/ward-community-third-edition-headings.dom.test.tsx`** (344 lines) — the community team screen's third-edition headings
- **`tests/ward-community-transport.dom.test.tsx`** (248 lines) — community admitted table — transport booking and cancel
- **`tests/ward-community-viewer-assumption.test.ts`** (115 lines) — the community-viewer assumption, inverted for the projection that now exists
- **`tests/ward-community-vocabulary.test.ts`** (241 lines) — the community team vocabulary and the options inside it that collide
- **`tests/ward-leave-is-not-a-community-order.test.ts`** (133 lines) — leave is an inpatient act, never a community treatment order
- **`tests/ward-statistics-community-figures.test.ts`** (85 lines) — the community figures table, when the join cannot run
- **`tests/ward-statistics-community-people.test.ts`** (107 lines) — the per-person hospital-bed list
- **`tests/ward-statistics-community-provenance.dom.test.tsx`** (104 lines) — the community screen's provenance section
- **`tests/ward-statistics-community-scope-note.dom.test.tsx`** (94 lines) — the community screen's scope note

#### ED (19 files)

- **`tests/ward-ed-answered-cap.dom.test.tsx`** (142 lines) — recently answered holds ten — owner ruling 19
- **`tests/ward-ed-css-classes-exist.test.ts`** (152 lines) — ed.module.css carries every class ed-screen.tsx references
- **`tests/ward-ed-due-at-field.dom.test.tsx`** (114 lines) — the expiry field is asked for whichever form is selected
- **`tests/ward-ed-due-at-parsing.dom.test.tsx`** (148 lines) — the typed deadline reaches the movement, and an untyped one stays absent
- **`tests/ward-ed-expects-order.dom.test.tsx`** (134 lines) — the Expects list is ordered the way it says it is
- **`tests/ward-ed-form-expiry.dom.test.tsx`** (250 lines) — the ED screen's form-expiry line reads only the typed expiry
- **`tests/ward-ed-home.dom.test.tsx`** (183 lines) — EdHome [describe.skip — retired/disabled]
- **`tests/ward-ed-no-transport-needed.dom.test.tsx`** (58 lines) — recording that no transport is needed
- **`tests/ward-ed-outcomes.test.ts`** (238 lines) — RECORD_ED_OUTCOME — withdraws live requests
- **`tests/ward-ed-psychiatry-hub.dom.test.tsx`** (1877 lines) — the ED psychiatry inbox selector
- **`tests/ward-ed-screen.dom.test.tsx`** (1230 lines) — emergency department intake picker
- **`tests/ward-ed-service-bands.dom.test.tsx`** (104 lines) — EdServiceBands [describe.skip — retired/disabled]
- **`tests/ward-ed-transport-booking.dom.test.tsx`** (484 lines) — booking transport from the sending emergency department
- **`tests/ward-statistics-ed-about-figures.dom.test.tsx`** (145 lines) — the ED screen's 'About the figures on this page' panel
- **`tests/ward-statistics-ed-bands.test.ts`** (141 lines) — the five wait bands
- **`tests/ward-statistics-ed-comparison.dom.test.tsx`** (165 lines) — comparison across departments
- **`tests/ward-statistics-ed-over-time.dom.test.tsx`** (127 lines) — the two over-time sections the prototype cannot support
- **`tests/ward-statistics-ed-wait-chart.dom.test.tsx`** (293 lines) — the elapsed-wait chart and its named longest waits
- **`tests/ward-statistics-ed-waits.test.ts`** (215 lines) — who is on this department's list right now

#### Board (bed board) (19 files)

- **`tests/ward-board-arrival-match.test.ts`** (46 lines) — movementForBoardArrival — identity only
- **`tests/ward-board-consistency.test.ts`** (146 lines) — the ward board's tiles agree with the unit's own figures
- **`tests/ward-board-discharge.dom.test.tsx`** (271 lines) — recording a departure from the ward board
- **`tests/ward-board-figures-and-tiles-structural.dom.test.tsx`** (93 lines) — the bed board never drops a tile or a figure at the DOM/JS level (item 51, task G1)
- **`tests/ward-board-live-state.dom.test.tsx`** (158 lines) — the ward board reads live state, not the seed
- **`tests/ward-board-page.dom.test.tsx`** (280 lines) — ward board page
- **`tests/ward-board-people-print.test.ts`** (31 lines) — Ward board — Who is in these beds stays print-only
- **`tests/ward-board-selection.dom.test.tsx`** (480 lines) — ward board selection — nothing is chosen for the reader
- **`tests/ward-board-service-sentence.dom.test.tsx`** (85 lines) — fixture sanity
- **`tests/ward-board-third-edition-headings.dom.test.tsx`** (202 lines) — the bed board's third-edition headings
- **`tests/ward-board-tile-labels-distinct.dom.test.tsx`** (105 lines) — the board's given-away tile is never readable as its fillable tile
- **`tests/ward-board-tiles-claim-no-order.dom.test.tsx`** (86 lines) — the bed grid does not assert an order it cannot support
- **`tests/ward-board-time-features.test.ts`** (85 lines) — ward board-time features
- **`tests/ward-board-triage.dom.test.tsx`** (270 lines) — ward board triage bar — the home page's six figures, in the home page's words
- **`tests/ward-daily-return-rows.dom.test.tsx`** (323 lines) — the daily return — five questions, three of which are confirmations
- **`tests/ward-daily-sheet-placement.dom.test.tsx`** (83 lines) — the daily sheet's away line renders after every group, not merely after every heading
- **`tests/ward-daily-sheet.dom.test.tsx`** (743 lines) — the daily sheet exists on the board and says what it is
- **`tests/ward-discharge-board-plan-departure-and-kpi.dom.test.tsx`** (119 lines) — the '+ Plan departure' control no longer opens a false dialog
- **`tests/ward-discharge-board.dom.test.tsx`** (457 lines) — DischargeBoard

#### Ward (per-ward operational screen) (9 files)

- **`tests/ward-answer-current-facts.dom.test.tsx`** (248 lines) — Ward answer current facts
- **`tests/ward-screen-cancel-unavailable.dom.test.tsx`** (97 lines) — the ward screen and the cancel it may no longer make
- **`tests/ward-screen-fd23-leaks.dom.test.tsx`** (348 lines) — FD-23 on the ward page
- **`tests/ward-screen-handover-link.dom.test.tsx`** (110 lines) — the ward screen's handover link
- **`tests/ward-screen-landmark-names.dom.test.tsx`** (133 lines) — the ward screen names each folded panel once, not twice
- **`tests/ward-screen-overview-and-entry.dom.test.tsx`** (256 lines) — the ward screen — the bed-list control is never gated by the confirm panel
- **`tests/ward-screen-service-sentence.dom.test.tsx`** (98 lines) — fixture sanity
- **`tests/ward-screen-third-edition-headings.dom.test.tsx`** (218 lines) — the ward screen's heading contract
- **`tests/ward-screen-third-edition-title.test.ts`** (64 lines) — the ward route's document title

#### Patients (20 files)

- **`tests/ward-add-patient.dom.test.tsx`** (623 lines) — AddPatientForm
- **`tests/ward-coordinator-suburb.dom.test.tsx`** (202 lines) — coordinator shortlist shows a referred patient's suburb
- **`tests/ward-delays-resolved-outcome.dom.test.tsx`** (126 lines) — the delays screen never calls a patient placed who did not arrive
- **`tests/ward-near-patient-suggestions.test.ts`** (245 lines) — nearPatients — the three confusable pairs, all of them
- **`tests/ward-network-initial-patient-selection.dom.test.tsx`** (88 lines) — initialNetworkPatientId — the network placement workspace's default selection
- **`tests/ward-patient-discharge.test.ts`** (206 lines) — patient-linked discharge transition
- **`tests/ward-patient-identity-integrity.test.ts`** (42 lines) — patient identity requires explicit compatible links
- **`tests/ward-patient-link-default-deny.test.ts`** (376 lines) — D-14 default-deny: the patient link is read only where explicitly permitted
- **`tests/ward-patient-model.test.ts`** (419 lines) — Patient identity is a ruling, not a drift
- **`tests/ward-patient-now-screen.dom.test.tsx`** (331 lines) — the patient-now screen
- **`tests/ward-patient-now.dom.test.tsx`** (119 lines) — the person now — identity absences (D-6)
- **`tests/ward-patient-placement-fields.dom.test.tsx`** (155 lines) — the placement rule for the two sensitive fields (R-2026-09-04-A)
- **`tests/ward-patient-search.dom.test.tsx`** (1111 lines) — PatientSearchPage
- **`tests/ward-patient-search.test.ts`** (343 lines) — searchMovements
- **`tests/ward-patient-sensitive-adjacency-css.test.ts`** (331 lines) — the two sensitive patient fields cannot become adjacent by reflow
- **`tests/ward-patient-transport-section.dom.test.tsx`** (190 lines) — Patient Transport & Transfer Coordination section
- **`tests/ward-patient-typeahead.dom.test.tsx`** (284 lines) — test fixtures
- **`tests/ward-patient-typed-text-not-in-url.dom.test.tsx`** (229 lines) — Typed patient text never reaches a URL
- **`tests/ward-person-screen.dom.test.tsx`** (581 lines) — a person's own screen
- **`tests/ward-register-inpatient-form-codes.test.ts`** (102 lines) — ward register MHA authorities

#### Movements (14 files)

- **`tests/ward-alerts-open-movements-only.dom.test.tsx`** (111 lines) — the alerts screen scopes buildActionInbox to open movements only
- **`tests/ward-cancel-transport-stage.test.ts`** (170 lines) — CANCEL_TRANSPORT leaves the movement's stage exactly where it found it
- **`tests/ward-console-examination-revoked-flag.dom.test.tsx`** (164 lines) — movement console — revoked-while-bed-held flag (T8)
- **`tests/ward-console-step-back-holds-bed.dom.test.tsx`** (93 lines) — correcting a stage on a movement that is holding a bed
- **`tests/ward-console-timeline-reasons.test.ts`** (151 lines) — the movement workspace's stage-transition reason labels
- **`tests/ward-coordinator-closed-selection.dom.test.tsx`** (134 lines) — the coordinator screen never keeps a closed movement selected (WF-22)
- **`tests/ward-management-print.test.ts`** (325 lines) — the movement workspace prints as ink on paper, not as a dark band
- **`tests/ward-movement-absence-wording.test.ts`** (79 lines) — an id this screen cannot resolve names the record, never the network
- **`tests/ward-movement-blocker.test.ts`** (801 lines) — Movement.blocker — free prose, and it must stay that way
- **`tests/ward-movement-horizon-truth.test.ts`** (166 lines) — deriveMovementHorizonLanes reads the live movements it is given
- **`tests/ward-movement-horizon-visual.dom.test.tsx`** (276 lines) — 48-Hour Bed Movement Horizon (Gantt Chart)
- **`tests/ward-movement-stage-changes.test.ts`** (556 lines) — the derived case list (Task 4, step 1's floor)
- **`tests/ward-movement-third-edition.dom.test.tsx`** (169 lines) — the Movements screen's panels, in the order a coordinator meets them
- **`tests/ward-movement-transport-need.test.ts`** (195 lines) — transportNeedState names three states and never collapses two of them

#### Coordinator (home) (5 files)

- **`tests/ward-coordinator-screen.dom.test.tsx`** (21 lines) — CoordinatorScreen
- **`tests/ward-refinement-interactions.dom.test.tsx`** (112 lines) — Q004 refinement interaction regressions
- **`tests/ward-shortlist-candidates.test.ts`** (321 lines) — shortlistCandidates — every ward, with an honest verdict
- **`tests/ward-shortlist-ward-detail.dom.test.tsx`** (120 lines) — ShortlistPanel's ward detail block
- **`tests/ward-shortlist.dom.test.tsx`** (413 lines) — ShortlistPanel escalation contact

#### Delays (6 files)

- **`tests/ward-delays-alias.test.ts`** (22 lines) — delays alias pedagogy (Wave 4 item 15)
- **`tests/ward-delays-nobody-waiting.dom.test.tsx`** (143 lines) — the delays screen when nobody is waiting
- **`tests/ward-delays-screen.dom.test.tsx`** (780 lines) — the Delays screen
- **`tests/ward-delays-third-edition.dom.test.tsx`** (293 lines) — Delays — the drawing's panel names (task D1)
- **`tests/ward-delays-type-ranks.test.ts`** (121 lines) — the Delays waiting row keeps its type ranks after the 12px raise (O-16.2)
- **`tests/ward-escalation.dom.test.tsx`** (162 lines) — EscalationBoardPage [describe.skip — retired/disabled]

#### Handover (6 files)

- **`tests/ward-handover-filters.dom.test.tsx`** (287 lines) — HandoverPage — the filter control
- **`tests/ward-handover-filters.test.ts`** (385 lines) — parseHandoverScope / handoverScopeValue round-trip
- **`tests/ward-handover-print.test.ts`** (145 lines) — Ward shift handover — print background stays ink-on-paper under dark theme
- **`tests/ward-handover-scope-from-url.dom.test.tsx`** (124 lines) — the handover sheet takes its scope from the URL
- **`tests/ward-handover.dom.test.tsx`** (395 lines) — HandoverPage
- **`tests/ward-handover.test.ts`** (182 lines) — handoverSnapshot

#### Settings (3 files)

- **`tests/ward-settings-appearance.dom.test.tsx`** (146 lines) — the settings screen's appearance control
- **`tests/ward-settings-screen.dom.test.tsx`** (267 lines) — the settings screen
- **`tests/ward-settings-thresholds.test.ts`** (123 lines) — the thresholds this prototype publishes

#### Alerts / inbox (8 files)

- **`tests/ward-acknowledge-inbox-item-id-validation.test.ts`** (89 lines) — ACKNOWLEDGE_INBOX_ITEM inboxItemId validation
- **`tests/ward-alerts-not-wired-and-counts.dom.test.tsx`** (87 lines) — Alerts — confirm controls (F3.1)
- **`tests/ward-alerts-screen.dom.test.tsx`** (186 lines) — the Alerts screen reports on every condition it watches, firing or not
- **`tests/ward-alerts-sovereign-features.dom.test.tsx`** (90 lines) — Alerts — Third Edition Sovereign Enhancements
- **`tests/ward-broadcast-alerts.dom.test.tsx`** (116 lines) — Ward Flow Statewide Broadcast Alerts
- **`tests/ward-inbox-classification.test.ts`** (304 lines) — every action-inbox category is classified as a fact or a commitment
- **`tests/ward-inbox-probe.test.ts`** (42 lines) — INBOX_CATEGORIES id prefixes
- **`tests/ward-service-bed-alerts.test.ts`** (164 lines) — deriveServiceBedAlerts

#### Search hub (3 files)

- **`tests/ward-hub-reconciliation-line.test.ts`** (96 lines) — the Search hub's reconciliation line
- **`tests/ward-hub-route.test.ts`** (283 lines) — Ward Flow hub route (/mockups/ward-flow/hub)
- **`tests/ward-hub-screen.dom.test.tsx`** (841 lines) — Ward Flow Master Search Hub — fixture assumptions (floors the discriminating population)

#### Discharges (2 files)

- **`tests/ward-discharge-blocked-emphasis.dom.test.tsx`** (146 lines) — the discharges board raises the blocked group, and only while it has rows
- **`tests/ward-discharge-column-contract.dom.test.tsx`** (167 lines) — the discharges board's column contract

#### Transport officer (15 files)

- **`tests/ward-book-transport-acting-unit-validation.test.ts`** (75 lines) — BOOK_TRANSPORT actingUnitId validation
- **`tests/ward-book-transport.test.ts`** (377 lines) — BOOK_TRANSPORT
- **`tests/ward-cancel-transport-no-bed-held.test.ts`** (295 lines) — CANCEL_TRANSPORT when no bed is held
- **`tests/ward-console-cancel-authority-copy.dom.test.tsx`** (178 lines) — the orphaned-transport panel's cancel-authority copy
- **`tests/ward-governance-enumerations.dom.test.tsx`** (183 lines) — the officer screen's sentence and its filter agree
- **`tests/ward-officer-kpi-and-copy.dom.test.tsx`** (323 lines) — officer screen KPI captions match their populations
- **`tests/ward-officer-print.test.ts`** (50 lines) — Transport officer — print keeps job content visible
- **`tests/ward-officer-stepper.dom.test.tsx`** (90 lines) — the transport officer's job cards render a leg stepper
- **`tests/ward-stop-transport.test.ts`** (426 lines) — stopping a collected transport — WLQ-38 (owner, 2026-09-15)
- **`tests/ward-tracker-leg-badge.dom.test.tsx`** (130 lines) — live tracker leg badges [describe.skip — retired/disabled]
- **`tests/ward-transport-cancel-no-rebook.test.ts`** (236 lines) — CANCEL_TRANSPORT with a bed held no longer rebooks automatically (owner answer 30)
- **`tests/ward-transport-cancel-permission.test.ts`** (362 lines) — who may cancel a transport
- **`tests/ward-transport-not-needed.test.ts`** (181 lines) — "No transport needed" — owner answer 10 (second round, 2026-09-17)
- **`tests/ward-transport-page-name.test.ts`** (158 lines) — the transport page names itself the same way everywhere a user can hear it
- **`tests/ward-transport-status-label-stopped.test.ts`** (63 lines) — transportStatusLabel — a stopped job reads as stopped, not cancelled

#### On-call (2 files)

- **`tests/ward-on-call-holds-no-people.test.ts`** (241 lines) — the on-call screen holds no people and nothing to ring
- **`tests/ward-on-call-screen.dom.test.tsx`** (137 lines) — the on-call screen

#### Out of area (2 files)

- **`tests/ward-out-of-area-figure-direction.dom.test.tsx`** (69 lines) — the out-of-area board layout ordering
- **`tests/ward-out-of-area-upgrade.dom.test.tsx`** (172 lines) — out-of-area upgrade — functional layout and clean presentation

#### Statistics (24 files)

- **`tests/ward-statistics-absence.test.ts`** (90 lines) — a statistics figure carries its own state
- **`tests/ward-statistics-claims.test.ts`** (797 lines) — the model-claims register
- **`tests/ward-statistics-compare-two-tables.dom.test.tsx`** (575 lines) — the comparisons page sets wards beside wards and departments beside departments
- **`tests/ward-statistics-demonstration.test.ts`** (308 lines) — DemonstrationSeries cannot escape statistics-demonstration.ts
- **`tests/ward-statistics-empty-bed-spread.dom.test.tsx`** (139 lines) — the ward page says when its bed-empty average has no spread
- **`tests/ward-statistics-grid-tracks-fit-the-container.test.ts`** (185 lines) — statistics grid tracks can always shrink to their container
- **`tests/ward-statistics-incoherent-gap.test.ts`** (93 lines) — an impossible pull-to-arrival gap is excluded, never clamped to zero
- **`tests/ward-statistics-number-agreement.dom.test.tsx`** (283 lines) — every ward statistic reads correctly when its count is one
- **`tests/ward-statistics-overview-parked.dom.test.tsx`** (291 lines) — the statistics overview now carries real figures, honestly
- **`tests/ward-statistics-primitives.dom.test.tsx`** (138 lines) — StatFootnote
- **`tests/ward-statistics-published-precision.test.ts`** (124 lines) — a published average carries only the precision it claims
- **`tests/ward-statistics-ready-not-yet-gone.test.ts`** (173 lines) — clinically ready, not yet gone
- **`tests/ward-statistics-ready-section.dom.test.tsx`** (200 lines) — clinically ready, not yet gone — the section
- **`tests/ward-statistics-sections-are-regions.dom.test.tsx`** (174 lines) — every statistics section is a landmark, not just a heading
- **`tests/ward-statistics-sections.dom.test.tsx`** (844 lines) — every statistics section page carries the disclaimer
- **`tests/ward-statistics-sections.test.ts`** (856 lines) — the statistics section list
- **`tests/ward-statistics-service-screen.dom.test.tsx`** (220 lines) — Health-service statistics — not found
- **`tests/ward-statistics-service-sentence.dom.test.tsx`** (114 lines) — renders no scope sentence under "All services"; renders the one required sentence, worded exactly, when a service is chosen (S3/S4, item 44)
- **`tests/ward-statistics-v3-language.test.ts`** (291 lines) — the third-edition statistics language
- **`tests/ward-statistics-v4-language.test.ts`** (554 lines) — the fourth-edition statistics language
- **`tests/ward-statistics-ward-nulls.dom.test.tsx`** (146 lines) — a ward statistics page never renders an unmeasurable average as a number
- **`tests/ward-statistics-ward-shares-agree.dom.test.tsx`** (153 lines) — the ward screen's two share-of-the-ward denominators
- **`tests/ward-statistics.dom.test.tsx`** (1882 lines) — the statistics screen — six drawing panels, kept apart
- **`tests/ward-statistics.test.ts`** (422 lines) — wardStatistics — null versus zero

#### Patient search (3 files)

- **`tests/ward-global-search.dom.test.tsx`** (323 lines) — WardGlobalSearch — anti-vacuity floor
- **`tests/ward-search-access-record.test.ts`** (35 lines) — the access record
- **`tests/ward-search-preview.dom.test.tsx`** (487 lines) — the Stage and Department facets carry live, self-consistent counts

#### Governance (2 files)

- **`tests/ward-governance-thin-sample.test.ts`** (123 lines) — the governance board refuses to publish a figure from a thin sample
- **`tests/ward-governance.dom.test.tsx`** (395 lines) — GovernanceView

#### Network (4 files)

- **`tests/ward-network-cluster-header.dom.test.tsx`** (130 lines) — the network cluster header
- **`tests/ward-network-cohort-structural-gap.test.ts`** (125 lines) — the network's structural cohort answer
- **`tests/ward-network-stage-filter.dom.test.tsx`** (180 lines) — the stage strip filters the queue without disguising it
- **`tests/ward-network-stage-strip.dom.test.tsx`** (167 lines) — the network stage strip reconciles with the queue

#### Management (misc root screens) (3 files)

- **`tests/ward-management-role.dom.test.tsx`** (83 lines) — Ward Flow role screens unique test id contract
- **`tests/ward-management-role.test.ts`** (27 lines) — Ward Flow role screens static test ID integrity
- **`tests/ward-management.test.ts`** (273 lines) — Ward Flow synthetic prototype

### Navigation and reachability (13 files)

- **`tests/ward-community-index.dom.test.tsx`** (182 lines) — The community index's OWN reachability — the assertion that outranks the rest of this file
- **`tests/ward-event-reachability.test.ts`** (290 lines) — every reducer event is reachable from a screen, or recorded as a known gap
- **`tests/ward-landmarks.test.ts`** (458 lines) — Ward Flow route/render-map coverage (sanity check on the scan and the map)
- **`tests/ward-links-never-point-at-redirect-stubs.test.ts`** (193 lines) — no ward screen links at a retired route kept only as a redirect
- **`tests/ward-mode-workspace-reachability.test.ts`** (153 lines) — every ward mode a test renders is a mode a user can still reach
- **`tests/ward-movement-absence-reachability.test.ts`** (192 lines) — the control: this file can drive the reducer at all
- **`tests/ward-nav.test.ts`** (2018 lines) — Ward Flow route enumeration (sanity check on the scan itself)
- **`tests/ward-no-dead-ends.dom.test.tsx`** (505 lines) — route registry coverage (so nothing below can pass by examining nothing)
- **`tests/ward-primary-action.dom.test.tsx`** (225 lines) — WardBar primary action — the five kinds, D-16
- **`tests/ward-route-component-binding.test.ts`** (182 lines) — every ward route renders the component it is pinned to
- **`tests/ward-specs-never-navigate-into-redirect-stubs.test.ts`** (898 lines) — no ward spec navigates into a redirect stub and then waits for the screen it replaced
- **`tests/ward-statistics-community-chooser.dom.test.tsx`** (116 lines) — The community-team chooser's OWN reachability — the fifth section's hub entry
- **`tests/ward-statistics-service-chooser.dom.test.tsx`** (130 lines) — The health-service chooser's OWN reachability — the fourth section's own hub entry

### Design tokens, raw colour and table/type rules (20 files)

- **`tests/ward-capacity-network-row-de-emphasis.test.ts`** (215 lines) — the CSS-text cleaner itself — proven on a synthetic string before it is trusted on a real stylesheet
- **`tests/ward-clinical-rail-token-bridge.test.ts`** (74 lines) — Ward coordinator token bridge (DS-P0-05)
- **`tests/ward-css-token-references-resolve.test.ts`** (481 lines) — every var() in Ward Flow's stylesheets names a token that exists
- **`tests/ward-design-language-canonical.test.ts`** (180 lines) — the second-edition design language lives in exactly one place
- **`tests/ward-design-language-contract.test.ts`** (837 lines) — the Ward Flow design language holds across every Ward Flow stylesheet
- **`tests/ward-forced-colors-tokens.test.ts`** (108 lines) — the shared ward layer carries its own high-contrast handling
- **`tests/ward-mockup-tokens-resolve.test.ts`** (146 lines) — ward-flow standalone mockups resolve every custom property they use
- **`tests/ward-mono-face-earns-its-place.test.ts`** (153 lines) — the monospace face earns its place in a column and nowhere else
- **`tests/ward-print-ink-specificity.test.ts`** (180 lines) — parses every ward stylesheet with postcss and computes real cascade specificity, proving the print ink-reset wins against every competing class-plus-type colour rule, not just a sampled heading
- **`tests/ward-raw-colour.test.ts`** (263 lines) — ward stylesheets declare colour through the --ward-* layer, never raw
- **`tests/ward-row-severity-not-colour-alone.test.ts`** (404 lines) — a coloured row flag is never the only carrier of its information
- **`tests/ward-status-colour-reach.test.ts`** (369 lines) — no ward rule reaches past the ward layer for a status colour
- **`tests/ward-stylesheet-duplicate-block.test.ts`** (180 lines) — no ward stylesheet contains the same section twice
- **`tests/ward-table-min-width.test.ts`** (521 lines) — every ward table keeps the scroll threshold it was built with
- **`tests/ward-table-panel-inset.test.ts`** (126 lines) — a ward table's cell inset agrees with its panel header's inset
- **`tests/ward-table-phone-swap.test.ts`** (378 lines) — every WardTable that its board's stylesheet hides on a phone is given the class that hides it
- **`tests/ward-table-single-source.test.ts`** (309 lines) — the Ward Flow `.table` rule set is declared in exactly one file
- **`tests/ward-text-size-ratchet-bites.test.ts`** (279 lines) — the D-3 ratchet bites
- **`tests/ward-text-size-ratchet.test.ts`** (135 lines) — the D-3 text-size ratchet is reachable and still ratchets
- **`tests/ward-token-layer.test.ts`** (586 lines) — the Ward Flow token layer

### Truthfulness guards (screens do not show what the data does not hold) (19 files)

- **`tests/ward-activity-consistent-across-screens.dom.test.tsx`** (139 lines) — Activity drawer is consistently wired across all screens
- **`tests/ward-activity-count-separate.dom.test.tsx`** (134 lines) — WF-10 — the Activity segment count and the Notices heading are never summed
- **`tests/ward-announced-figures-carry-their-marker.test.ts`** (1037 lines) — the population this guard walks
- **`tests/ward-bed-designation-fixture.test.ts`** (70 lines) — invented bed designations
- **`tests/ward-empty-bed-exclusion-is-visible.dom.test.tsx`** (139 lines) — an impossible empty-bed record is excluded AND said out loud
- **`tests/ward-flow-diagram-status-truthfulness.test.ts`** (146 lines) — the flow diagram's hub status line
- **`tests/ward-freshness-count-wording.test.ts`** (113 lines) — the wards-confirmed count states coverage, never recency
- **`tests/ward-handover-destination-truthfulness.test.ts`** (138 lines) — the handover page's Destination column
- **`tests/ward-invented-figures.test.ts`** (131 lines) — an invented figure has to say so in its own sentence
- **`tests/ward-length-of-stay-population.dom.test.tsx`** (124 lines) — the average-stay sentence names the population the figure measures
- **`tests/ward-movement-page-truthfulness.dom.test.tsx`** (353 lines) — the movement page does not print sentences the record contradicts
- **`tests/ward-no-screen-claims-a-durable-access-record.test.ts`** (165 lines) — no ward screen claims a durable record of who looked
- **`tests/ward-one-appearance-key.test.ts`** (107 lines) — the appearance preference has exactly one key
- **`tests/ward-place-name-detector.test.ts`** (80 lines) — the place-name detector's matching rule
- **`tests/ward-primitives-shared.test.ts`** (401 lines) — the seven classes every screen invented now live in one place
- **`tests/ward-provenance-sentences-carry-their-own-marker.test.ts`** (602 lines) — a sentence under a provenance heading discloses provenance by itself
- **`tests/ward-ready-figure-preparation-qualifier.test.ts`** (184 lines) — every ward screen printing a ready-bed figure also states how many are being made ready
- **`tests/ward-ready-has-one-arithmetic.test.ts`** (234 lines) — the ruled Ready expression has exactly the sanctioned homes
- **`tests/ward-statistics-overview-invented.dom.test.tsx`** (129 lines) — the overview's 'What is invented, and what is real' panel

### Docs and generator guards (16 files)

- **`tests/ward-design-test-sync.test.ts`** (47 lines) — Ward Flow Design-to-Test Synchronization System
- **`tests/ward-drawing-match-r2-12.test.ts`** (57 lines) — Ward screen — perfected tab order (R2-12)
- **`tests/ward-drawing-rules.test.ts`** (78 lines) — check-drawing-rules
- **`tests/ward-errata-freshness-gate.test.ts`** (78 lines) — the ward errata-freshness gate is reachable and still measures something
- **`tests/ward-expected-reds-comparison.test.ts`** (138 lines) — the expected-red comparison, in both directions
- **`tests/ward-expected-reds-manifest.test.ts`** (260 lines) — the expected-red manifest
- **`tests/ward-expected-reds-summary.test.ts`** (173 lines) — the expected-reds gate's own summary line
- **`tests/ward-expected-reds.json`** (28 lines) — no `describe`/`test`/`it` title found; open the file to see what it covers.
- **`tests/ward-ledger-stale-row-guard.test.ts`** (90 lines) — the ledger's stale-row guard actually refuses
- **`tests/ward-organisation-core.test.ts`** (652 lines) — C1: admission is separate from reviewed ownership
- **`tests/ward-owner-decisions-2026-09-16.test.ts`** (204 lines) — 2026-09-16 Product Owner Rulings Verification
- **`tests/ward-prototype-disclosure.test.ts`** (295 lines) — every ward route a reader can open says its data is synthetic
- **`tests/ward-reference-registry.test.ts`** (95 lines) — the WA reference registry
- **`tests/ward-screen-verification-lib.test.ts`** (182 lines) — drawingStatus — WF-35: the word CURRENT is retired
- **`tests/ward-sites-reference-alignment.test.ts`** (103 lines) — demo wards borrow real WA names
- **`tests/ward-whois-register.test.ts`** (107 lines) — a marker only holds a role when git corroborates it

### Test-suite integrity (meta guards on the suite itself) (15 files)

- **`tests/ward-component-reachability.test.ts`** (353 lines) — every ward component a test renders is one a coordinator can still reach
- **`tests/ward-coverage-pointer-integrity.test.ts`** (214 lines) — a WARD-COVERAGE-POINTER comment names a file that actually still covers the gap
- **`tests/ward-guard-comment-blindness.test.ts`** (181 lines) — blankCssComments — the instrument the ward text-scanning guards need
- **`tests/ward-journeys-lane-runs-without-blocking.test.ts`** (105 lines) — the Ward Flow browser journeys lane
- **`tests/ward-mutation-harness-reachable.test.ts`** (156 lines) — the mutation harness is reachable, and its own guards still fire
- **`tests/ward-mutation-tooling.test.ts`** (166 lines) — withMutation — the refusals, each exercised rather than described
- **`tests/ward-no-self-appended-file.test.ts`** (119 lines) — no file in this repository contains its own opening twice
- **`tests/ward-no-tautological-cases.test.ts`** (429 lines) — built-in sentinels — the scan can actually fail, in both directions
- **`tests/ward-reason-checks-use-their-own-list.test.ts`** (200 lines) — reason membership checks
- **`tests/ward-retired-suite-integrity.test.ts`** (280 lines) — built-in sentinels — the scan can actually fail, in both directions
- **`tests/ward-run-ward-tests-skips.test.ts`** (170 lines) — summariseSkips — counts skipped/todo assertions and files with no live case
- **`tests/ward-seed-reaches-every-branch.test.ts`** (112 lines) — every branch a referral screen can render is reached by the seed
- **`tests/ward-test-discovery.test.ts`** (204 lines) — ward test discovery vs. the tests/ward-* naming convention
- **`tests/ward-traps-numbering.test.ts`** (204 lines) — the traps file's entry numbering
- **`tests/ward-unresolvable-reference-unreachable.test.ts`** (179 lines) — no dispatch in this application can create an unresolvable department or ward reference

### Shell, chrome and shared UI primitives (58 files)

- **`tests/ward-activity-category-filters.dom.test.tsx`** (116 lines) — Activity category filter chips
- **`tests/ward-alerts-css-tap-and-edge-bars.test.ts`** (63 lines) — alerts.module.css — no coloured edge bars (F3.3)
- **`tests/ward-back-sync-and-focus-trap.dom.test.tsx`** (268 lines) — Issue 3: Movement Drawer Browser Back Sync
- **`tests/ward-bar-fill-only-edges.test.ts`** (243 lines) — WardBar draws the split it can no longer fill
- **`tests/ward-bar-tasks-role-message.dom.test.tsx`** (99 lines) — F8 — the Tasks drawer's empty state names why the list is empty
- **`tests/ward-bar.dom.test.tsx`** (127 lines) — WardBar
- **`tests/ward-board-people-panel.dom.test.tsx`** (548 lines) — ward board people panel — the figure has to be possible, not merely computed
- **`tests/ward-browser-build-css.test.ts`** (55 lines) — Ward browser-build CSS
- **`tests/ward-checks-publication.dom.test.tsx`** (91 lines) — a ward screen publishes its checks upward to the shell
- **`tests/ward-chip.dom.test.tsx`** (172 lines) — WardChip
- **`tests/ward-chrome-header-actions.dom.test.tsx`** (169 lines) — Ward Flow chrome header — Handover link
- **`tests/ward-chrome-owner.test.ts`** (351 lines) — Ward Flow has exactly one top-anchored phone-chrome owner
- **`tests/ward-command-third-edition.dom.test.tsx`** (294 lines) — Command third-edition restyle — panel order and heading pins
- **`tests/ward-community-az-rail-accessible-disabled.dom.test.tsx`** (94 lines) — Community gateway — the A-Z rail marks an empty letter accessibly-disabled, not natively
- **`tests/ward-composes-targets.test.ts`** (370 lines) — ward-management composes: targets resolve to real files and real classes
- **`tests/ward-controls.dom.test.tsx`** (70 lines) — WardFilters
- **`tests/ward-delays-mark-controls.dom.test.tsx`** (282 lines) — the Delays screen's three mark sources never leave a stale one pressed
- **`tests/ward-dialog-accessibility.dom.test.tsx`** (102 lines) — Ward Flow Dialog & Modal Accessibility Semantics
- **`tests/ward-document-metadata.dom.test.tsx`** (74 lines) — document metadata and modal lifecycle
- **`tests/ward-ed-form-expiry-controls.dom.test.tsx`** (291 lines) — intake: the typed expiry reaches the movement for any selected form
- **`tests/ward-ed-outcome-controls.dom.test.tsx`** (216 lines) — recording an ED outcome from the board
- **`tests/ward-error-boundaries.dom.test.tsx`** (213 lines) — the ward flow error boundaries are client components
- **`tests/ward-figure.dom.test.tsx`** (115 lines) — WardFigure
- **`tests/ward-flow-clock-consistency.dom.test.tsx`** (129 lines) — the movements board reads the live shared clock, not a value frozen at import
- **`tests/ward-flow-potential-chip-migration.dom.test.tsx`** (96 lines) — network view and coordinator flow diagram never show the raw potential figure
- **`tests/ward-flow-provider-safe-payload-shape-guard.test.ts`** (115 lines) — WARD_FLOW_TEXT_SAFE payload-shape compile-time guard
- **`tests/ward-flow-provider-server-determinism.test.ts`** (144 lines) — the server's ward markup does not depend on what minute it is
- **`tests/ward-flow-provider.dom.test.tsx`** (579 lines) — WardFlowProvider
- **`tests/ward-flow-queue-selection.dom.test.tsx`** (130 lines) — the Delays screen reflects a dispatch made after mount, not the records it first rendered
- **`tests/ward-flow-recovery.dom.test.tsx`** (327 lines) — conservative demo recovery
- **`tests/ward-flow-sign-in-screen.dom.test.tsx`** (124 lines) — Ward Flow sign-in screen — static credential-field guard
- **`tests/ward-freshness.dom.test.tsx`** (54 lines) — freshness stamp
- **`tests/ward-hub-bar-colours.test.ts`** (288 lines) — Ward Flow hub — the bed bar's segments are three different paints, in both palettes
- **`tests/ward-movement-drawer-person.test.ts`** (122 lines) — the Movement drawer's Person line (O-16.3)
- **`tests/ward-notification-center.dom.test.tsx`** (513 lines) — WardNotificationCenter DOM Component
- **`tests/ward-panel.dom.test.tsx`** (80 lines) — WardPanel
- **`tests/ward-printable-disclosures.dom.test.tsx`** (51 lines) — Ward printable disclosures
- **`tests/ward-provider-initial-now.dom.test.tsx`** (110 lines) — WardFlowProvider honours the instant it is pinned to
- **`tests/ward-rail-service-word.dom.test.tsx`** (182 lines) — the rail's chosen-service word (item 52)
- **`tests/ward-reconciliation-empty-checks.test.ts`** (183 lines) — D-40: an empty check array never claims reconciliation
- **`tests/ward-record-row.dom.test.tsx`** (96 lines) — WardRecordRow
- **`tests/ward-registers-drawer.dom.test.tsx`** (297 lines) — the coordinator's registers drawer
- **`tests/ward-role-switcher-signpost.dom.test.tsx`** (201 lines) — ward role switcher — other wards are named to coordinators only (owner answer 38)
- **`tests/ward-service-panel-note.dom.test.tsx`** (76 lines) — Service panel note names exactly SERVICE_SCOPED_SCREENS (D-e, TEST 6)
- **`tests/ward-service-store.dom.test.tsx`** (352 lines) — ward-service-store.ts — storage contract
- **`tests/ward-settings-not-wired-controls.dom.test.tsx`** (223 lines) — settings screen — the nine controls retired as not-wired in this prototype pass
- **`tests/ward-settings-rail.dom.test.tsx`** (110 lines) — the settings screen's rail control
- **`tests/ward-shell-mounted.dom.test.tsx`** (189 lines) — Task 6 — the shell is actually reached on a real route, not merely importable
- **`tests/ward-shell-print-ancestor.test.ts`** (386 lines) — the shell is the ancestor that carries every ward route into print
- **`tests/ward-shell-third-edition.dom.test.tsx`** (1040 lines) — assertion 1 — owner-selected rail destinations
- **`tests/ward-shell.dom.test.tsx`** (163 lines) — Task 1 — the shell owns the ground
- **`tests/ward-sidebar-phone-contract.test.ts`** (197 lines) — Ward Flow sidebar — phone contract
- **`tests/ward-sidebar.dom.test.tsx`** (526 lines) — Ward Flow phone drawer
- **`tests/ward-sign-in-shell.dom.test.tsx`** (40 lines) — Ward Flow standalone layout boundary
- **`tests/ward-standing-strip.dom.test.tsx`** (406 lines) — the standing strip never exceeds WardFigureStrip's two-flag ceiling
- **`tests/ward-suburb-team-panel.dom.test.tsx`** (213 lines) — the suburb-to-team panel — its fixtures are what they claim to be
- **`tests/ward-tasks-drawer.dom.test.tsx`** (158 lines) — the tasks drawer
- **`tests/ward-workspace-chrome.test.ts`** (119 lines) — the ward modes that render the shared workspace chrome

### Browser journeys (Playwright, chromium-mockups) (13 files)

- **`tests/ui-ward-capacity-morning-moved.spec.ts`** (97 lines) — @mockup Ward capacity — rail navigates away from the absorbed morning board and back
- **`tests/ui-ward-chrome-header.spec.ts`** (544 lines) — @mockup Ward shell bar
- **`tests/ui-ward-coordinator.spec.ts`** (1401 lines) — @mockup Ward Flow coordinator screen
- **`tests/ui-ward-discharges.spec.ts`** (430 lines) — @mockup Ward discharges — a bed release's whole lifecycle reaches the coordinator live
- **`tests/ui-ward-forced-colors.spec.ts`** (653 lines) — @mockup forced colours is actually active, or nothing below means anything
- **`tests/ui-ward-full-journey.spec.ts`** (385 lines) — @mockup Ward Flow full journey — referral to discharge planning, one browser window
- **`tests/ui-ward-management.spec.ts`** (527 lines) — @mockup Ward Flow command view
- **`tests/ui-ward-referrals.spec.ts`** (1355 lines) — @mockup Ward referrals — the front door, phone to board to accepted
- **`tests/ui-ward-roles.spec.ts`** (1169 lines) — @mockup Ward screen
- **`tests/ui-ward-search.spec.ts`** (416 lines) — @mockup Ward patient search
- **`tests/ui-ward-statistics-compare.spec.ts`** (94 lines) — @mockup the comparisons screen keeps every row's identity on screen
- **`tests/ui-ward-statistics-journey.spec.ts`** (191 lines) — @mockup the statistics screens are reachable and readable on a phone
- **`tests/ui-ward-table-thresholds.spec.ts`** (624 lines) — @mockup every ward table's threshold still describes the table it was measured for

### Shared test helpers (6 files)

- **`tests/helpers/ward-caption.ts`** (154 lines) — shared caption assertions — `screenText`, `expectSays`, `expectNeverSaysAgain`, `expectCaption`
- **`tests/helpers/ward-dead-end-routes.ts`** (103 lines) — scans `src/app` and Ward Flow route tables so nav tests can check an href actually resolves to a route
- **`tests/helpers/ward-invented-figures.ts`** (181 lines) — `statesItsOwnProvenance` / `provenanceFailure` — the shared check behind the truthfulness-guard suite
- **`tests/helpers/ward-panels.ts`** (37 lines) — `panelTitlesInOrder` — reads a screen's panel headings in DOM order
- **`tests/helpers/ward-place-names.ts`** (63 lines) — `namesRealPlace` — detects a real WA place name leaking into rendered text
- **`tests/helpers/ward-referral-history.ts`** (55 lines) — fixture history strings at and over the referral history field's character limit

## Pitfalls in this area

- **`tests/ward-expected-reds.json` is empty at this tip.** Every ward test is currently expected
  to pass; there is no standing allowance for a known-red file. If a ward change leaves any test
  failing, `scripts/check-ward-expected-reds.mjs` fails outright — it does not degrade to "one more
  than before". Do not add an entry to the manifest to make a red pass without reading
  `scripts/check-ward-expected-reds.mjs`'s own head comment first; `kind: "owner-question"` entries
  specifically must never be cleared by anyone but the owner.
- **A comment mentioning `describe(` or `describe.skip(` can outrank the real first `describe` in
  a naive first-match scrape** — this map hit it directly. `tests/ward-capacity-absorbed-morning-coverage.dom.test.tsx`,
  `tests/ward-coverage-pointer-integrity.test.ts`, `tests/ward-retired-suite-integrity.test.ts` and
  `tests/ward-specs-never-navigate-into-redirect-stubs.test.ts` all carry a head comment that
  quotes `describe.skip(...)` in prose before the file's real, code-level `describe(...)` appears;
  a plain `grep -m1 describe\(` finds the comment first. Any future automated scrape of this suite
  (or of any suite with similarly self-referential comments) needs to skip lines starting with `*`,
  `//` or `/*` before taking the first match — `tests/ward-guard-comment-blindness.test.ts` exists
  because the repo's own text-scanning guards have the identical trap in the other direction (a
  comment can satisfy a guard meant to scan real code).
- **Eight DOM suites are `describe.skip` for a named, owner-ruled reason and are not dead code**:
  `ward-community-figures.dom.test.tsx`, `ward-community-scope.dom.test.tsx`,
  `ward-community-team-hub.dom.test.tsx`, `ward-ed-home.dom.test.tsx`,
  `ward-ed-service-bands.dom.test.tsx`, `ward-escalation.dom.test.tsx`,
  `ward-community-teams-table.dom.test.tsx` and `ward-tracker-leg-badge.dom.test.tsx` each carry a
  head comment citing the 6 September 2026 owner ruling that their screen is unreachable. Do not
  un-skip one of these to raise a passing count, and do not delete the file — the repo's dead-code
  policy forbids removing an exported symbol on a "nothing imports it" basis, and
  `tests/ward-component-reachability.test.ts` is the guard that reddens the day the underlying
  component becomes reachable again, at which point the retired coverage record names what to
  restore.
- **About a quarter of this suite reads the source tree directly.** 162 of the 656 files call
  `readFileSync`/`readdirSync` (measured by grep over every file in this map, excluding the JSON
  manifest) — essentially all of "Design tokens, raw colour and table/type rules", most of
  "Docs and generator guards" and "Test-suite integrity", and a further scatter through every other
  group (engine, referrals, shell). A changed-file-based selection tool (`npm run test:focused`,
  or hand-picking a narrow glob) cannot correctly include one of these unless the file it scans is
  itself the file that changed — a CSS-token or wording change three files away from the scanner
  can regress it silently under a targeted run. Widen to the full ward suite, or at minimum re-run
  the specific scanning test by name, before trusting a focused pass that touched a stylesheet,
  a generated doc, or shared wording.
- **The two Vitest projects are glob-disjoint by design, and a misnamed file silently stops
  running.** `node` collects `*.test.ts`; `jsdom` collects `*.dom.test.tsx`. A `.tsx` file saved
  without the `.dom.` infix, or a `.ts` file that imports `@testing-library/react` without ending
  in `.dom.test.tsx`, is either collected under the wrong environment (and crashes on first
  `render()` under `node`) or, if its name matches neither pattern, is not collected at all — with
  no error, since an uncollected file is indistinguishable from a passing one at the `npm run test`
  level. `tests/ward-test-discovery.test.ts` exists to catch drift between this naming convention
  and what actually gets discovered.
- **A `tests/ui-ward-*.spec.ts` browser spec needs registering in two places in
  `playwright.config.ts`**, not one: the root `testMatch` regex and the `chromium-mockups`
  project's own `mockupSpecPattern`, both of which spell out the exact filename stem rather than a
  wildcard. `tests/playwright-project-isolation.test.ts` is the guard that fails when a spec exists
  on disk that neither pattern names — but until that guard is run, a new spec can sit on disk,
  never selected by either the production browser lane or `chromium-mockups`, and never fail
  anything.
- **The `chromium-mockups` project is advisory, and always was.** It is deliberately kept separate
  "so a red mockup can never mask a production-journey regression" (the config file's own
  comment). A red here does not fail the production browser gate (`npm run verify:ui`), and — per
  the top-level code map's Known Gaps section — nothing in routine CI runs it automatically; it is
  reached only through the explicit `npm run test:e2e:ward-journeys` at fold time.
- **`scripts/check-ward-expected-reds.mjs` does not take the heavy-run lock** (deliberately, so a
  cached gate-receipt pass elsewhere cannot satisfy it) — running it at the same time as another
  heavy Vitest invocation in the same worktree risks resource contention neither run's own
  bookkeeping will explain.
- **File-level keying in the expected-reds manifest hides an exactly-compensating swap.** The
  comparison in `scripts/check-ward-expected-reds.mjs` keys on file path plus a failing-test
  _count_, not on test name. A file with one sanctioned red that trades that failure for a
  different, unrelated one (same count) passes the gate unchanged — the count-based check closes
  "any extra number of reds in a listed file", not "any different red at the same count".

## Not checked

No test in this suite was run, and no coverage report was read — every count above comes from
static extraction (`wc -l`, `grep` for a `describe`/`test`/`it` title, `grep -rl` for import
statements) against files on disk, not from an execution. Whether the 656 files here currently
pass is a live, disputed question the top-level code map's "Known gaps" section already flags
(two same-day audits disagree by tip). This map does not settle it. Also not checked: the internals
of `scripts/test-focused.mjs`'s "changed files plus up to three importers" selection logic (covered
in the sibling scripts-and-tooling map, not here); whether any of the 654 `ward-*`-named files
additionally import `ward-management`/`mockups/ward-flow` through an indirect chain rather than a
direct import (only direct `import ... from` statements were grepped for the two non-`ward-`-named
extras); and the full body of every file — each bullet's "what it protects" phrase is the test
author's own `describe`/`test`/`it` title, read and lightly cleaned by script and spot-checked on
about two dozen files that looked wrong, not independently re-derived from every file's actual
assertions.

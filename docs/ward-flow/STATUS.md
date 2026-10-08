# Ward Flow — status

**Source baseline audited 8 October 2026:** dedicated `BigSimmo/Ward-Flow` main
`e7b7f325346ea7abb5004bd2e60e63f64f5c9f95` (PR #121). This page describes that
verified baseline and the local remediation programme. A later local change,
publication and deployment each require separate evidence.

Synthetic data only. Do not enter real patient information. Ward Flow is not
approved for clinical deployment.

## Current state

The Next.js application is an interactive browser prototype with a shared in-tab
reducer, synthetic records, scoped role simulation, local scenario import/export,
and extensive unit/browser checks. Different users do not share an authoritative
board. The separate Azure Functions backend stores owner-private demonstration
snapshots; it is not connected to the screens and is not a service-scoped clinical
backend. A PostgreSQL schema proposal does not establish a deployed database.

The audit's clean exact-lock run passed **916 test files and 10,688 tests**, with
**9 files / 146 tests skipped**. The separate backend mock suite passed 24 tests.
Latest main CI passed, using successful identical-tree PR #121 application checks.
These dated results are a baseline, not a pass for untested remediation changes.
Local desktop/phone inspection covered 46 routes and identified supported defects,
including arrival/held-bed integrity, misleading community actions and phone
overflow. An all-green baseline does not mean every workflow is complete.

The audit verified the named Ward Railway frontend deployment against this main
SHA. It did not verify Azure's current host configuration, storage recovery,
Sentry setup or approved patient-data processing. Provider health is separate
from end-to-end application verification.

## What is built

**Screens** (routes under `src/app/mockups/ward-flow/`; engine and components under
`src/components/ward-management/`):

| Area                   | Screens                                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coordinator day        | Home and master hub, coordinator Command horizon ("Since you last looked"), queue, referrals, movements, transport, delays runway, discharges                  |
| Beds and wards         | Bed board (with stranded prompts), ward view, wards directory, capacity (with bed-meeting sheet and tomorrow's forecast), network view, shortlist, out-of-area |
| Pressure and safety    | ED pressure strip, individual ED psychiatry hub, alerts centre, escalation, exceptions, governance                                                             |
| People and directories | Patient search (Floating Glass Command Horizon), unified Patient Now flight deck, people, community directory, on-call directory                               |
| Records and reports    | Handover (Command Horizon flight deck and print), legal forms (with MHA expiry reminders), statistics dashboards and charts (with CSV export)                  |
| Other                  | Settings, compact floating drawers (Tools, Tasks, Activity, Referrals), scenario save/load, universal prototype banner, showcase                               |

**Dated work summary (27 September to 6 October; not a fresh verification claim):**

- **Patient flight deck & search (#66, #69):** Unified Patient Now flight deck consolidating patient dossier and transit operations into a 3-column brief with live journey tracking (`usePatientNow`, #69); Direction 3 Floating Glass Command Horizon for patient search console (#66); perfected referral detail inspector with a 4-column demographic strip, live ready badge, and clear placement rationale (#66).
- **Handover Command Horizon & print (#42, #72):** 3-tier flight deck and shift switcher, rapid snapshot sections, KPI tiles (caseload, vacancies, form expiries, 1:1s), and verified table sheet (#42, #72); dedicated print stylesheet with `CanvasText` and D7 landmark compliance (#72); restored legal notice HUD tag (#42).
- **Compact floating drawers (#70):** Redesigned Tools, Tasks, Activity, and Referrals drawers as curved floating panels with layered theme-aware surfaces, backdrop focus trapping, and Escape key dismissal (#70); Figures feature integrated into Tools; Tasks severity filtering; Activity status pills and horizontal mobile scrolling (#70).
- **Delays runway, timeline & analytics (#47, #48, #67, #68):** Executive view modes and standalone crisis radar (#48); Delays action runway and tabbed delay tables with named wait timeline (#47, #67, #68); three visual analytics graph views: Catchment breakdown, Wait Histogram, and Delay Matrix (#67); paginated waiting tables with absolute caption scroll wrappers (#68).
- **Discharges board & wave runway (#45, #66):** Live discharges board overhaul with Wave Runway, external header, segmented tabs, resting-state dashboard, telemetry bar, and compact inspector (#45, #66); stark sticky table header with elevation shadow and separate collapse toggle (#66).
- **Capacity bed-meeting sheet & forecast (#54, #55, #61):** Printable one-page morning bed-meeting sheet with live incoming/outgoing/departure counts (#54); 24-hour predictive tomorrow's beds forecast with sentence headlines (#55), repositioned for optimal operational hierarchy (#61).
- **Bed states, stranded patients & shortlist (#56, #58):** Standardized whole-system bed taxonomy across Capacity, Statistics, Hub, Referral, Ward screen, and Bed Board to four mutually exclusive states: Ready, Pulled, Closed, Occupied (#58); explainable placement shortlist detailing clinical and operational fit rationale for candidate wards (#58); visual stranded-patient prompts on the ward board (#56).
- **Universal prototype banner & estate anchoring (#46, #65, #66):** Universal curved synthetic prototype banner anchored at the bottom of every page across the estate (#46, #65, #66); symmetrical search hub headers, resolved search hub spacing, and 48px touch targets at 375px (#66).
- **Referrals self-withdrawal & MHA reminders (#49, #52):** Referring ED or community teams can self-withdraw their own referrals before allocation (#49); synthetic MHA statutory reminders warning of approaching form expiry before typed authorizations lapse (#52).
- **Coordinator Command Horizon (#53):** "Since you last looked" delta stream on the coordinator Command screen highlighting movements since last check (#53).
- **Screen polish across the estate (#12, #15, #16, #17, #19, #24–#29, #33, #41, #57, #62, #71, #74):** Design refinements across all main screens, community directory (#24), out-of-area (#25), on-call (#26, #29), alerts (#27), individual ED psychiatry screen (#71), and all seven Statistics dashboards (#33, #74); All Wards directory styling without census box highlight (#62); ward screen action bar, tabs, telemetry ribbon, beds matrix, shift coordinator log, and `WardBedDossierDrawer` (#57, #67); elimination of the 1-second ward layout remount on load (#41).
- **Safety, persistence and scenarios (#2, #20, #22, #32, #34, #35, #41, #50):** Patient safety and statutory capacity fixes (#2); legal wording and simulation fixes (#20); WA ward disposition and care-journey wiring (#22); unsaved clinical text guard (#32, #34); session adoption action replay and day restart synchronization (#41); demo scenario save and load to local files from the demo menu (#50); spreadsheet formula neutralizing in CSV exports (#35).
- **Accessibility (#8, #27, #34, #66, #68, #70):** Keyboard, tablet and phone ergonomics (#8), keyboard navigation in alerts (#27), dialog and drawer focus trapping (#34, #70), 48px touch targets on mobile viewports (#66).
- **Checks, CI & operations (#1, #3, #9–#11, #13, #14, #23, #30, #31, #36, #37, #40, #44, #51, #59, #60, #63, #75–#78):** Automated GitHub CI on push to `main` with Gitleaks secret scanning and production build verification (#37); whole-tree ESLint fixes and PR enforcement (#40, #77); unit test shard balancing by measured CI runtime (#44, #78); coverage recording across shards with identical PR verdict reuse on `main` (#75); Playwright Chromium caching and Next.js build cache from `main` (#76, #77); Railway healthcheck diagnostics, cloud agent Node 24 setup, and recovery documentation (#7, #59, #60, #63); archival of 53 historical docs to `docs/archive/` (#51); removal of PsychSift leftovers (#36, #40).
- **Backend (not connected to the screens):** a synthetic Azure session service (#5) and a cloud
  scenario vault with a synthetic-data guard (#32). See [the backend guide](../../backend/ward-flow/README.md).
- **Rules:** owner-approved prototype operating mode recorded in `AGENTS.md` on 3 October (#32).

## Remaining work and local remediation

The [remediation checkpoint](reports/remediation-2026-10-08.md) records actual fixes
and checks against the audit's stable task IDs. Confirmed source defects are being
fixed locally; publication, deployment and hosted validation remain separate.

- **Shared synthetic operation:** configured staff sign-in, trusted service/role
  membership, authoritative shared commands, cross-user synchronisation and
  authenticated action history still require implementation and agreed boundaries.
  Existing snapshot CAS prevents blind overwrite, but does not supply those features.
- **Persistence privacy:** D-18 intentionally stops browser session persistence
  after a typed-text event. Saving a JSON scenario is an explicit file action;
  it is not automatic shared persistence. Do not restore typed drafts to browser
  storage to make refresh seem more reliable.
- **Incomplete secondary controls:** clinician referral assignment, intervention
  recording, safeguard previews and some shell/admin actions remain explicitly
  disclosed as unavailable. A toast is not a saved record.
- **Infrastructure:** isolated staging, monitoring/alerts, backup/restore,
  app-plus-data rollback, provider rate limits and account revocation require
  verified Ward-only configuration and acceptance evidence. Inaccessible provider
  tools do not prove a service is absent.
- **Outstanding ownership:** historical Notion holds and unpublished candidates
  remain with their original owners. Local fixes do not reconcile those records.

## Before any real patient

The [production-readiness register](governance/PRODUCTION-READINESS.md) distinguishes
local engineering from required institutional and qualified external decisions:
clinical safety, WA privacy/information governance, legal forms, cultural safety,
reference-data verification, intended-purpose/TGA assessment and accountable
support. Internal D-37 statements record intended standards; they are neither
external approval nor proof those standards are implemented.

## Where to look next

Start with [the current roadmap](roadmap.md), the [remediation checkpoint](reports/remediation-2026-10-08.md)
and [the product entry point](README.md). Preserve the historical record below;
reconfirm its claims against current code before reviving work.

## Historical record (25 September 2026)

> **Historical source boundary — 2 October 2026.** The preserved material below
> describes the former Database/PsychSift workflow or a completed task. Its commands,
> hosting and appearance claims are not current Ward instructions. Use the
> [repository boundary](../../AGENTS.md) and [Ward entry point](README.md) for current work.

<!-- docs-script-refs:historical-start -->

**Historical status of the former Database ward line.** Last substantively measured
**25 September 2026**. Ward Flow now lives in its own public repository,
[`BigSimmo/Ward-Flow`](https://github.com/BigSimmo/Ward-Flow). For current work, start with
[Ward Flow's entry point](README.md) and the repository [AGENTS.md](../../AGENTS.md), then inspect
`main` and the current code. The older branches, checkout paths, run results and open-work claims
below are dated history; they are not instructions or current verification. Preserve this record
while moving active status to the current repository workflow.

## Historical snapshot (25 September 2026)

- At that time, threads worked in separate worktrees and folded into the local Database ward line.
  That process is historical; use the current repository [AGENTS.md](../../AGENTS.md).
- Guards in the old Claude settings and former Database checkout applied to that environment only.
  Do not infer the public repository's permissions or provider state from them.
- Every figure below names the tree it was measured on and is history unless re-run on current code.

## Former Database line

- **The one canonical master ward line** is branch `codex/task-ward-flow-live-state-20260831`, checked out in
  `D:/Worktrees/Database/ward-lead`. All relevant feature and audit branches (`fix/ward-flow-p0-chrome-strip`,
  `ward/journey-tooling-20260918`, `ward/audit-and-real-data-20260918`, `fix/ward-flow-elevation-waves-abcd`,
  `ward/audit-fixes-20260916`, `claude/ward-owner-rulings-20260919`) have been meticulously verified,
  cleaned of duplicate chrome and stale headers, harmonized to the Q005 navigation structure, and
  folded together into this single master line (tip commit `8d1c7c1e00` as of 2026-09-22 (confirm with `git log -1`) - confirm with `git log -1` before acting; suite figures below are dated measurements, not live CI).
- `ward/journey-tooling-20260918` is the same line under an older name and is kept in step by folding;
  it was last equal at `57ccf4725d`. `fix/ward-flow-elevation-waves-abcd` (locked worktree
  `ward-lead-elevation`) is fully contained in the line and holds nothing unfolded — checked 21 Sept.
- The former Database ward line was local only. That restriction described the old repository; it
  does not define the public `BigSimmo/Ward-Flow` workflow.
- 🔴 **THE FULL WARD SUITE RAN ON 21 SEPTEMBER, THE FIRST TIME SINCE 17 SEPTEMBER, AND IT IS RED.**
  41 ward test files failed and **none was in `tests/ward-expected-reds.json`**. Re-run on a clean
  detached checkout of the committed tree (`D:/Worktrees/Database/suite-check-20260921`) to exclude
  another session's in-flight edits: **36 of the 41 fail on the saved code and are real; 5 were
  artefacts of unsaved work.** 45 failing tests out of 549 in those files, reproduced identically
  across two runs.
- ✅ **Five fixed on 21 September** (`1c4fb63a80`, `0ca23adec0`), re-measured on the clean tree:
  36 files down to 31, 45 tests down to 40, **nothing newly broken** at that tip.
- ✅ **Wave 1 suite re-inventory (22 September, tip `f997ac75a1`):** of the later 19-file appendix,
  **17 pass; 2 fail (2 tests).** Remaining reds: `tests/viewport-fill-contract.test.ts` (referral
  intake CSS `100vh` floor — product-suspect) and `tests/ward-nav.test.ts` (people-route orphan pin
  drift — copy-pin). Items 16–18 (discharge / repeat-exam / cancel-authority) are green. The
  **31/40** and mid-day **19/20** counts are historical; do not quote them as current.
- ⚠️ **The 21 September 31/40 were not 40 separate problems — roughly eight causes.** Most cleared
  as product work folded. Wave 3 owns the two leftovers above.
- 🔴 **THE LESSON, WHICH IS WORTH MORE THAN THE LIST: nothing was wrong with any single
  change.** Four days of work from several sessions landed on top of each other with the suite
  never run, so each break was invisible until they were counted together. **Run it at the fold,
  not at the end of the week.**
- ✅ **Also measured 21 September at `f93d3bc32e`, and these are the whole of what else was measured:**
  `tsc -p tsconfig.typecheck.json --noEmit` — **0 errors across the project**; screen verification —
  **34 of 34 screens looked at, 0 structural problems**; `scripts/ward-flow/check-doc-links.mjs` and
  `check-source-control-chars.mjs` — **both exit 0**; `npm run docs:check-links` — **46 missing references, down from 115** at that tip (Wave 2 docs hygiene later cut deleted-target citations; see Deferred — **25 missing**, all intentional leftovers). No test suite
  was run beyond the files named in the commits of that day.
- **Last full gate run (17 September evening, round 2 fold, `ward/audit-fixes-20260916`):** every round-2
  branch plus the transport booking log merged; the full ward suite ran once and found 13 red files from
  branches colliding, all fixed and rerun file by file (the full suite was not rerun a second time, by the
  owner's speed instruction); tsc clean; eslint clean on changed source; diff-integrity and the four
  generator checks passing; browser `ui-ward-full-journey.spec.ts` and `ui-ward-roles.spec.ts` 21 passed,
  1 skipped. The other `ui-ward-*` browser specs were not run this round.
- **Previous run** (recorded in
  [`handovers/WARD-FLOW-PROGRESS-2026-09-16-NIGHT.md`](handovers/WARD-FLOW-PROGRESS-2026-09-16-NIGHT.md)
  §8, measured at `cad83238a0`, before round 2): full ward suite 570 files, 6,750 tests, 0 failing;
  tsc clean; diff-integrity, mockup-retirement, screen-map, mockup-manifest, owner-rulings-index and
  screen-verification all passing; every `ui-ward-*` browser spec passed (94 passed, 3 skipped),
  including `ui-ward-full-journey.spec.ts`.

## Round 2 — folded, and what is still open

**Folded into the ward line at `a7c7288668`** ("fold codex/task-ward-flow-live-state-20260831 (round 2,
owner answers 17 Sept)"), eight worker branches: `ward/r2-legal-gates-20260917`,
`ward/r2-legal-labels-20260917`, `ward/r2-gender-nonbinary-20260917`, `ward/r2-screens-b-20260917`,
`ward/r2-housekeeping-20260917`, `ward/r2-docs-20260917`, `ward/r2-transport-20260917`,
`ward/r2-screens-a-20260917` — plus Antigravity's sidebar drawing edit (`2664b44ea9`). Verified by
`git -C D:/Worktrees/Database/ward-lead log --oneline 5f9cd59cb2..a7c7288668`.

**Folded into the ward line (`c921b93fc4` and `089d316934`):**

- `c921b93fc4` — the referrer withdraws only the community arm of a referral (R2-11).
- `089d316934` — **the owner's third 17 September ruling, built:** transport booking now logs a phone
  call rather than making an in-app booking. `BOOK_TRANSPORT` requires a CAD transport number, whether
  the transport is voluntary or involuntary (independent of `Movement.legalStatus`, never changes it),
  and an estimated time — all three required, never defaulted. The ED screen's "Book transport" panel
  is now an accessible popup dialog, relabelled "Transport booked". The officer screen renders all
  three new fields. A community team's own booking is now claimed via a new `actingPlaceId` field
  (the same claim-not-proof discipline as `actingUnitId`), and `CANCEL_TRANSPORT` lets a community team
  cancel only a booking its own `actingPlaceId` made (owner answer 9). **The community-team screen's own
  book/cancel control is built** on that join: a pulled admission with `movementId` can
  `BOOK_TRANSPORT` / `CANCEL_TRANSPORT` with community role and `actingPlaceId`; null `movementId`
  shows no control. **Owner decision 1 (22 Sep 2026):** drawings own design look only — the admitted
  table Actions column keeps book/cancel (and Open Dossier when `patientId` is present) rather than
  matching the drawing's Open-Dossier-only Actions cell.

## What is built (folded, previous run §8, plus round 2 at `a7c7288668`)

- **Legal:** an ED discharge is refused on a legal form until the examination outcome is recorded
  (owner answer 1, `2276378987`); `PATIENT_COLLECTED` is refused while a revoked examination still
  holds the bed (owner answer 5, `395468fa5c`); form titles come from the register, not hand-written
  (T5, guard test `ward-form-labels-from-register`, `82c9ee77ed`); the Form 3A drawing no longer shows
  a "21-day" duration on the review track (`a296f65975`); Form 3D is confirmed as the further-examination
  order, up to 72 hours, with no duration shown (R2-3) — no computed legal time limits and no Act
  section numbers anywhere, the app shows only a time a person typed; repeat examinations; nurse unit
  manager tick on high-acuity override; gender checked at referral raise, with gender corrections
  re-checking the held ward.
- **Gender:** a non-binary patient may be placed on a single-gender ward, with a recorded
  `GenderPlacement` and a coordinator's reason (R2-2, `35ed967a7b`); the placement form no longer hides
  a single-gender ward from a non-binary patient (`2a199ac14f`).
- **Patients:** synthetic 40-patient cohort fully audited and modernised (all 40 resolved to valid
  catchments under S2015 tables with 0 contested or unknown, distinct invented surnames with no real-world
  Perth collisions, diverse cultural and linguistic backgrounds, diverse legal statuses including CTOs, and
  non-binary cohort testing unrecorded gender states).
- **Referrals:** ED to community team referrals; withdrawn acceptances no longer read "declined by all";
  GP as a referral source; ED outcome notices to the ward, officer and every asked ward; one journey per
  referral; referrals plan tasks T1, T3, Q1, Q2, RA1, RB2 to RB5 and RB7. **The referrer withdrawing only
  the community part of a referral (R2-11) is built and folded into the ward line (`c921b93fc4`) — see "Round 2" above.
- **Transport:** "Delivered"; cancelling with no bed held; stopping transport now keeps the bed held
  (a new `transportStoppedAwaitingRelease` blocker) instead of silently refunding it, with a separate
  "Release the held bed" control (`RELEASE_HELD_BED`) for the coordinator, ward, or referrer (owner
  answer 8, `d7a6b956a6`); a movement whose transport need is "none needed" can now be marked arrived
  directly from `pulled`, with no transport job (owner answer 10, same commit). **Closed 21 September (tip audit):** the ED screen now shows a "No transport needed" state (outbox row, board badge, and action) — verified in `ed-screen.tsx` on tip; STATUS Deferred row removed. **Transport booking now logs a phone call** (owner's third
  17 September ruling, `089d316934` — reported folded by Ward Lead, see "Round 2" above for this
  worktree's own verification limits): the ED "Transport booked" popup records the CAD transport
  number, voluntary/involuntary (independent of `Movement.legalStatus`), and an estimated time, all
  required; the officer screen shows them; a community team's own booking is claimed via
  `actingPlaceId` and `CANCEL_TRANSPORT` lets it cancel only its own. **The community-team
  screen's own booking/cancel control is built** (pulled admission + `movementId`; null shows no
  control).
- **Screens:** service chooser wired; Delays and Movements scoping; Capacity labels its whole-network
  panels; ward switcher for coordinators only; unconnected top-bar controls say "Not wired in this
  prototype."; screens plan tasks A3, B1, F3, G1, G2, H1 and H2; the Morning screen retired; the
  ward screen's free-text "limiting who can come in" box replaced with the owner's fixed, ordered
  checkbox list (R2-18, event `RECORD_WARD_INTAKE_CONSTRAINTS`, `df1604ba58`); the referral board's
  Tier card is bold, dark text again (Answer 13, `bad348180d`); Settings' Domain 3 and Domain 5 headings
  match the current drawing (`460c5a4e9c`) — see "Which Settings file" below.
- **Settings:** ED waiting target, wards referred at once, and pulled-bed hold (default 4 hours) are
  read from configuration. **Which Settings file is Gemini's rebuild (R2-15) is now recorded:**
  `settings-third-edition.html` — confirmed by git date (its Gemini rebuild commit `f0e5ea88f9`,
  16 September, is newer than the previously approved `1ef9ed3975`, 12 September) and it is the file
  routed at `/mockups/ward-flow/settings`. `settings-perfected-third-edition.html` stays reference
  only. See `mockups/README.md`. This resolves STATUS follow-up 8.
- **Housekeeping:** the stray control bytes in two lesson files replaced with visible escapes
  (`685a730d82`); the Aboriginal cultural safety review recorded as deferred by the owner, with an
  instruction not to re-ask (`1fe6f13463`, R2-6).
- **Docs:** README.md, STATUS.md and HOW-WE-WORK.md rewritten as one entry point (`fbb21e96fd`); a
  plans index by status, and this file's follow-ups and deferred items (`f7f07d15ae`); stale entry
  points, handovers, plans and superseded rulings bannered (`bb3c421d14`).
- **Sample data:** 60 movements and 30 referrals.

The task-by-task record is in the ledger (below). Its §7.2–§7.5 are dated 16 September and are marked
superseded by §7.8, the 17 September round-2 status refresh.

## Deferred (not being built now)

- **Command "Statewide flow" from every real ward** — done on Wave 4 milestone 1 (`92111bf3b5`); on ward-lead.
- Diversions T4a/T4b — folded on ward-lead (`ca0eededea` / `dc3f7c81e1`).
- Officer-screen print loss (R2-14) — folded on ward-lead (`d21964ed21`).
- Print-only ward panel (R2-19) — folded on ward-lead (`ba9de2673d`).
- Ward + handover drawing match (R2-12) — structural pins and perfected handover filter/KPI alignment folded on ward-lead (`bec12d9284`); browser look still the screen DoD.
- **Bed Board third-edition elevation (22 September):** Overhauled triage summary metrics into elevated telemetry cards with top-accent status borders and hover lifts (`bed-board-third-edition.html` & `board.module.css`). Structured patient detail panel with identity tags, stay counter, catchment and legal status, diagnosis, and departure planning (`ward-board.tsx`). Fixed detail panel sticky clearance under `WardBar` (`top: 7.5rem`). Footnote disclaimer removed. Passes all 119 ward-board tests.
- **Suite expected-reds (22 September):** elevation/CSS expected-reds and the phone-chrome owner
  entry are retired — community `.sovereignHeader` / `.tabBarWrap` release to `position: static`
  below 48rem so only WardBar `.bar` remains as mounted top-anchored phone chrome outside the
  documented `.modeHeader` backlog. `tests/ward-expected-reds.json` is empty. Four other reds
  stay _unexpected_ on purpose — engine audit integrity, facade counts, ready-figure qualifier, and
  discharge focus journey — until fixed; do not retire them into the manifest to go green. The
  mutation-harness self-test Windows file-lock flake is hardened (longer open retries, leftover
  `"mutated"` anchor heal, self-test child retry + finally restore) as of this tip.
- **R2-12 browser look (22 September, tip confirm with `git log -1`):** looked on this project's
  server (`http://localhost:3605`, projectId `clinical-kb:d0a358b585df`) with drawings served
  beside. Observation only — no UI edits, SCREEN-VERIFICATION left untouched (not a formal DoD
  pass). Do not treat green tests as drawing match.
  - **Desktop (first pass):** Ward `/ward/rph-adult-secure` shows Enter Ward / Open Bed Board,
    live capacity glance cards, and operational tabs Home / Arrivals / Discharges / Beds /
    Decisions aligning with `ward-perfected-third-edition.html` structure, plus kept engine
    panels (Today's return, Ward figures, suburb team, print handover). Handover `/handover`
    shows shift / scope / focus filters, KPI tiles (caseload, referrals, vacancies, form
    expiries, 1:1), Rapid Snapshot sections, and the verified table sheet — matching the
    perfected handover filter/KPI shape.
  - **Wider look (~17:00 AWST, phone 390 / tablet 820 / desktop + handover dark):** Ward and
    handover still share the drawing structure at every width looked. At 390 and 820, live still
    shows stacked rail chrome (`More pages 15`) above the body — not a drawing-like single phone
    composition; glance / Enter Ward / filters / KPIs remain reachable below. Live was RPH Ward
    2K vs drawing FSH sample (counts and empty “Awaiting your answer” differ). Handover KPI
    naming differs (live “Form Expiries Passed” vs drawing “Critical Breaches”); live keeps
    richer engine sections the drawing compresses. **Dark mode:** Appearance → Dark on live
    handover keeps filter/KPI/sheet/rail structure (`data-theme="dark"`). One Next.js hydration
    overlay appeared once on handover and was not investigated. Still not screen DoD.
- **Paused mid-burst (collision):** any further work that overlaps another session’s dirty
  `src/components/ward-management/**` or `tests/**` (e.g. untracked `ward-service-colors*`).
  Stashes and `D:\Temp\ward-*` asides / husks / control backups are left untouched on owner
  instruction.
- **The old broken document links — mostly done, 21 September (`f93d3bc32e`), Wave 2 hygiene 22 September.** 115 broken references
  down to 46, then deleted-target citations rewritten as "gone" sentences (morning / tour / horizon /
  PROGRESS and similar). Measured after Wave 2 docs: **25 missing** on `npm run docs:check-links` —
  all intentional leftovers, not blind-repoints: **11** name a file that exists and fail only because
  the checker mis-reads a `:line` / `:~` / en-dash range suffix; **~10** are deliberate placeholders
  or globs (`[name]`, `[feature]`, `…third-edition`, `control/register/*`); **2** point outside the
  repository on purpose (`MEMORY.md`). Do not invent new targets for those classes.
- Deleting the retired chat-control machinery in `docs/ward-flow/control/` (WLQ-33). It is bannered as
  retired; deletion is a protected action and needs the owner's yes and a backup.
- **The Aboriginal cultural safety review.** Deferred by the owner (R2-6): **do not ask him again.** It
  stays a hard gate before any real-patient use, together with the other parked outside reviews (TGA,
  clinical safety officer, privacy, WA legal advice, catchment data, post-incident review; owner item 63).

## Settled by Ward Lead on 17 September (recorded as decided)

- **Drawings.** The drawings committed at HEAD are the design for every screen, including Antigravity's
  ward and handover drawings and Gemini's Settings rebuild (`settings-third-edition.html` — resolved,
  see "What is built" above). The earlier instruction not to build against "the fourteen replaced
  drawings" is retired. FYI, not a blocker: the owner may override any screen.
- **Locked-bed (security) gate.** Overridable with a recorded reason (WLQ-3), as built. The "stays
  absolute" row in `docs/ward-flow-ledger.md` was recorded in error and is marked so.
- **Fold rule.** One ward line (above). A temporary integration branch is allowed only if it is folded
  home before anyone reports done. Every worker worktree gets a registry row or a line in this file first.
- **Ledger.** `docs/ward-flow-task-ledger.md` is the ledger. `docs/ward-flow-ledger.md` is the decision
  register. `PROJECT-ISSUES.md` is a historical worksheet.
- **Answered clarifications.** 17 (R2-11), 28 (R2-10, no transport needed), 39 (R2-15), 46 (R2-16),
  49 (R2-18, a fixed list). Non-binary placement is allowed with a coordinator's reason (R2-2). Form 3D
  is the further-examination order, up to 72 hours, with no duration shown (R2-3).

## Needs the owner

Nothing. Both remaining questions were answered on 17 September (see `owner-answers-2026-09-17.md`, "Fourth ruling"): the Statistics link is added to the patient-search drawing's side menu, and the urgent-flag reason placeholder wording stands as drafted.

Before any real data, item 58 (internal patient codes) is decided again.
Never list the Aboriginal cultural safety review here — it is deferred and closed to further asking
(R2-6, see "Deferred" above).

## Owner rulings 21 September 2026 (implemented)

Recorded from Joshua's instruction to implement Chief's recommendations safely on the local ward-lead tip:

1. **Eligibility specialling/acuity** — keep always-`pass: true` + invite-then-refuse. `PULL_PATIENT` remains the staffing refuse. Do not restore a shortlist fail on authored-zero capacity.
2. **Scarce night** — accept the current stranded set of **3** (WF-009, WF-021, WF-308) as the escalation baseline. Do not enlarge the fixture for demo stress.
3. **Admission ↔ Movement** — `Admission.movementId` added (`null` for historical seed; `PULL_PATIENT` writes `movement.id`). Community book/cancel UI scopes bookings through that join when `movementId` is present.

## The ledger

[`docs/ward-flow-task-ledger.md`](../ward-flow-task-ledger.md) is the only Ward Flow task ledger. The
repository-wide `docs/outstanding-issues.md` is not used for Ward Flow (owner ruling D-11).

## Follow-ups for Ward Lead at the fold

**Done, 17 September evening, by Ward Lead's docs helper:**

1. **Task ledger.** §7.8 added: a status refresh for 17 September, round 2, measured against git. The
   top banner now points at it. §7.2 to §7.5 are marked superseded by it; the 16 September rows are
   unedited.
2. **Task ledger §3.** DECISION-01 to 09 now carry a banner: the recommendation text is an AI's and is
   superseded by owner items 1, 3, 8 and 9 and R2-2. The `claude/Ward-design:` prefix on the
   decision-register pointer is fixed to a plain path, and `docs/ward-flow-ledger.md` §B is added as a
   source.
3. **OPEN-QUESTIONS.md.** Now keeps only two items under "Needs the owner". Marked as answered: gender
   wiring (item 8), community cancel (item 24, R2-9), ED drawing (item 42), and cultural review (R2-6,
   with an instruction never to list it as a question again). Its cross-reference line now points at the
   task ledger, not `PROJECT-ISSUES.md`.
4. **Rules index.** Regenerated (the lesson control-byte fix it was waiting on, `685a730d82`, folded
   before this round started) and `node scripts/ward-flow/rules-index.mjs --check` re-run.
5. **Which Settings file is Gemini's rebuild.** Recorded: `settings-third-edition.html` (routed at
   `/mockups/ward-flow/settings`), confirmed by commit date. See "What is built" above and
   `docs/ward-flow/mockups/README.md`.

**Closed by Wave 2 docs hygiene (22 September):**

4. **Owner rulings index.** `owner-answers-2026-09-17.md` now carries parseable `OA-n` / `R2-n` /
   `OA-65` / `OA-66` headings. `OWNER-RULINGS.md` regenerated; that file is no longer UNPARSED
   (`node scripts/ward-flow/owner-rulings-index.mjs --check` green). Five other files remain UNPARSED
   (open-question / pending-device notes — generator limitation, listed not dropped).
5. **Facts re-checked before quoting (item 40).**
   - **WLQ-10 capacity wording:** agrees across capacity-screen copy, capacity-derivations comments,
     and the WLQ-10 ruling — a held-up discharge keeps counting and shows since when the oldest
     blocked release has been held up. No three-way disagreement remains on tip.
   - **Shortlist patient link (ledger §B Q13 vs DECISION-04):** `coordinator/shortlist-panel.tsx`
     **does** read `referral.patientId` and is on the D-14 allowlist (14 entries). The 16 September
     ledger note that said the link was taken back out is **stale**; DECISION-04 / WLQ-30 / allowlist
     stand.
6. **Numbering.** Second-round answers are indexed as `R2-n`; round 1 as `OA-n`. Prefer those IDs
   when citing.

**Wave 1 close-outs recorded here (docs only):**

- Scarce night measured **3** stranded (WF-009, WF-021, WF-308) — matches the 21 September ruling;
  only the old test pin still said nine.
- Safety P1 #5–11 closed on tip (settings custody / Issue / lawful chrome already gone from the live
  settings screen; banned-phrase test correctly keeps historical phrases).
- ED "No transport needed" already shipped (A2) — Deferred row removed earlier; What-is-built already
  notes the ED state.

<!-- docs-script-refs:historical-end -->

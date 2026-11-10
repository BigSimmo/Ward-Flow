# Tier 7 large audits: measured facts and refactor plan (M139 to M156)

_Updated 2026-11-10 - first draft from read-only measurement; Documentation owns._

Audience: Josh (owner) and the agents who will build it. Status: **draft for Josh's approval. No
refactor starts until Josh approves this plan** (his Tier 7 rule). Nothing in this plan has been
built. Baseline: `main` at `29352cd0` (10 November 2026), measured in a cloud checkout on
10 November 2026. Source: the master audit list, items M139 to M156.

## The answer first

- **Start with three cheap, safe audits**: the hotspot report (M142), the import map with a cycle
  and layer guard (M139), and the mockup build test (M149). Each is one small PR, changes no
  behaviour, and tells us where the big refactors should go.
- **The best-value refactor is M140, one place that counts beds.** The bed helpers take the
  named-referral input as an optional argument that defaults to "none". That default is how a
  screen can miss a rule like D-115 item 3 without any error. Making it required is a small first
  PR that makes the compiler list every screen that needs checking.
- **Every phone screen is at its size limit because the shared engine loads on every page**
  (M148). Splitting large files (M141) will not fix that on its own. The fix is to stop shipping
  the whole engine, seed and storage validator to every screen on first load.
- **Some list figures were wrong or stale.** There is **1** real `any` in app code, not 42; the 42
  came from matching the word "any" in comments. The 17 unused-code entries are now 16. Details
  under each item.
- **Josh needs to decide five things** (numbered list at the end), including the backend type
  route (M144), a unit-test time target (M150), and whether to pay for an outside engineering
  review (M155) or accessibility assessor (M154).

## Top five recommendations

1. **M140 first slice:** make the named-referral input required on `bedStates`, `readyBedsNow`
   and `totalReadyBedsNow`, pass it explicitly everywhere, then add one `bedPicture` function and
   a guard test that stops screens calling the helpers directly.
2. **M148:** run a per-screen bundle analysis and move the demo seed, the full storage validator
   and rarely used engine slices out of the shared first-load chunk, aiming for 5 KB of headroom
   per screen without raising any limit.
3. **M139 plus M142 together:** check in the import map and a CI rule that fails on a new cycle
   (the runtime graph has none today; the survey's one seven-file cycle came from type queries), and a ranked hotspot list that sets the order for
   M141.
4. **M150:** the eight Mental Health Act figure sweep files cost about 30% of all unit time. Keep
   them (they guard legal figures) but profile and speed up the shared sweep helper, and slim the
   878 test files that mount the whole app provider.
5. **M141 in hotspot order:** split the 11 files over 1,500 lines, starting with the event list,
   the reducer and the shortlist panel, and put a line cap on the backend (the 3,238-line database
   file has none today).

## How this was measured, and its limits

- All counts are from the local checkout at `29352cd0`. Scratch scripts were used; none were
  added to the repository.
- **Git history is shallow.** The local copy holds 697 commits, from 7 to 10 November 2026 only
  (the oldest is a grafted snapshot of the whole tree, left out of the counts). So "changes in the
  last month" cannot be checked here. The list's figures (ward screen 128 commits, reducer 110)
  came from a fuller history and are not confirmed. A full history download before the M142
  report is pre-approved for pushes only; for this report it needs Josh's yes, or the report can
  run in CI.
- Unit test times come from the checked-in record `scripts/ward-flow/unit-durations.json` (CI run
  on 4 November, 1,956 files, coverage on). About 300 newer test files are not in it.
- No build was run (shared machine), so bundle sizes come from the latest budget records, not a
  fresh measurement. No network, provider or registry call was made. Outdated-package checks need
  a registry read and were not done.
- One focused sample was run to compare local and recorded speed: `npx vitest run
tests/max-lines-baseline.test.ts tests/ward-event-reachability.test.ts
tests/ward-raw-colour-ratchet.test.ts`: 3 files, 6 tests passed, 2.8 s (recorded: 3.6 s).

## Suggested order

| Step | Items                   | Why this order                                                       | Size        |
| ---- | ----------------------- | -------------------------------------------------------------------- | ----------- |
| 1    | M142, M139, M149        | Cheap audits that set the order and add guards; no behaviour change  | 3 small PRs |
| 2    | M145, M152, M153        | Small baselines and path checks; stop new debt before refactoring    | 3 small PRs |
| 3    | M140                    | Highest value; needs the open D-115 PRs merged first                 | 3 to 4 PRs  |
| 4    | M143, M148              | Event table, then bundle work that the event table informs           | 2 to 4 PRs  |
| 5    | M141, M147              | Split files and remove dead styles, one area per PR, in M142's order | 10 to 15    |
| 6    | M146, M150              | Shared schemas and test speed                                        | 4 to 6 PRs  |
| 7    | M144 (after Josh rules) | Backend types; then M151 schema review                               | 4 to 8 PRs  |
| 8    | M151, M156, M154, M155  | Before real data, before any hospital link, before a pilot           | docs + PRs  |

One PR per thread (D-107) still applies: each step is its own thread, and each thread keeps to one
PR where it can. Refactors touching `ward-screen.tsx`, `shortlist-panel.tsx` or the reducer wait
until no other open PR holds them.

---

## M139. Architecture and dependency map

**Today (measured).** 1,835 non-test source files in `src` and `backend`, with 9,570 runtime
imports between them (type-only imports left out).

> **Recount, 10 November 2026 (M139 PR 1, review).** The survey below also counted TypeScript type
> queries (`import("./x").T`) as imports, and covered `backend` too. The checked-in tool,
> `scripts/ward-flow/import-map.ts`, walks `src` only and leaves out type-only imports and type
> queries. On this branch it finds 1,809 files, 9,430 imports, **no cycle** and **564**
> screen-to-screen imports across 235 folder pairs. `scripts/ward-flow/import-map-baseline.json`
> freezes the cycle list and the screen-to-screen count. The seven-file cycle is not found once type queries are left out, so it is
> not a runtime cycle, and PR 2 below has nothing to break. The 659 and 257 figures are the survey's.

- **One import cycle** (survey count; see the recount above), seven files: `ward-clock.ts`, `ward-operational-defaults.ts`,
  `ward-clinical-values.ts`, `ward-model.ts`, `ward-model-movement-parts.ts`,
  `referrals/referral-submission.ts`, `ward-referral-seed-time.ts`.
- **Most-depended-on modules:** the kit `wf/index.ts` (604 importers), `ward-clock.ts` (471),
  `ward-flow-provider.tsx` (292), `ward-sites.ts` (183), `shell/ward-access-store.ts` (167),
  `ward-model.ts` (165).
- **Layers are not written down.** The folders under `ward-management/` mix screens with engine
  slices: the reducer imports eight files from screen folders (for example
  `capacity/planned-admissions-reducer.ts`, `staffing/staff-requests.ts`), and the event list
  imports nine. Screen folders import other screen folders 659 times (not counting `shell`), across
  257 folder pairs. The 349 root files of `ward-management/` import screen folders 249 times.
- **What is already guarded:** live code cannot import mockups (ESLint `no-restricted-imports`);
  screens cannot call the network directly (boundary test, M93). The kit and `src/lib` import no
  ward screens (0 found). The backend imports 28 app files, all through `command-schemas.ts` and
  the built engine, which is intended.

**Approach.** First write the layers down: kit, `src/lib`, engine (events, reducer, slices,
model, clock, values), shared client and shell, screens, routes, backend. Move the engine slices
that sit in screen folders to the engine, or mark them as engine by name. Then add an offline
check (a small Node script over the TypeScript import graph, no new dependency) that fails on a
new cycle or a new layer breach, with today's breaches as a frozen baseline that may only shrink,
like the line-cap and raw-colour ratchets.

**PRs.** (1) Map and baseline check, plus the map page in the code map (built). (2) Dropped: the
runtime graph has no cycle (see the recount above), and the baseline fails on any new one.
(3 onwards) Shrink the baseline as M141 splits land.

**Risk.** Low. The map is read-only.
**Effort.** Medium: about 2 days of agent time for PRs 1 and 2. **Needs Josh:** approve the
layer list (question 1).

## M140. One place that counts beds

**Today (measured).** 73 non-test source files call one of the bed helpers (`bedStates`,
`readyBedsNow`, `totalReadyBedsNow`, `openBedsNow`, `capacityBreakdown`, `wardBedsInUse`,
`lockedBedsFree`, `openBedsFree`, `bedKindGaps`, `bedsFreeingTodayTotal` and others). `bedStates`
alone has 30 caller files and `readyBedsNow` 24.

The root cause of the D-115 item 3 misses is visible in `ward-bed-states.ts`: `bedStates`,
`readyBedsNow` and `totalReadyBedsNow` take `referrals` as an **optional last argument that
defaults to an empty list**. A screen that forgets it gets no error and a count that ignores
beds spoken for by a named referral. Counting single-line calls only: 21 `readyBedsNow` calls, 25
`bedStates` calls and 7 `totalReadyBedsNow` calls pass no referrals. Some may be right (a view
where named referrals cannot apply), so **this is a list to check, not a confirmed defect**. PR
#1587 (D-115 items 3, 4 and 6) was still merging at measurement time.

`ward-shared-figures.ts` already names one source per figure, and
`tests/ward-one-number-across-screens.dom.test.tsx` (M24) checks screens agree. What is missing
is one entry point that takes the whole picture.

**Approach.**

1. Make `referrals` required on the three helpers. Each caller then passes it, or passes `[]`
   with a one-line reason. The compiler finds every site. No count changes in this PR; any site
   that looks wrong is listed for Josh, not changed.
2. Add `bedPicture(state)` (admissions, bed releases, leave beds, referrals and movements, built
   once per state) and `wardBedFigures(unit, picture)` returning ready, in use, held, pulled,
   closed and on leave. Move screens onto it in batches by area.
3. Add a guard test: only the figures module (and an exact, shrinking allowlist) may call the raw
   helpers. M24's test must pass unchanged at every step.

**PRs.** 3 to 4: required argument; `bedPicture`; screens moved in two batches; guard test with
an empty allowlist at the end.

**Risk.** Medium. These are clinical display counts. The rule is no count changes: a site whose
count would change is a finding for Josh, not a fix. Touches screen files other PRs often hold.
**Effort.** Large: about 4 to 6 days of agent time. **Needs Josh:** nothing to start; a ruling
on any call site found to disagree with D-115.

## M141. Break up the largest files

**Today (measured).** 136 non-test source files are over 800 lines (the list said 139). **11 are
over 1,500 lines**: `backend/ward-flow/postgres.mjs` 3,238; `shortlist-panel.tsx` 2,850;
`ward-flow-events.ts` 2,750; `ward-screen.tsx` 2,567; `ward-flow-reducer.ts` 2,556;
`ward-home-tab.tsx` 2,138; `ward-movements.ts` 1,947; `movement-workspace-cockpit.tsx` 1,930;
`ward-model.ts` 1,777; `ward-answer-view.tsx` 1,741; `ward-patients-seed.ts` 1,655.

- The line-cap ratchet (`eslint-rules/max-lines-baseline.mjs`, default 1,500) covers `src`
  only. **The backend has no line cap**, so the largest file in the repository is unguarded.
- **23 files sit between 1,450 and 1,500 lines**, pressed against the default cap. Work in them is
  being squeezed to fit rather than split.

**Approach.** Split along natural seams with no behaviour change: event union by area (like the
existing `ward-flow-*-events.ts` files), reducer cases into the existing slice registry, the
shortlist panel and ward screen by section component, `postgres.mjs` by concern (workspace,
records, access, push, receipts). Lower each cap in the same PR. Add a backend cap to the ratchet.
Mock-up copies listed in the baseline (D-89) stay as they are.

**PRs.** One per file or area, in M142's order. About 11 PRs, plus one for the backend cap.

**Risk.** Medium: mechanical moves, but these are the busiest files, so merge conflicts with
other threads are the main risk. Split only when no other open PR holds the file. **Effort.**
Large overall; about 1 day per file. **Needs Josh:** nothing beyond approving this plan.

## M142. Change hotspots

**Today (measured, shallow history).** Changes per file across 499 non-merge commits from 7 to
10 November, multiplied by file size. Top of the ranking:

| Rank | File                              | Commits | Lines |
| ---- | --------------------------------- | ------- | ----- |
| 1    | `ward-flow-events.ts`             | 16      | 2,750 |
| 2    | `ward-flow-reducer.ts`            | 17      | 2,556 |
| 3    | `coordinator/shortlist-panel.tsx` | 14      | 2,850 |
| 4    | `ward/ward-screen.tsx`            | 12      | 2,567 |
| 5    | `handover/handover-page.tsx`      | 20      | 1,498 |
| 6    | `backend/ward-flow/postgres.mjs`  | 9       | 3,238 |
| 7    | `discharges/discharge-board.tsx`  | 18      | 1,500 |
| 8    | `ward-flow-storage-validation.ts` | 18      | 1,490 |
| 9    | `movements/movements-screen.tsx`  | 17      | 1,476 |
| 10   | `shell-next/next-rail-body.tsx`   | 16      | 1,500 |

The most-changed file is `coordinator/coordinator-screen.tsx` (22 commits, 1,006 lines).

**Approach.** Check in a small script that prints this ranking from `git log`, over 90 days,
skipping merge commits and the grafted snapshot. Rerun quarterly. The first real report needs
fuller history than this checkout has.

**PRs.** 1. **Risk.** None. **Effort.** Small: half a day. **Needs Josh:** a yes to download
full history for the report, or agreement to run it in CI (question 2).

## M143. Event and reducer design review

**Today (measured).** About 193 event types (keys of `EVENT_ROLE`). Two of the four required
parts are already enforced by the compiler: `EVENT_ROLE` and the persistence classification are
both `Record<WardFlowEvent["type"], …>`, so a missing event fails `tsc`. The reducer file has
about 189 `case` labels; the rest go through the slice registry. `tests/ward-event-reachability.test.ts`
already fails on a handled event no screen sends, with an exact register of known gaps (1 entry
today). `tests/ward-event-permissions.test.ts` covers roles.

**Gaps to find.** Whether every event has its own permission case in the test (not only a table
entry); events handled in two places (main reducer and a slice); state stored in two places (for
example a figure saved and also derived).

**Approach.** A generated event table (type, handler file, persistence class, roles, permission
test, screens that send it) written by a script, checked in, and checked for drift in CI. Close
each gap or record it with a reason.

**PRs.** 2: the table and drift check; then gap fixes or records. **Risk.** Low. **Effort.**
Medium: about 2 days. **Needs Josh:** nothing; any gap that changes who may do what goes to him.

## M144. Backend type safety

**Today (measured).** The backend has 86 code files: 84 JavaScript (`.mjs`), of which 75 carry
`@ts-check`, plus 2 TypeScript (`command-schemas.ts`, `engine.ts`). Its `tsconfig.json` is strict
but sets `noImplicitAny: false` as a "temporary" opt-out. **Backend type errors already fail CI**:
the backend job runs `npm run typecheck` before its tests. Request bodies are checked with Zod in
`command-schemas.ts`; the app does not import those schemas, and replies and database rows are not
typed.

**Options.**

- **A. Stricter type-checked JavaScript (recommended).** Turn on `noImplicitAny`, add `@ts-check`
  to the 9 files without it, add JSDoc types for rows and replies, and share Zod schemas for
  requests and replies with the app. Smallest change; keeps the "no build step" backend.
- **B. Full TypeScript.** Rename to `.ts` and add a build or a TypeScript runner. Bigger change to
  deploy and scripts.

**PRs.** A: about 4 (turn on `noImplicitAny` file group by group; shared reply schemas; row
types; app uses shared schemas). B: about 8. **Risk.** Medium for B (deployment path changes), low
for A. **Effort.** A medium, B large. **Needs Josh:** choose A or B (question 3).

## M145. Type escapes in the app

**Today (measured with the TypeScript parser, not text search).** In `src` (1,802 files): **1**
`any` (`ward-shared-push-api.ts`), **13** `as unknown as` double casts, **0** `@ts-ignore` or
`@ts-expect-error` (the one found by text search is inside a comment), and **104** ESLint
switch-offs in 78 files, of which **86 already carry a reason** after `--`. The most common
switch-offs are `jsx-a11y/click-events-have-key-events` (28), `react-hooks/exhaustive-deps` (18)
and `jsx-a11y/interactive-supports-focus` (15). Tests hold 1 `any` and 384 double casts, which
are normal in fixtures and out of scope.

**Approach.** Remove the one `any`; give each double cast and the 18 unexplained switch-offs a
reason or remove them; then a baseline check that fails on any new one. The 92 accessibility rule
switch-offs (one comment can switch off several rules) deserve a look with M154, since each is a place a mouse works and a keyboard may not.

**PRs.** 1 to 2. **Risk.** Low. **Effort.** Small to medium: 1 day. **Needs Josh:** nothing.

## M146. Data shapes at every boundary

**Today (measured).** Hand-written validators: `ward-flow-storage-validation.ts` (1,490 lines,
device storage), `ward-shared-state-validation.ts` (171, shared replies), about 32 files with
`is…`/`parse…` checks on unknown input. Only 2 app files use Zod; the backend's Zod schemas are
not used by the app. Boundaries: device storage, poll replies, push messages
(`shell/ward-phone-push*.ts`, the service worker), and imported scenario files.

**Approach.** One Zod schema per shape in a shared folder that both the app and backend import;
replace hand validators one boundary at a time, keeping each verdict identical (the storage
verdict fixtures in `tests/fixtures/` prove that). Add a test per boundary that feeds malformed
and old-version data. Zod also loads on every phone screen, so measure size with M148 first; if
it costs too much, keep hand validators generated from the schema.

**PRs.** 4: shared schema folder and poll replies; push; imports; device storage (largest, last).
**Risk.** Medium: device storage decides what survives a reload, so verdicts must not change.
**Effort.** Large: about 5 days. **Needs Josh:** nothing, unless a verdict would change.

## M147. Styles and design-system debt

**Today (measured).** 437 style files outside `docs`, `design` and `public`, with about 201,000
lines. The raw-colour ratchet already exists: `scripts/ward-flow/check-raw-colour.mjs` with
`tests/ward-raw-colour-ratchet.test.ts`; its baseline has **25 raw colours left in 10 files**. Of
token use, 33,338 are v9 `--wf-*` names; older names remain (`--ward-*` 2,054, `--t-*` 937,
`--surface-*` 397 and others). The v2 token layer `ckb-v2-tokens.css` (712 lines, inherited
from PsychSift) still loads; no stylesheet reads `--ckb-*` names directly, but older screens rely
on the plain names it defines.

**Approach.** A report of unused class rules (CSS modules make this checkable: a class no
component reads is dead), the 25 raw colours, and older token names by file. Remove dead rules
area by area; move older names to `--wf-*`; retire `ckb-v2-tokens.css` last, once nothing reads
its names, checked on the screens with screenshots.

**PRs.** Report, then one per area, about 6. **Risk.** Medium: appearance changes are easy to
miss; each PR needs screenshot checks per the UI rules. **Effort.** Large. **Needs Josh:** yes
before the v2 layer is removed (question 4 covers design approval).

## M148. Phone bundle structure

**Today (from the 9 November budget record, not rebuilt here).** Limits in `script-budget.json`
range from 529.6 KB (ED) to 664.5 KB (ED Armadale). PR #1583 raised eight screens by 1.1 to 4.4 KB
each, and its record explains why: new engine records "join the shared engine every page loads",
including reducer cases, event roles, the storage schema, the seed and the demo overlay. So every
engine feature grows every screen.

**Approach.** A per-screen analysis from the webpack build stats, naming the largest shared and
duplicated modules, checked in as a report. Then move out of first load: the synthetic seed
(`ward-patients-seed.ts`, 1,655 lines) and demo overlay, the full storage validator (validate the
fields first load needs, the rest when used), and engine slices no first screen needs. Remove the
duplicate framework chunk the list names. Then lower each limit to leave 5 KB headroom.

**PRs.** 3 to 4: analysis report; seed and overlay split; validator split; duplicate chunk.
**Risk.** Medium: loading order changes can show a blank or a flash. **Effort.** Large. Each
analysis needs a production build, which must run on a free machine or in CI. **Needs Josh:**
nothing to start; the limits come down, never up.

## M149. Mockups kept out of the live app

**Today (measured).** Two mockup families remain in the app folder: `src/app/mockups/ward-flow-redesign`
(a page, a `[screen]` route and a `_preview` folder, 18 files) and `src/app/mockups/ward-flow-digest`
(one route). Both are **built into the deploy but refused at run time**: the layout and the route
call `shouldBlockProductionMockups` and return 404 in production, and `src/proxy.ts` blocks
`/mockups` in production too. `DEVELOPER_GATED_PATH_PREFIXES` is empty, so no mockup is exempt.
`tests/proxy.test.ts` covers the block; ESLint stops live code importing mockups.
`src/components/ward-redesign/` is live code (pop-ups, ED board), not mockups.

**Approach.** Add one test that lists every route under `src/app/mockups` and fails unless each is
in an exact list with its reason and a proven 404 in production. Leaving them out of the build
entirely is possible but would need a build-time switch; the test is the smaller route.

**PRs.** 1. **Risk.** None. **Effort.** Small: half a day. **Needs Josh:** nothing.

## M150. Test suite speed and shape

**Today (measured).** 2,334 test files (2,251 unit, 32 Playwright specs, the rest backend). CI
runs unit tests in 4 shards; the limit was raised from 20 to 30 minutes on 10 November because
shards now take 15 to 20 minutes. From the 4 November timing record (1,956 files, 11,697 seconds
of worker time):

- **The 8 Mental Health Act figure sweep files cost 3,506 s, about 30% of all unit time**, each
  291 to 535 s. They are safety tests and CI already runs them only when relevant files change.
- The next two: `ward-delays-screen.dom.test.tsx` 236 s and `ward-executive-statistics-projector.test.ts`
  203 s.
- The 50 slowest files are 48% of the time; 158 files take over 10 s; the median is 2.2 s.
- DOM tests: 973 files, 6,170 s. **878 test files import the whole app provider**, the main
  candidate for smaller fixtures.

**Approach.** Never delete or weaken a safety test. Profile the shared sweep helper
(`tests/helpers/ward-legal-figure-sweep.ts`) for repeated work, such as rebuilding state per
event. Give the slowest DOM tests a small fixture instead of the full provider and seed. Find
tests that check the same rule twice and merge them with the owner's existing checks-and-evidence
rules. Refresh the timing record.

**PRs.** 3 to 5. **Risk.** Low if each change keeps the same assertions; a test change must still
fail when the rule breaks. **Effort.** Large. **Needs Josh:** a target time (question 5).

## M151. Database schema review before real data

**Today (measured).** 35 SQL files: 17 migrations (001 to 017), 12 rollback scripts (for 006 to
017 only; none for 001 to 005), role and hardening scripts, and 1 proposal. 17 tables, 99 `CHECK`
constraints, 26 foreign keys, 4 `UNIQUE`. **The clinical state is stored as JSON** in
`workspaces.payload` and `workspace_records.body`, so rules the engine relies on (one bed per
admission, valid states, linked records) are kept by the engine, not the database.

**Approach.** A schema report per table: keys, constraints, naming. Decide which engine rules
need a database check before real data (some can be JSON checks or generated columns; others need
real tables). Add missing constraints with rollback scripts. Write up the squash question.

**PRs.** Report, then 1 to 3 constraint PRs. Every migration is its own stage and needs Josh's
yes, and nothing is run against a hosted database without it. **Risk.** Medium to high: a wrong
constraint refuses valid saves. **Effort.** Medium. **Needs Josh:** the squash decision and each
migration (question 4).

## M152. Framework and dependency health

**Today (measured).** Next.js 16.4.5 and React 19.3.1. Checked against the Next 16 upgrade guide in
`node_modules/next/dist/docs/`: `middleware` is already `proxy` (`src/proxy.ts`); no
`next/legacy/image`, `images.domains`, `revalidateTag`, AMP or runtime config was found.
`forwardRef` is used once (`wf/folder-tabs.tsx`); React 19 lets `ref` be an ordinary prop. The
unused-code baseline (`knip-baseline.json`) has **16 entries, none with a reason**. Outdated
packages were not checked (needs a registry read).

**Approach.** A dated upgrade plan with the outdated list, a reason per baseline entry or its
removal (removal needs the owner-approved dead-code override), and `forwardRef` replaced. Twice a
year.

**PRs.** 1 to 2. **Risk.** Low. **Effort.** Small: 1 day. **Needs Josh:** the dead-code override
for removals.

## M153. Code map and documents match the code

**Today (measured).** 694 Markdown files are tracked (383 of them in `docs/history`). The code
map names 1,858 distinct files in backticks; **243 do not exist** today (for example
`ward-contention.ts`, `middleware.ts`, `ed/ed-home.tsx`, the third-edition statistics styles).
Some are deliberate history; most look stale. `docs:check-index` checks the reverse (folders
missing from the index), not this.

**Approach.** Add a path check over the code map that fails on a new missing file and lists
today's as a baseline. Fix the stale names. Propose stale documents for archiving in a list;
moving any of them needs Josh's yes (rule 8). Quarterly.

**PRs.** 1 to 2. **Risk.** None. **Effort.** Small to medium. **Spend:** none; it runs locally.
Running it quarterly in hosted CI uses Actions minutes, which are probably included but not
confirmed. **Needs Josh:** yes for each archive move.

## M154. Full accessibility conformance report

**Today.** Spot checks exist (M97, M98, 28 test files use axe, and
`docs/ward-flow/evidence/accessibility-check-2026-11-08.md`). There is no criterion-by-criterion
WCAG 2.2 AA report per desk.

**Approach.** A dated report per desk with every criterion marked pass, fail, not applicable or
not tested, built from automated checks plus a manual keyboard and screen-reader walkthrough by a
person. Open failures listed. The 92 accessibility rule switch-offs (M145) feed into it.

**Effort.** Medium for the agent draft; the manual walkthrough needs a person. **Spend:** the
draft costs nothing extra. **An outside assessor is billable**; no cost estimate exists, so it
needs Josh's yes and a quote before booking. **Needs Josh:** whether to engage an assessor, and
when (question 4).

## M155. Independent engineering review

**Today.** Not started; it should follow M139 (map) and M144 (backend types) so the reviewer reads
a mapped system.

**Approach.** A short brief for an outside senior engineer: architecture map, backend, access
model, test strategy, synthetic data only, no live access. A written report and our responses.

**Spend.** Billable. No estimate exists; it depends on the engineer and days. Josh would need to
set a maximum and get a quote. Nothing is booked or spent without his yes. **Needs Josh:** whether
to do it and the cap (question 4).

## M156. Integration readiness

**Today (measured).** No hospital system link exists. A seam and a synthetic feed exist:
`integration/hospital-feed.ts` (read-only admissions, transfers and discharges, matched by record
number only) and `integration/hospital-feed-sim.ts` (invented messages, including a non-synthetic
number and a duplicate to show refusals). A person confirms each message; the feed changes no
record by itself.

**Approach.** A written integration contract: which system is the master for each field (open
decision 2, "clinical source of truth", tied to M26), how identifiers are matched and what happens
on no match or two matches, and how a failed or late feed shows on screen. Plus a failure-mode
list. Docs only; it lives in `docs/ward-flow/governance/`.

**Effort.** Medium. **Risk.** None to write; it records clinical and privacy choices that are
Josh's. **Needs Josh:** decision 2 before the contract is final.

---

## Questions for Josh

1. **Approve this plan and its order?** Recommendation: yes, starting with M142, M139 and M149
   (small, no behaviour change), and M140 as soon as the D-115 PRs merge.
2. **How should M142 get full history?** Recommendation: run the hotspot script in CI on `main`
   (no local network Git needed), and say yes to a one-off local full-history download only if CI
   is not convenient.
3. **Backend types (M144): stricter type-checked JavaScript or full TypeScript?** Recommendation:
   stricter type-checked JavaScript with shared Zod schemas. It reaches the same safety with a
   smaller, safer change.
4. **Before a pilot, which paid or owner-only steps do you want?** Recommendation: approve the
   free parts now (M154 draft report, M151 schema report, M156 contract draft); decide on an
   outside accessibility assessor (M154) and engineering reviewer (M155) once M139 and M144 are
   done, each with a quote and a maximum spend; decide the migration squash (M151) before real
   data.
5. **Unit-test time target (M150)?** Recommendation: each CI shard under 12 minutes on hosted
   runners, with no safety test removed or weakened.

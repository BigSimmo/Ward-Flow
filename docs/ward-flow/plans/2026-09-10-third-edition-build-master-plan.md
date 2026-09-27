# Ward Flow third edition — master build plan for the sixteen screens, the header and the rail

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/plans/README.md`.** Kept for history; do not follow.

> **For agentic workers:** REQUIRED SUB-SKILL: each owning chat runs its lane with
> superpowers:subagent-driven-development (fresh Sonnet implementer per task, Opus task reviewer,
> one Opus whole-lane review at the end). Steps use checkbox (`- [ ]`) syntax for tracking. Before
> building, each lane owner turns its section of this plan into a task-level plan of its own with
> superpowers:writing-plans, saved beside this file (path claimed in §3.4), because a master plan
> cannot carry the code for sixteen screens without becoming unreadable — and because the
> programme's proven pattern (2026-09-04 and 2026-09-05 plans under `docs/superpowers/plans/`) is one
> executable plan per screen group.

**Written 2026-09-10 by the design-review chat** (worktree `ward-flow-phase-5-resume-166ecb`, branch
`claude/wardflow-design-review-43df97`), at the owner's instruction, for Ward Lead to run with Ward
Builder, Ward Builder Two, Ward Builder Three and Ward Builder Four. **Plan of record for the phase
the owner named on 2026-09-10:** _"implement the behaviour of the new mockups, asking for
clarification rather than inferring"_ (`docs/ward-flow/WARD-LEAD-HANDOVER-2026-09-10.md` §11).

**Goal:** every one of the sixteen third-edition mockups becomes a working screen on its existing
route in the Ward Flow app, mounted in one shared third-edition shell (rail and one-row bar), reading
one state, showing one example data set, with every figure derived and every link between screens
real.

**Architecture:** one shared shell mounted once in the ward layout replaces the per-screen rail
mounts; one state facade over the existing reducer and seeds; four parallel screen lanes that own
disjoint component directories; an integration phase that proves the whole flows end to end.

**Tech stack:** Next.js 16 App Router, React 19, TypeScript 6 strict, CSS Modules, Vitest (unit and
DOM), Playwright (journeys), the third-edition kit harness (Playwright's Chromium) for the mockups.

**Spec:** the sixteen mockups `docs/ward-flow/mockups/*-third-edition.html` and the standard
`docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md` (third edition, Geist, 10 September rulings). The
plan argues from them; where this plan and a mockup disagree, the mockup wins; where a mockup and the
standard's never list disagree, the standard wins and the mockup is a defect to route to Ward Mockups.

---

## 0 · Read this before anything else

### 0.1 Every SHA here is a floor, measured 2026-09-10 evening — re-measure before acting

    ward master line   codex/task-ward-flow-live-state-20260831   911813e5f4  (moved twice while this was written)
    mockups source     claude/wardflow-design-review-43df97       fb7ef96b83
    read-only copy     D:/Worktrees/Database/readonly-plan-20260910   detached at 20eb850792 (one commit behind the tip; an ancestor)

🔴 **The master line does NOT yet carry the last three mockup commits** — `d523d5e3cd` (twelve shell
fixes on all pages), `aa985f8517` (bar one row at laptop widths), `fb7ef96b83` (checker evidence).
Measured: `git show <line>:docs/ward-flow/mockups/command-third-edition.html | grep -c accent-press`
prints `0` on `911813e5f4` and `>0` on `fb7ef96b83`. **Phase 0 folds them first.** Until then a
builder reading the mockups from the master line builds the wrong shell.

### 0.2 The five rules that have cost the most here, in one line each

1. **Ward Lead is the only chat that folds, by SHA, into the ward line — never `main`, never a
   push.** `docs/ward-flow/HOW-TO-FOLD-2026-09-10.md` §0–§2.
2. **Confirm the artefact, not the fold**: the requester names a grep that is unique to the new
   content; the folder runs it against `<line>:<path>`. HOW-TO-FOLD §2.
3. **One chat per worktree, exact paths only, never `git add -A`, never `git stash`.** The pre-commit
   hook reads the whole tree; two chats in one folder cannot commit at all
   (`C:/Users/joshs/.claude/worktree-ownership.md`, rule 1).
4. **Claim a defect in `docs/ward-flow/control/work-claims.md` before editing, claim a new path before
   creating it, and announce a document after writing it** (development-system §7 and §9).
5. **Sonnet implements, Opus reviews; every Sonnet brief ends "if you reach a decision this brief does
   not cover, stop and hand it back."** development-system §1.

### 0.3 What this plan is not

It is **not** a redesign of the model, the reducer or the referral front door; those are built and
ruled on. It is **not** permission to touch the seven owner questions in §6. It is **not** a mockup
programme: a mockup defect found while building goes to Ward Mockups (owner of
`docs/ward-flow/mockups/**`), never fixed by a builder.

---

## 1 · The foundation — built once, before any screen

### 1.1 What exists today (verified by reading the master line at 20eb850792)

| Layer        | Where                                                                                                                                                                                                                                                                   | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout       | `src/app/mockups/ward-flow/layout.tsx`                                                                                                                                                                                                                                  | Mounts `DeveloperAreaGate` → `WardFlowProvider` → `WardGround` → `WardChromeHeader` (sticky bar, owner's 2026-09-06 header) → `WardShellHeader` (place line) → route content                                                                                                                                                                                                                                                                                                                          |
| Rail         | `ClinicalRail` in `ward-management-navigation.tsx` (one component, three responsive shapes: phone bar + sheet, icon rail, labelled panel)                                                                                                                               | ⚠️ **Mounted by each screen, one mount per screen file** — a raw grep on 2026-09-10 gave 39 hits across 30 files, two of them comments; the figure has gone stale three times in the file's own history, so re-run `grep -rn "<ClinicalRail" src --include=*.tsx` rather than quote any number. Anything global there is global only by repetition. The rail's bottom block also carries `WardRoleSwitcher`, the developer-hub exit and `WardDemoControls` (clock +15 min / +1 hour, scenario, reset) |
| Bar          | `WardChromeHeader` (sticky row, 2026-09-06 owner header) with `WardChromeSearch` (one search box, scope chip by role), a tasks drawer (`ward-tasks-panel.tsx`) and the figures panel `WardStatsPanel`; `WardShellHeader` prints the place line                          | Both mounted once in `layout.tsx`. **No appearance (theme) control exists anywhere in the tree**                                                                                                                                                                                                                                                                                                                                                                                                      |
| Navigation   | `src/components/ward-management/ward-nav.ts`                                                                                                                                                                                                                            | `WARD_VIEWS` (six): Command, Network, Delays, Capacity, Movements, Governance. `WARD_NAV` (role and board groups): Statistics, All wards, All community teams, Ward — RPH Adult Secure, Ward board, Officer, Emergency department, Handover, Patient search, Search hub, Discharges, Referral board, New referral, Out of area. Everything else is named in `WARD_NAV_INTENTIONALLY_UNLISTED`, and `tests/ward-nav.test.ts` checks the three lists against the real route tree in both directions     |
| State        | `ward-flow-provider.tsx` (`WardFlowProvider`, `useWardFlow()` throws outside it), `ward-flow-reducer.ts` (3,819 lines; `wardFlowReducer`, `seedWardFlowStateAt`), `ward-flow-events.ts` (every event carries a `role`; `ADVANCE_CLOCK` is `demo`-only), `ward-clock.ts` | One reducer above every route; the domain state is **re-seeded on every mount and never persisted** (a reload wipes a demonstration — owner question D9-8, open); only `ADVANCE_CLOCK` moves the clock, plus a 30-second re-render for elapsed time; several dispatches share one instant. Existing href builders: `personHref`, `communityTeamHref`, `wardStatisticsHref`, `edStatisticsHref`, `serviceStatisticsHref`, `communityStatisticsHref`                                                    |
| Example data | `ward-patients-seed.ts`, `ward-admissions-seed.ts`                                                                                                                                                                                                                      | Eight named synthetic patient records plus admissions; the owner will replace every invented figure later (the changeable-data rule)                                                                                                                                                                                                                                                                                                                                                                  |
| Derivations  | `ward-referrals.ts`, `ward-catchment.ts`, `ward-referral-visibility.ts`, per-screen derivation modules under `capacity/`, `statistics/` …                                                                                                                               | Several figures already derived; A4 lists which ones and where two formulas disagree                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Routes       | 37 `page.tsx`/`layout.tsx` under `src/app/mockups/ward-flow/**`                                                                                                                                                                                                         | **All sixteen mockups already have a route** (table in §1.4). Twenty-one further routes have no third-edition mockup and keep their current build                                                                                                                                                                                                                                                                                                                                                     |
| Tests        | ~375 files matching `tests/*ward*`                                                                                                                                                                                                                                      | DOM, model, structural and twelve Playwright specs; the browser journeys are inert by default (`ci/ward-journeys-inert-by-default`)                                                                                                                                                                                                                                                                                                                                                                   |

### 1.2 Phase 0 — Ward Lead, before anyone builds (about one hour)

- [ ] **0.1 Fold the three mockup commits** `d523d5e3cd..fb7ef96b83` from
      `claude/wardflow-design-review-43df97` into the ward line. ⚠️ **Two live chats have edited
      `docs/ward-flow/mockups/**` today**: this branch, and Ward Mockups on `ward/mockups-20260910`
      (17 commits ahead of its base `da185a9197`, measured 2026-09-10). Run
      `git merge-tree --write-tree <line> fb7ef96b83` and the same against Ward Mockups' tip before
      folding either; a dirty tree is a real conflict on a byte-checked drawing and is resolved by
      Ward Mockups, never by picking a side. Artefact check:
      `git show <line>:docs/ward-flow/mockups/command-third-edition.html | grep -c accent-press` → `≥ 1`,
      and `git show <line>:docs/ward-flow/mockups/third-edition-kit/check-output.txt | grep -c "ALL GREEN"` → `18`.
- [ ] **0.2 Fold this plan** (commit named in the message that carried it) and confirm by
      `git show <line>:docs/ward-flow/plans/2026-09-10-third-edition-build-master-plan.md | grep -c "^## 0 · Read this before anything else"` → `1`.
- [ ] **0.3 Back up**: `env -u MSYS2_ARG_CONV_EXCL bash ~/.claude/scripts/backup-work.sh`, then read
      the tip out of the bundle (HOW-TO-FOLD §8). Never `git bundle verify` alone.
- [ ] **0.4 Put the owner questions of §7 to the owner in one message**, framed, not open, in the
      fixed shape of `docs/ward-flow/how-to-write-to-the-owner.md` (detail first, then the `Summary`
      block `DID / ISSUE / GAPS / NEED / RECOMMEND / NEXT`; one recommendation per question, never a
      menu). Record each answer in `docs/ward-flow/owner-decisions-2026-09-1x.md` (Ward Lead owns
      identity; nobody else numbers). Two chats asking him the same question got opposite answers on
      2026-09-10 — **only Ward Lead asks.**
- [ ] **0.5 Write each lane's starting message** (four lines: who/where, the one fact, what it
      changes, what is needed back) naming: the branch to cut from (the SHA after 0.1), the directories
      owned, the section of this plan, and the sentence _"if you reach a decision this brief does not
      cover, stop and hand it back."_

### 1.3 Phase 1 — the shell, the facade and the data set (Ward Lead's agents, one branch, about one day)

**Why one chat:** the shell change touches the layout and every screen file that mounts
`ClinicalRail`. Four lanes editing those files at once is four-way conflict on the same 27 files.
The mechanical sweep is Sonnet work; designing the facade is the one Opus veto here (a check whose
strength is the point, and a spec).

- [ ] **1.1 Third-edition shell components** — new directory `src/components/ward-management/shell/`:
      `ward-rail.tsx` (wordmark, rail links with live tallies, open/closed state remembered per
      standard §7.7, `--railw-closed: 84px`), `ward-bar.tsx` (the one-row bar: place, service, search
      with the fixed refusal sentences of §8.6, the three drawers Activity / Tasks / Tools as modal
      drawers with focus trap and Escape order per §7.6, theme control), `ward-live-region.tsx`
      (§7.4 announcements) and `ward-reconciliation-line.tsx` (§8.7: _"Synthetic snapshot at <time>,
      figures reconcile"_ derived from one check array the shell appends to and never creates).
      **Markup and behaviour are ported from `command-third-edition.html`'s shell script**, which every
      mockup shares verbatim (shell sweep 2026-09-10: 13 identical, 2 differ by an added comment).
      **The drawing has three things the app has never had** (A2a shared finding, verified by grep):
      a **Service** selector (All services, or one health service, scoping every figure on every
      screen — built over `Site.service`, held as shell state that Escape never clears, exposed to
      lanes as `serviceScope()` on the facade), the **Activity** drawer (the page's own tally and
      recent changes, from the same check array) and the **Tools** drawer. The bar's primary action
      comes from `WARD_PRIMARY_ACTIONS` in `ward-nav.ts` (one per route; the list is in §4's preamble),
      replacing the role-adaptive `roleAction()` link.
      **The controls the app has and the drawing does not — `WardRoleSwitcher`, the developer-hub
      exit, `WardDemoControls` (clock, scenario, reset) — move into the Tools drawer**, so nothing a
      demonstration needs is lost (ruling for this plan; the owner may move them, §7). The Appearance
      control of standard §7.5 is new to the app and comes from the mockups' appearance script.
      **Catcher:** `tests/ward-shell-third-edition.dom.test.tsx` (new, claim the path): rail link count
      equals `WARD_VIEWS` + the rail entries of `WARD_NAV` (and `tests/ward-nav.test.ts` keeps both lists
      honest against the route tree), Escape never clears the service, drawers trap focus, the
      reconciliation sentence is present exactly once per page, the demo controls are reachable from
      the Tools drawer, no text below 12px in the shell's CSS module.
- [ ] **1.2 Mount once** in `src/app/mockups/ward-flow/layout.tsx` in place of `WardChromeHeader` +
      `WardShellHeader`; keep `WardFlowProvider` and `WardGround` and their order. **Catcher:** the
      existing `tests/ui-ward-chrome-header.spec.ts` is retired or re-pointed **only by owner ruling**
      (it pins the 2026-09-06 header the owner approved; the third edition supersedes it — that is a
      question in §7, asked in Phase 0). Until answered, the new bar carries the same accessible
      names the old spec waits on, so the spec stays green.
- [ ] **1.3 Remove the per-screen `ClinicalRail` mounts** (Sonnet, mechanical, one commit per
      directory so a lane can bisect). **Catcher:** `grep -rn "<ClinicalRail" src --include=*.tsx | wc -l`
      → `0`, plus the DOM tests of each touched screen still pass (`npm run test:focused -- --files <files>`).
      Every screen — including the twenty-one without a mockup — now renders inside the new shell.
- [ ] **1.4 The state facade** — `src/components/ward-management/shell/ward-facade.ts`: one
      module exporting the read functions every lane uses for the **shell's** figures (beds available,
      open delays, open movements, referrals waiting, tasks) and the identifier helpers
      (`patientHref(id)`, `unitHref(id)`, `teamHref(id)`, `edHref(id)`, `movementHref(id)`) —
      re-exporting the builders that already exist (`personHref`, `communityTeamHref`,
      `wardStatisticsHref`, `edStatisticsHref`, `communityStatisticsHref`) rather than writing new
      ones — all wrapping the existing derivations named in A4 — **no new formula where one exists**. Lanes add
      screen-specific derivations in their own directories, never here. **Catcher:**
      `tests/ward-facade-agrees-with-screens.test.ts` (new): for each shell figure, the facade's number
      equals the number the owning screen renders, over the seed and over three mutated seeds.
- [ ] **1.5 The example data set** — extend `ward-patients-seed.ts` / `ward-admissions-seed.ts` (or add
      `ward-third-edition-seed.ts` beside them if the owner prefers the eight records untouched — §7
      question) so that every figure any of the sixteen mockups shows is **derivable**: the gaps A2a,
      A2b and A4 list (§6). Names follow standard §8.7 (an uncommon given name and a plant, bird or
      stone family name; family name first in lists). Every invented figure carries the marker the
      owner ruled on 2026-09-09 (_"the number should always carry that it's invented"_,
      `tests/ward-provenance-sentences-carry-their-own-marker.test.ts` is the pattern). **Catcher:**
      the seed tests (`tests/ward-admissions-seed.test.ts` pattern) assert the counts each mockup's
      tally shows, so a later edit that breaks a mockup's figure goes red by name.
- [ ] **1.6 Fold Phase 1** and message the four lanes the SHA. Lanes cut their branches from it.

### 1.4 The route table — every mockup already has a route

| #   | Mockup (file)                                                                          | Route today                                                  | Component directory              | Lane |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------- | ---- |
| 1   | Command (`command-third-edition.html`)                                                 | `/mockups/ward-flow`                                         | `coordinator/`, `hub/`           | A    |
| 2   | Delays (`delays-third-edition.html`)                                                   | `/mockups/ward-flow/delays`                                  | `delays/`                        | A    |
| 3   | Movement (`movement-third-edition.html`)                                               | `/mockups/ward-flow/movements`, `/movements/[movementId]`    | `movements/`, `tracker/`         | A    |
| 4   | Capacity (`capacity-third-edition.html`)                                               | `/mockups/ward-flow/capacity`                                | `capacity/`                      | A    |
| 5   | Ward (`ward-third-edition.html`)                                                       | `/mockups/ward-flow/ward/[unitId]`                           | `ward/`, `ward-table/`, `wards/` | B    |
| 6   | Bed board (`bed-board-third-edition.html`)                                             | `/mockups/ward-flow/board/[unitId]`                          | `board/`                         | B    |
| 7   | Emergency department (`emergency-department-third-edition.html`)                       | `/mockups/ward-flow/ed/[edId]`                               | `ed/`                            | B    |
| 8   | Community team (`community-team-third-edition.html`)                                   | `/mockups/ward-flow/community/[teamId]` (index `/community`) | `community/`                     | B    |
| 9   | Patient search (`patient-search-third-edition.html`)                                   | `/mockups/ward-flow/search`                                  | `search/`                        | C    |
| 10  | Patient Now (`patient-now-third-edition.html`)                                         | `/mockups/ward-flow/people/[patientId]`                      | `patients/`                      | C    |
| 11  | Search hub (`search-hub-third-edition.html`)                                           | `/mockups/ward-flow/hub`                                     | `hub/` (search parts)            | C    |
| 12  | Raise a referral (`raise-a-referral-third-edition.html`)                               | `/mockups/ward-flow/referrals/new`                           | `referrals/`                     | C    |
| 13  | Statistics (`statistics-third-edition.html`)                                           | `/mockups/ward-flow/statistics`, `/statistics/overview`      | `statistics/`                    | D    |
| 14  | Ward statistics (`statistics-ward-third-edition.html`)                                 | `/mockups/ward-flow/statistics/ward/[unitId]`                | `statistics/`                    | D    |
| 15  | Community team statistics (`statistics-community-third-edition.html`)                  | `/mockups/ward-flow/statistics/community/[teamId]`           | `statistics/`                    | D    |
| 16  | Emergency department statistics (`statistics-emergency-department-third-edition.html`) | `/mockups/ward-flow/statistics/ed/[edId]`                    | `statistics/`                    | D    |

⚠️ `hub/` appears in lanes A and C. **Ruling for this plan:** `hub/` belongs to lane C (Search hub);
Command's own components live in `coordinator/`. If Command imports anything from `hub/`, lane A
imports only from the folded line and never edits it.

**Routes with no third-edition mockup, unchanged in this phase except for the shell:** `/network`,
`/governance`, `/handover`, `/discharges`, `/out-of-area`, `/wards`, `/community` (index),
`/transport`, `/transport/officer`, `/referrals` (board), `/people/new`, `/queue`, `/morning`,
`/escalation`, `/exceptions`, `/constellation`, `/statistics/service/[serviceId]`,
`/statistics/compare`. Their DOM tests are the regression net for the shell change.

### 1.5 The wiring contracts

- **Identifiers:** patient `patientId` → `/people/[patientId]`; unit `unitId` → `/ward/[unitId]`,
  `/board/[unitId]`, `/statistics/ward/[unitId]`; team `teamId` → `/community/[teamId]`,
  `/statistics/community/[teamId]`; ED `edId` → `/ed/[edId]`, `/statistics/ed/[edId]`; movement
  `movementId` → `/movements/[movementId]`. All hrefs come from `ward-facade.ts`, never typed in a
  screen (`tests/ward-links-never-point-at-redirect-stubs.test.ts` and the route-prefix invariant are
  the existing catchers; the facade test in 1.4 is the new one).
- **Who links to whom (the minimum the mockups draw; A2a/A2b list the full set per screen):**
  Command → Delays, Movement, Capacity, a ward, an ED, a patient. Delays → a movement, a patient, a
  ward. Movement → a patient, a ward, an ED. Capacity → a ward, a bed board, Ward statistics. Ward →
  Bed board, Raise a referral, Ward statistics, a patient. Bed board → Ward, a patient. ED → Raise a
  referral, a patient, ED statistics. Community team → Raise a referral, a patient, Community team
  statistics. Patient search / Search hub → a patient, a ward, a team, an ED. Patient Now → the
  patient's movement, ward, team. Raise a referral → the patient (after submit), the referral board.
  Statistics → the three statistics pages; each statistics page → its operational page.
- **Raise a referral's query contract:** `/referrals/new?patientId=&source=ed|community|gp&originEdId=&teamId=`,
  built only by the facade's `raiseReferralHref({...})`; lane C reads it, lanes A and B write it
  through the shell's New referral menu and their own links.
- **Verdict and gates:** the movement workspace's verdict derivation is exported through the facade
  as `movementVerdict()` in Phase 1.4 so Patient Now (lane C) can read it without editing the
  shared console file.
- **State:** a screen reads through `useWardFlow()` and the facade; it never keeps a figure in local
  state that the reducer also holds. A screen dispatches only actions that already exist in
  `ward-flow-reducer.ts`; a new action is a stop-and-hand-back to Ward Lead.
- **Clock:** the reconciliation line prints the clock's time; nothing calls `Date.now()`.

---

## 2 · Delegation — four lanes, one folder each, no shared file

| Chat                                       | Worktree (measured `git worktree list`, 2026-09-10)                                   | Cut a fresh branch from the Phase 1 SHA                 | Owns (edit only these)                                                                                                                                                                                             | Order      |
| ------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| **Ward Lead**                              | `D:/Worktrees/Database/ward-lead` — the master line, one committer                    | commits directly on the line                            | Phase 0, Phase 1 (via its own agents in `D:/Worktrees/Database/ward-error-boundary` or `ward-uispec-repair`, both listed as Ward Lead's agent folders), `layout.tsx`, `shell/**`, seeds, `ward-nav.ts`, every fold | first      |
| **Ward Builder** (lane A)                  | `D:/Worktrees/Database/ward-builder` (FREE — citation repair folded 2026-09-10)       | `ward/lane-a-command-delays-movement-capacity-2026091x` | `coordinator/**`, `delays/**`, `movements/**`, `tracker/**`, `capacity/**`, their `tests/ward-{coordinator,delays,movement,capacity}*`                                                                             | after 1.6  |
| **Ward Builder Two** (lane B)              | `D:/Worktrees/Database/ward-builder-two` (statistics reword work complete and folded) | `ward/lane-b-ward-board-ed-community-2026091x`          | `ward/**`, `ward-table/**`, `wards/**`, `board/**`, `ed/**`, `community/**`, their tests                                                                                                                           | after 1.6  |
| **Ward Builder Three** (lane C)            | `D:/Worktrees/Database/ward-builder-three` (complete and folded 2026-09-10)           | `ward/lane-c-search-patient-referral-2026091x`          | `search/**`, `hub/**`, `patients/**`, `referrals/**`, their tests                                                                                                                                                  | after 1.6  |
| **Ward Builder Four** (lane D)             | `D:/Worktrees/Database/ward-builder-four` (FREE — marker guard folded)                | `ward/lane-d-statistics-2026091x`                       | `statistics/**`, `tests/ward-statistics*`                                                                                                                                                                          | after 1.6  |
| Ward Mockups                               | `D:/Worktrees/Database/ward-mockups`                                                  | its own                                                 | `docs/ward-flow/mockups/**`, `docs/ward-flow/design/prototypes/**` — **receives every mockup defect a builder finds**                                                                                              | throughout |
| Ward Verifier (if the owner keeps it open) | `D:/Worktrees/Database/ward-verifier-9afb82c6e`                                       | none — assesses, never builds                           | writes only its findings register                                                                                                                                                                                  | Phase 3    |

**Shared files nobody in a lane may edit:** `layout.tsx`, `ward-nav.ts`, `shell/**`, `ward-facade.ts`,
the seeds, `ward-model.ts`, `ward-flow-reducer.ts`, any `*.module.css` outside the lane's directories,
`docs/ward-flow/mockups/**`. A needed change there is a four-line message to Ward Lead, who makes it on
the line and announces the SHA. **Before the first edit each lane writes its `.ward-session.json`
marker at its worktree root, its row in `docs/ward-flow/assignment-register.md` ("claim before you
build"; never write _authorised_ in the status column — only the rulings table records the owner's
word), its one row in `docs/ward-flow/control/now.md`, and a row per defect in
`control/work-claims.md`** (claim the defect, not only the file). The content-addressed records under
`control/assignments/` and `control/handovers/` are created only by
`scripts/ward-flow/chat-control.mjs create-assignment` / `create-handover`, never by hand.

**Lane hand-in:** each lane hands Ward Lead one SHA per screen (not per task) plus an artefact grep,
in the four-line message shape. Ward Lead folds in the order the SHAs arrive; a fold message carries
what the lane believed but did not measure, what it withdrew, and what was NOT done (HOW-TO-FOLD §9).

---

## 3 · How every task is run

### 3.1 Inside a lane: subagent-driven development

1. The lane owner writes its task-level plan from its §4 section (superpowers:writing-plans), with
   the task-brief / report-file discipline of superpowers:subagent-driven-development, and saves it
   at the path claimed in §3.4.
2. Per task: fresh **Sonnet** implementer with the brief, the interfaces from §1.5 and the Global
   Constraints of §3.3 pasted in (never linked); **Opus** task reviewer with the diff package;
   fix loop of at most five rounds; the lane owner ledgers every ruling.
3. Per screen: one **Opus** whole-screen review against the mockup and standard §10 before the SHA
   goes to Ward Lead.
4. Model tiers are stated in every dispatch summary and every finding relayed to another chat
   (_"Sonnet, extraction"_ / _"Opus reviewer"_). An Opus dispatch on a task that qualified as Sonnet
   names the veto invoked.

### 3.2 The task shape (every task in every lane plan has these six lines)

    Files:      create / modify / test, exact paths
    Interfaces: consumes (facade functions, actions) / produces (exports later tasks rely on)
    Catcher:    the exact test or gate that goes red if this is wrong — an existing file, or the new test written FIRST
    Steps:      failing test → run it red → minimal implementation → run it green → prettier on the touched files → commit with explicit paths
    Not built:  the §7 items this screen touches, named
    Report:     proven by test / proven by looking / not proven — three lines, every time

### 3.3 Global constraints — paste into every brief

- **Tokens only.** No hex, no `color-mix`, no shadow inside a panel, no coloured bar on any edge, no
  top highlight, nothing under 12px in HTML (SVG text ≥ 10.5px), one primary action per panel
  (standard §2 and §13 never list; owner ruling 2026-09-09).
- **Words before colour.** Every state carries text; colour only reinforces a word already present
  (standard §8.1).
- **Absence and zero.** A missing value is shown and marked absent, never dropped; zero reads
  _none_ (§8.2). _"Renders as absent"_ means **shown and marked**, not **disappears**.
- **Invented and real.** Every synthetic number carries the invented-figure marker where it is read
  (owner, 2026-09-09); never _"Live"_, never _"reconciled with reality"_ — _"Synthetic snapshot at
  <time>, figures reconcile"_ is the sentence (§8.3, §8.7). A sentence must be true read alone.
- **Derived, never typed.** Every count, tile, line, tag and reconciliation line is computed from
  state on every render (§8.7). A literal figure in JSX is a defect.
- **Vocabulary rulings:** the third bed stage is _discharged_, never _released_ (2026-08-30);
  _Available_, never _Unoccupied_; a community patient is a team's by the explicit team on the
  referral, never by home area (2026-08-31); a team sees the decline reason for its own referrals only
  (`FD-23`); the six urgency reasons are the orchestrator's placeholders _"for now"_, never the
  owner's language; _legal authority_ reads _Yours_ and the wait bands are 8 and 24 hours
  (2026-09-08).
- **Clinical rulings that bind what a screen may do:** sex and gender are **two fields**; gender has
  two values, Female and Male, plus a distinct _not yet recorded_ state that is never defaulted from
  sex; **gender decides the bed**, and there is **no override path on that gate** (owner, 2026-09-10,
  `911813e5f4`, `owner-decisions-2026-09-09.md`). The system **never computes acuity** — the referring
  clinician marks it (`owner-decisions-2026-09-09.md:320`); whether beds are ordered by that mark is
  open (§7). **No forensic-unit exclusion** — there is no ruling, so `!unit.forensic` is not built
  (`assignment-register.md:32-49`). A bed-board placement action **prompts "confirm with the ward"**;
  the board is a convenience, not a source of truth (`clinician-check-rulings-2026-09-06.md:71-81`).
  _"It suggests nothing"_ is withdrawn — matching is allowed — but nothing beyond what a mockup draws
  is built here.
- **Escape never clears the service; drawers are modal; the rail's state is remembered** (§7.6,
  §7.7). Keyboard reach and visible focus on every control (§7.3, §9).
- **Eight widths, two themes, forced colours, print:** 1920, 1600, 1440, 1280, 1200, 1100, 390, 320,
  light and dark — nothing clipped, nothing overflowing (§5.7, §5.8, §7.5). Sample at least one width
  in the 641–1000px band; six of twelve ward specs never look there (handover 2026-09-10 §12).
- **The changeable-data rule:** the owner will replace every invented figure with real ones; nothing
  may be built that only works for the seed (`docs/ward-flow-changeable-data-rule.md` on the line).
- **Never `git add -A`; commit each coherent unit; prettier on touched files before every commit;
  `npm run format` is not trusted (it exited 0 having changed nothing on a tree with no binaries —
  handover §7); check `ls node_modules/.bin | wc -l` first.**
- **If you reach a decision this brief does not cover, stop and hand it back — do not choose.**

### 3.4 Paths claimed by this plan (development-system §7) — do not create from another chat

| Path                                                                                                                                      | For                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `docs/ward-flow/plans/2026-09-10-third-edition-build-master-plan.md`                                                                      | this file                           |
| `docs/ward-flow/plans/2026-09-1x-lane-a-command-delays-movement-capacity.md`                                                              | Ward Builder's task plan            |
| `docs/ward-flow/plans/2026-09-1x-lane-b-ward-board-ed-community.md`                                                                       | Ward Builder Two's task plan        |
| `docs/ward-flow/plans/2026-09-1x-lane-c-search-patient-referral.md`                                                                       | Ward Builder Three's task plan      |
| `docs/ward-flow/plans/2026-09-1x-lane-d-statistics.md`                                                                                    | Ward Builder Four's task plan       |
| `src/components/ward-management/shell/**`, `tests/ward-shell-third-edition.dom.test.tsx`, `tests/ward-facade-agrees-with-screens.test.ts` | Ward Lead, Phase 1                  |
| `docs/ward-flow/owner-decisions-2026-09-1x.md`                                                                                            | Ward Lead, Phase 0 (identity owner) |

---

---

## 4 · The sixteen screens — one section each

**How to read a section.** _Mockup_ is the spec. _App today_ is what the gap map (A2a, A2b —
Sonnet extraction, verified by reading source at `20eb850792`) found on the route. _Tasks_ are the
lane's task-level plan in outline: each becomes one task-brief with the six lines of §3.2; the
**catcher** named is the test or gate that reddens if the task is wrong. _Reads_ names the state and
facade functions. _Links_ names the wiring. _Done when_ adds the screen-specific lines to the general
definition of done in §5.0, at the end of the integration phase. _Not built_ names the owner
decisions the screen touches. **A panel the app has and the drawing does not is never dropped
silently and never kept silently: the lane lists it in its report and Ward Lead puts the whole list
to the owner as Q-12.**

**Two contracts every lane relies on (Ward Lead builds them in Phase 1):**

- `WARD_PRIMARY_ACTIONS` in `ward-nav.ts`: the bar's one primary action per route — Command,
  Delays, Capacity, Ward, Bed board, Emergency department: **New referral** (a menu of three
  sources that opens Raise a referral with `?source=ed|community|gp&originEdId=…`); Movement:
  **Record a decision**; Community team: **Contact a team**; Statistics pages: **Export the
  figures**; Patient search, Patient Now, Search hub, Raise a referral: none in the bar (their
  primary lives in a panel or is the form's own Send). A screen never renders a second primary.
- Query parameters on `/referrals/new`: `patientId`, `source`, `originEdId`, `teamId` — read by lane
  C, written by lanes A, B and C's own links; all built through the facade's `raiseReferralHref()`.

### 4.1 Command — lane A (Ward Builder)

- **Mockup** `command-third-edition.html`: bar primary New referral (three sources); Emergency
  department pressure strip → Priority queue with **Patients / Referrals** tabs → Statewide flow
  diagram → four-tab Exceptions, declines, overrides, refused actions → Explainable shortlist
  (candidates, eligibility gates, placement); tally Waiting in ED, Breached, Due within 2 hours,
  Longest wait, all derived.
- **App today** `/mockups/ward-flow` → `coordinator/coordinator-screen.tsx` (326 lines): pressure
  strip, priority queue (**patients only, no tabs**), flow diagram, the four-tab drawer already
  placed to the owner's ruling, shortlist panel (1,584 lines). Header primary is a "Referral board"
  link, not a source menu.
- **Tasks**
  1. Restyle the five existing panels onto the third-edition tokens and panel shape (§6.3) with no
     structural change; catcher: existing `tests/ward-coordinator*` DOM tests stay green,
     `ward-css-token-references-resolve` green, a new `tests/ward-command-third-edition.dom.test.tsx`
     asserts the five panel headings in mockup order.
  2. Add the **Referrals tab** to the priority queue, listing front-door `referrals` awaiting an
     answer, sorted by urgency then age, each row linking to Raise a referral's outcome or the
     addressed ward; catcher: the new DOM test renders both tabs from a seed with two referrals and
     asserts the tab counts equal `hubCounts`-style derivations from the facade (Phase 1.4).
  3. Tally: the four figures come from `ward-facade.ts` (`waitingInEd`, `breached`, `dueWithin2h`,
     `longestWait`), which wrap `edHomeTotals`/`worstEdSummary`; catcher: `ward-facade-agrees-with-screens`.
  4. The New referral menu is the shell's (Phase 1); Command adds nothing.
  5. Flow diagram: remove the ED-node side bars if Q-11 says so; keep the legend and node conventions
     of §6.14; catcher: the DOM test asserts every node carries a word for its state.
- **Reads** `movements`, `referrals`, `units`, `now`; `unitCapacity`, `capacityBreakdown`,
  `buildActionInbox`, the shortlist's existing eligibility derivations.
- **Links** out: Delays, Movement (row → `/movements/[id]`), Capacity, a ward, an ED, a patient
  (queue row → `/people/[id]`); in: the rail, every statistics page's "back to operations".
- **Done when** the Referrals tab count equals the ED screen's referral count for the same seed; the
  reconciliation line goes red when one tally is forced to disagree.
- **Not built:** ordering by acuity (Q-1); catchment as a filter (Q-2); any forensic exclusion.

### 4.2 Delays — lane A (Ward Builder)

- **Mockup** `delays-third-edition.html`: Who is holding people up → Waiting → What the blocker is
  (one blocker per person; awaiting a bed is not an ED blocker; medical clearance is not in the
  list) → Escalations / Resolved today tabs → Selected person → footer What is invented and what
  is real. Legal deadline sentences per §8.7.
- **App today** `/delays` → `delays/delays-screen.tsx` (1,178 lines): the same panels under
  different names (Who is waiting; Registers; The person you have chosen) plus two the drawing lacks
  (Worth your attention; Delays with no named person). Links to Ward.
- **Tasks**
  1. Rename the panels to the drawing's words and reorder to its order; catcher: the existing
     `tests/ward-delays-*` wording pins (re-derive, never delete) and a new heading-order assertion.
  2. Wire the legal deadline sentence to `legalDeadlineMinutes` (`delays-derivations.ts:273`, a
     derivation with no reader today, I-8); catcher: a DOM test with one movement past its deadline
     asserts _Legal deadline passed 1h 10m ago_ from one formatter, and one with none asserts
     _No deadline recorded_.
  3. Footer panel What is invented and what is real, with the marker sentence; catcher: the marker
     test's reach extended to this file (Phase 3.4).
  4. The two app-only panels go to Q-12 with a recommendation: fold "Delays with no named person"
     into Waiting as a group headed by that sentence; move "Worth your attention" into the Activity
     drawer.
- **Reads** `movements`, `units`, `now`; `delayGroups`, `waitingSplit`, `unclearedCount`,
  `legalDeadlineMinutes`.
- **Links** out: a movement, a patient, a ward; in: Command, the rail.
- **Done when** the four tally figures the drawing names as its own are derived and the standard's
  index gains a Delays entry (Q-10, Ward Mockups) — the lane does not wait for the index.
- **Not built:** nothing owner-gated beyond Q-12.

### 4.3 Movement — lane A (Ward Builder)

- **Mockup** `movement-third-edition.html`: bar primary **Record a decision**; The day, and what is
  severe in it → Today's traffic (corridors diagram) → Open movements, "why each is still open" →
  five tabs (Where each stands / Transport legs and what has none / How long they have waited /
  Resolved today / No owner) → footer What reconciles; per-movement **Detail as a drawer** on the
  list (Person, Journey, Which wards were asked, Escalation, Transport leg, What you can do, Watch
  and flag).
- **App today** `/movements` → `movements/movements-screen.tsx` (377 lines) with four panels and an
  inline reconciliation sentence; **no corridors diagram, no tabs, no Record a decision**;
  `/movements/[movementId]` → the 2,832-line coordinator workspace as a separate page.
- **Tasks**
  1. Restyle and rename the list panels; build the five tabs (§6.5, tabs with counts) over the
     existing `journeyStages`/`transportLegs`/`transportCounts`; catcher: a new
     `tests/ward-movement-third-edition.dom.test.tsx` asserts each tab's count equals the derivation
     over the seed, and that the sum of the five reconciles with the open count in words.
  2. **Today's traffic**: a new derivation `corridorCounts(movements)` in `movements/` (origin ED →
     accepted unit, counted by stage) rendered as the diagram of §6.14 with a stated scale; catcher:
     a unit test over three hand-built movements, proved by mutation.
  3. **What reconciles** as a footer panel: `50 moves` at the top and `43 open` at the bottom are
     reconciled in one sentence naming the six arrived and one did-not-proceed (I-20); catcher: the
     DOM test asserts the sentence's numbers sum.
  4. **Detail drawer** (§7.6, modal): opened from any row, showing the seven sections as a summary
     built from the movement record, with one link _Open the workspace_ to `/movements/[id]`
     (Q-4 keeps the route); catcher: the DOM test opens the drawer by keyboard, asserts focus is
     trapped and Escape closes it without clearing the service.
  5. **Record a decision** (the bar's primary): opens the drawer at "What you can do" for the
     selected movement, whose buttons dispatch only existing events (`ACCEPT_IN_PRINCIPLE`,
     `DECLINE`, `BOOK_TRANSPORT`, `RECORD_MOVEMENT_BLOCKER`…); catcher: `ward-event-reachability`
     stays green; a DOM test dispatches one and asserts the list re-renders.
- **Reads** `movements`, `units`, `now`; the movements derivations; `buildActionInbox`.
- **Links** out: a patient, a ward, an ED, the workspace; in: Command, Delays, Patient Now.
- **Done when** every tab count, the corridor totals and the open count agree and the reconciliation
  line says so.
- **Not built:** a second movement-detail page; any new reducer event.

### 4.4 Capacity — lane A (Ward Builder)

- **Mockup** `capacity-third-edition.html`: Bed map → Network summary and ward detail (side) → Where
  the mismatch is → Wards → footer Every figure here is invented / What is real / Reconciled to
  Command. Bar primary New referral (the standard's §14 row saying "Hold a bed" is stale — Q-10 to
  Ward Mockups).
- **App today** `/capacity` → `capacity/capacity-screen.tsx` (1,052 lines): Bed map, Where the
  mismatch is (exact), Every ward in the network, plus Ready now, Worth your attention, Beds freeing
  today.
- **Tasks**
  1. Restyle; rename Every ward in the network → Wards; move the side panel into the drawing's
     place; catcher: `tests/ward-capacity-*` (fifteen files; the derivation-agreement and
     one-word-figure tests are the ones that bite) all green plus a new heading-order assertion.
  2. Footer disclosure panel with the marker and the sentence _Reconciled to Command_ **derived**:
     the same `unitCapacity` sums Command prints, compared in the check array; catcher:
     `ward-facade-agrees-with-screens` for beds available.
  3. Q-12 list: Ready now, Worth your attention, Beds freeing today (recommendation: keep Ready now
     as the first row of the side panel; the other two go to the Activity drawer).
- **Reads** `units`, `bedReleases`, `leaveBeds`, `movements`, `now`; `unitCapacity`,
  `capacityBreakdown`, `networkTotals`, `bedKindGaps`.
- **Links** out: a ward, its bed board, Ward statistics; in: Command, ED (statewide capacity).
- **Done when** _Available_ is the only word for a free bed on the screen (never _Unoccupied_), and
  every bed-map tile carries its state as text.
- **Not built:** "Hold a bed" (no such action in the drawing or the app).

### 4.5 Ward — lane B (Ward Builder Two)

- **Mockup** `ward-third-edition.html`: h1 stays **Ward**; the ward's name is the h3 of the first
  panel This ward; Ward figures, right now (Worth your attention, Coming in, Beds on the way out,
  Awaiting your answer) → Today's return → Every bed on this ward → The record for today → Where to
  refer → Print the handover sheet.
- **App today** `/ward/[unitId]` → `ward/ward-screen.tsx` (2,352 lines): h1 is the ward's name;
  Confirm today's numbers, Bed capacity, Incoming referrals awaiting an answer, Accepted, pulled or
  en route here, Withdrawn from {ward}, Overrides recorded against {ward}.
- **Tasks**
  1. Heading contract: on-screen h1 _Ward_, ward name in This ward, **document title** _Ward — {name}_
     (§15.1); catcher: the existing `tests/ward-screen*` pins re-derived, a DOM test asserting the
     title and the h3.
  2. Rename and regroup the panels to the drawing (Ward figures, right now with its four
     sub-panels; Today's return; Every bed on this ward; The record for today; Where to refer);
     catcher: the DOM test asserts order and that each sub-panel's count equals `capacityBreakdown`
     / the referral derivations.
  3. Print the handover sheet → link to `/handover` (existing printable page) with `?unitId=`;
     handover scoping to one ward is Q-12 (recommendation: scope it); catcher: link resolves
     (`ward-links-never-point-at-redirect-stubs`).
  4. Withdrawn from {ward} → Q-12 (recommendation: a group inside The record for today).
- **Reads** `units`, `admissions`, `bedReleases`, `leaveBeds`, `referrals`, `movements`, `now`;
  `unitCapacity`, `capacityBreakdown`, the referral-visibility rules (`ward-referral-visibility.ts`,
  FD-23: a ward never sees where else its patient went).
- **Links** out: Bed board, Raise a referral, Ward statistics, a patient; in: Capacity, Delays,
  Search hub, All wards.
- **Done when** Where to refer shows all four catchment lookup states in words, including the two
  that refuse one answer (built 2026-09-05, keep), and the print route is reachable by keyboard.
- **Not built:** catchment as a filter (Q-2); acuity anywhere; a roster, ward round or meeting (the
  model holds none).

### 4.6 Bed board — lane B (Ward Builder Two)

- **Mockup** `bed-board-third-edition.html`: h1 Bed board, ward name h2; Needs you this shift →
  Every bed, and who is in it → Either side of this ward → The bed you have chosen (dynamic). The
  drawing's own footer closes the "beds cannot link to a person" worry (`Admission.referralId`,
  `Referral.patientId` exist) and states that Aboriginal or Torres Strait Islander status and
  interpreter language are **deliberately not drawn** pending the Aboriginal health review.
- **App today** `/board/[unitId]` → `board/ward-board.tsx` (1,981 lines): near match under other
  names (Needs a look this shift; Coming in / Going out today / Since yesterday; Who is in this bed;
  Where these beds free up to).
- **Tasks**
  1. Rename to the drawing; fold Coming in / Going out today / Since yesterday under Either side of
     this ward as three groups; catcher: `tests/ward-board-*` (nine files) re-derived; a DOM test for
     the new order.
  2. Bed tiles (§6.4 bed chips): state as a word on every tile; _discharged_ never _released_;
     catcher: `tests/ward-board-tile-labels-distinct.dom.test.tsx` and `ward-pull-vocabulary` stay
     green — never convert the latter.
  3. Placement from the board prompts **Confirm with the ward** before dispatch (owner, 2026-09-06);
     catcher: a DOM test that the dispatch does not fire until confirmed.
  4. Repair the two test defects in this lane's files (I-14): delete the dead literal at
     `ward-ed-psychiatry-hub.dom.test.tsx:1687`; re-point the two `ward-board-fixed-note` absence
     assertions at the real frozen-board note with a positive control; catcher: the positive control
     reddens when the note is removed (mutation).
- **Reads** `units`, `admissions`, `bedReleases`, `leaveBeds`, `patients`, `now`; `unitCapacity`,
  `capacityBreakdown`, `headlineAvailable`, `acceptingBedCounts`, `sinceYesterday`.
- **Links** out: Ward, a patient, a movement; in: Ward, Capacity, Search hub.
- **Done when** every occupied tile resolves to a person through admission → referral → patient, and
  a tile whose chain breaks says _record not linked_ rather than disappearing.
- **Not built:** the two withheld fields; any acuity mark on a tile.

### 4.7 Emergency department — lane B (Ward Builder Two)

- **Mockup** `emergency-department-third-edition.html`: one filterable **board** of the department's
  people with status chips (Everyone / Not reviewed / Under a form / No destination / For discharge
  …), Seen in the last twenty four hours, the network list of departments, an empty state _No
  emergency department is drawn here_, footer What is invented and what is real; a person opens a
  **modal dialog** (Where they are up to / Handover / The journey the record holds). Bar primary New
  referral.
- **App today** `/ed/[edId]` → `ed/ed-screen.tsx` (2,654 lines, the largest component): five
  headed sections (Expects; Referrals; Recently answered; Psychiatry outbox; This department's
  patients) plus an inline Raise a referral form and Statewide capacity (read-only).
- **Tasks**
  1. Build the board list with chips over the existing five populations: Expects (owner concept
     2026-09-07: addressed but not physically present) becomes the chip _Expected, not yet here_;
     the others map to the drawing's chips; catcher: a new
     `tests/ward-ed-third-edition.dom.test.tsx` asserts every chip count equals the population
     derivation and the chips sum to Everyone.
  2. Person dialog (§7.6 modal) with the three sections built from the movement and referral
     records; catcher: keyboard open/close, focus trap, Escape order.
  3. The inline referral form is replaced by the bar's New referral (source ED, `originEdId`
     prefilled) — a route change, not a loss; catcher: `ui-ward-referrals.spec.ts` re-pointed (not
     skipped) and the link test.
  4. Q-12 list: Psychiatry outbox; Statewide capacity (read-only); Recently answered as a section
     (recommendation: outbox becomes the Activity drawer's ED view; capacity becomes one line linking
     to Capacity; Recently answered is the drawing's Seen in the last twenty four hours).
- **Reads** `movements`, `referrals`, `units`, `now`; `edHomeSummaries`, `worstEdSummary`,
  `unitCapacity` (read-only capacity line).
- **Links** out: Raise a referral, a patient, ED statistics, Capacity; in: Command, the rail's
  Emergency departments.
- **Done when** the board's Everyone count equals Command's Waiting in ED for that department, and
  the empty state renders when the route names no department.
- **Not built:** any triage or acuity computation; medical clearance as a blocker.

### 4.8 Community team — lane B (Ward Builder Two)

- **Mockup** `community-team-third-edition.html`: bar primary **Contact a team**; standing sentence →
  Waiting for the team's answer → Worth attention → In a bed or holding one → Admitted while already
  with the team → Discharged into the catchment → This team (catchment, hours, contacts).
- **App today** `/community/[teamId]` → `community/community-screen.tsx` (1,457 lines): near match
  under other names plus Expected back and Left the ward another way; the aside carries the team
  facts including the honest state _Not derivable from the catchment table_ for suburbs.
- **Tasks**
  1. Rename to the drawing's words; keep the honest suburb state; catcher: `tests/ward-community-*`
     (twenty-plus files; the decline-reason and membership-resolution tests are the ones that bite)
     re-derived; a DOM test for order.
  2. Contact a team: the bar's primary opens the This team contacts (placeholders in the shape of the
     real thing, ext 11 onward, addresses ending `example.invalid`, said twice — §8.7); catcher: a
     DOM test that no digit string of phone-number length appears outside the placeholder pattern.
  3. Membership by the **explicit team on the referral** only (owner 2026-08-31); decline reasons
     visible for this team's own referrals only (FD-23); catcher: `ward-community-membership-resolution`
     and `ward-community-corrected-claims` stay green; depends on the seed fix I-6 (Phase 1.5).
  4. Q-12 list: Expected back; Left the ward another way (recommendation: groups inside Discharged
     into the catchment).
- **Reads** `referrals`, `admissions`, `movements`, `now`; `admissionBelongsToTeam`, the
  community derivations; **one** team list (Q-5).
- **Links** out: Raise a referral (`teamId`), a patient, Community team statistics, the community
  index; in: Search hub, Command's Referrals tab, All community teams.
- **Done when** the page is non-empty for every seeded team after I-6, and a team with no referrals
  says so in words.
- **Not built:** membership by home area; transport arranged from here beyond what the app does
  today (owner: a community team can arrange transport — already applied, not widened).

### 4.9 Patient search — lane C (Ward Builder Three)

- **Mockup** `patient-search-third-edition.html`: Results → Search (kinds tabs, facets) → Selected
  person (stage stepper; primary in-panel **Open the movement**) → Access record; three refusal
  kinds; the results footer uses the §8.6 sentence (the refusal panel's three bespoke sentences do
  not — a mockup defect for Ward Mockups).
- **App today** `/search` → `search/patient-search.tsx` (668 lines): a real search over people,
  referrals and movements with two selects and live counts; `RecordPreview` side panel; links to
  `/people/[id]` and `/movements/[id]`; no facets beyond two selects, no refusal panel, no access
  record.
- **Tasks**
  1. Kinds tabs and facets (§6.7 filter bar) over the existing derivations; catcher:
     `tests/ward-patient-search*` re-derived; a DOM test asserting each facet count.
  2. What this search refuses as a panel using **the §8.6 sentences verbatim**; catcher: a DOM test
     pins the two sentences; the mockup's wording defect is routed to Ward Mockups, not copied.
  3. Selected person panel with the stage stepper (§6.11) and Open the movement (real link);
     catcher: `record-preview` tests plus a link test.
  4. Access record: a session-only list of searches (role, words, when) kept in component state,
     labelled _Kept for this session only, not a record of anything real_; catcher: a DOM test that
     three searches produce three rows and a reload produces none (no persistence).
- **Reads** `patients`, `referrals`, `movements`, `units`, `now`.
- **Links** out: a patient (Patient Now), a movement, a ward, an ED, a team; in: the rail, Search hub,
  Command.
- **Done when** a refused search shows the fixed sentence and no result; a zero result reads _none_.
- **Not built:** persistence of the access record; any search across a person's history beyond what
  the model links (see 4.10).

### 4.10 Patient Now — lane C (Ward Builder Three)

- **Mockup** `patient-now-third-edition.html`: The person now (identity, tier, wait, legal status,
  needs, owner, **verdict and gates**) and Journey; tabs Now / History / Community / Details /
  Documents; Copy handover summary (works); Coordinator / Ward view toggle (works); records keyed by
  movement in the drawing.
- **App today** no single match: `/people/[patientId]` → `patients/person-screen.tsx` (297 lines:
  Who this is, Placement details, Refer Patient) and the movement workspace, which alone carries the
  verdict and gates. **Ruling (Q-4, recommended):** Patient Now is the person page; it shows the
  person's _current_ movement inside it.
- **Tasks**
  1. Ward Lead exports the workspace's verdict/gates derivation through the facade in Phase 1.4
     (`movementVerdict(movement, units, …)`), because the workspace file is shared; lane C imports
     it and never edits the console. Catcher: `ward-facade-agrees-with-screens` gains a verdict case.
  2. The person now: identity from `Patient` (the nine optional fields render as stated absences
     when unset — `not yet recorded`, never blank); the current movement found through
     `referrals.patientId → movement.referralId`; gender shown as its own field with the
     not-yet-recorded state (owner 2026-09-10); catcher: a new
     `tests/ward-patient-now.dom.test.tsx` renders a seeded person with and without a movement.
  3. Journey from the movement's `stageChanges`, `statusChanges`, `declines`, `transport` in time
     order, one formatter for waits; catcher: the DOM test asserts order and wording.
  4. Tabs: Now; History (every movement reachable through the person's referrals — possible only for
     front-door referrals, so the tab states its limit in words); Community (the explicit team on
     the referral, else _No team named on the referral_); Details (the patient fields); Documents
     (_No documents are held in this prototype_ — a stated absence, never an invented list);
     catcher: the DOM test asserts each tab's empty wording.
  5. Copy handover summary (clipboard, text built from the same derivations) and the Coordinator /
     Ward toggle (hides the fields a ward may not see per FD-23); catcher: a DOM test asserts the
     copied text equals the rendered summary and the ward view omits the other-ward fields.
- **Reads** `patients`, `referrals`, `movements`, `admissions`, `units`, `now`; the facade's
  verdict, `capacityBreakdown` for the held bed.
- **Links** out: the movement workspace, the ward, the team, Raise a referral (`patientId`); in:
  Patient search, Search hub, Command, Bed board tiles, Movement rows.
- **Done when** a person with no movement renders every panel with words and no verdict; the Ward
  view never shows where else the person was referred.
- **Not built:** a second person route; history for movements the model cannot link (stated, not
  invented); acuity.

### 4.11 Search hub — lane C (Ward Builder Three)

- **Mockup** `search-hub-third-edition.html`: The network (worst first by fewest beds ready) → At a
  glance (overview or per-item detail) → real/invented footer; its own place search.
- **App today** `/hub` → `hub/hub-screen.tsx` (924 lines) + `hub-derivations.ts`: the closest match
  of the sixteen, with an added Design decisions footer recording four claims in the drawing that
  failed a data check (already corrected in the app — keep the corrections; route the four to Ward
  Mockups).
- **Tasks**
  1. Restyle on the third edition; keep structure; catcher: `tests/ward-hub*` re-derived.
  2. Per-item links: ward → Ward, ED → Emergency department, team → Community team (the index only
     where the drawing says so), plus a second link to each item's statistics page; catcher: link
     test; a DOM test that every row has both.
  3. The place search in the bar is the shell's (Phase 1); the hub's own search is the drawing's —
     keep one search on the page (§2 never list: no second scope control), the hub's; catcher: the
     shell test asserts the bar search is suppressed on this route by the route table.
- **Reads** `units`, `movements`, `referrals`, `bedReleases`, `now`; `hubCounts`, `readyByService`,
  `networkBeds`.
- **Links** out: everything; in: the rail, Patient search.
- **Done when** the worst-first order equals `readyByService` and the footer's four corrected claims
  stay corrected.
- **Not built:** pins or "recently viewed" beyond the existing browser memory (Q-12, recommendation:
  keep the existing).

### 4.12 Raise a referral — lane C (Ward Builder Three)

- **Mockup** `raise-a-referral-third-edition.html`: The person (fixed) → Step 1 Who the referral is
  about (read-only facts) → Step 2 What they need (source, urgency, origin site; three Yes/No
  toggles) → Step 3 The history (**three prose blocks**, one required) → Where to refer (three
  destinations) → What will be sent / What follows / What sending does → **Send referral**
  (disabled until valid); the duplicate check is one inline sentence in The person. The standard's
  §14 row says "Submit the referral" — stale, both drawing and app say Send referral.
- **App today** `/referrals/new` → `referrals/referral-intake.tsx` (1,888 lines): a **real** form
  with a real submit, patient-id validation from `?patientId=`, the same three toggles, origin site
  validated (ahead of the drawing), one collapsed history box, no duplicate check.
- **Tasks**
  1. Restyle to the third edition's stepper (§6.11) and controls (§6.13) without changing the
     validation; catcher: `tests/ward-referral-screens.dom.test.tsx`, `ward-referral-matching`,
     `ward-seed-reaches-every-branch` all green; the 641px column defect (I-15) is re-run.
  2. Read `source`, `originEdId`, `teamId` from the query and prefill; catcher: a DOM test per
     source.
  3. **Duplicate check**: one sentence in The person when an open movement or an open referral
     already exists for this `patientId` (`Referral.patientId` makes it possible; nothing queries it
     today); never a "did you mean" about a record number; catcher: a DOM test with and without a
     duplicate, proved by mutation.
  4. The history: **one** optional, labelled story field, last, never feeding eligibility (owner
     2026-08-30) — the drawing's three blocks with a required one are a **Q-13** for the owner; until
     answered the ruling stands and the lane builds one field. Catcher: a DOM test asserts one
     free-text field and that eligibility ignores it.
  5. Gender on the form: shows what the profile holds; the clinician completes it if not yet
     recorded; never defaulted from sex (owner 2026-09-10); catcher: a DOM test with an unrecorded
     gender.
- **Reads** `patients`, `referrals`, `movements`, `units`, `now`; dispatches `RECEIVE_REFERRAL` only.
- **Links** out: the patient (after send), the referral board; in: every New referral menu, Patient
  Now, ED, Community team, Ward.
- **Done when** Send is disabled until valid and says why (§6.13), sending creates one referral that
  appears on Command's Referrals tab and the addressed screens, and the duplicate sentence is true
  read alone.
- **Not built:** three history fields (Q-13); catchment narrowing of Where to refer (Q-2); any
  eligibility reading the story field.

### 4.13 Statistics — lane D (Ward Builder Four)

- **Mockup** `statistics-third-edition.html`: Across all services (headline band, primary **Export
  the figures**) → Flow over time (14-day admissions and discharges chart) → Where the pressure is
  (ward table) → Emergency departments (table) → Community teams (table) → Referrals for a bed
  (band); real links to the three sub-pages. The drawing's Referrals today figure is a literal (a
  drawing defect, not to be copied).
- **App today** `/statistics` → `statistics/statistics-screen.tsx` (1,034 lines): the section's
  index with funnels and choosers; `/statistics/overview` (462 lines) a partial whole-of-prototype
  page; no chart, no per-entity tables, no Export.
- **Tasks**
  1. `/statistics` becomes the drawing: headline band from `pullToArrival`, `referralToBedJoin`,
     `wardStatistics`; catcher: `tests/ward-statistics.dom.test.tsx` (41 sites, all measured on both
     arms on 2026-09-10) re-derived — every wording pin re-derived, none deleted.
  2. Flow over time: a new derivation `dailyFlow(admissions, days)` (pulledAt / arrivedAt / leftAt
     exist) rendered per §6.17 with a stated scale and axis; catcher: a unit test over hand-built
     admissions, proved by mutation; the DOM test asserts the scale text.
  3. Three tables (wards, EDs, teams) each row linking to its sub-page through
     `wardStatisticsHref` / `edStatisticsHref` / `communityStatisticsHref`; catcher: the link test.
  4. Referrals for a bed derived from `referrals` (never a literal); catcher: the DOM test over a
     seed with a known count.
  5. Export the figures: downloads a CSV whose rows are the rendered figures; catcher: a DOM test
     that the CSV text equals the rendered numbers.
  6. Q-12: `/statistics/overview`'s funnels (recommendation: keep as a panel _What is happening to
     patients_ at the foot).
- **Reads** `admissions`, `referrals`, `movements`, `units`, `now`; the statistics derivations.
- **Links** out: the three sub-pages, Compare, Service statistics; in: the rail, every statistics
  sub-page.
- **Done when** every figure on the page carries the invented-figure marker where it is read, and the
  tables' totals equal the headline band.
- **Not built:** any figure the model cannot derive (stated absence instead).

### 4.14 Ward statistics — lane D (Ward Builder Four)

- **Mockup** `statistics-ward-third-edition.html`: one ward drawn (an inert switcher that says so);
  Beds now → Occupancy over the window → Length of stay → Admissions and discharges → Discharge
  planning → Clinically ready, not yet gone → Referrals into this ward → Long stays.
- **App today** `/statistics/ward/[unitId]` → `statistics-ward-screen.tsx` (628 lines): serves
  every ward with an honest not-found; most panels present under other names; no flow chart; no
  Referrals into this ward.
- **Tasks**
  1. Restyle and rename to the drawing; the switcher becomes the **real** ward switcher of §6.18
     (the app exceeds the drawing — keep the capability); catcher: existing tests re-derived; a DOM
     test switching to a second ward.
  2. Admissions and discharges chart from `dailyFlow` filtered to the unit (task 4.13.2's
     derivation, same module); catcher: the unit test's per-unit case.
  3. Referrals into this ward from `referrals` whose destinations name the unit (the destination kind
     `psychiatric_ward`; confirm the field by reading `ward-model.ts:1298-1413`, hand back if the
     unit id is not there); catcher: a DOM test with two referrals to the unit and one elsewhere.
- **Reads** `admissions`, `referrals`, `units`, `bedReleases`, `now`; `wardStatistics`,
  `unitCapacity`, `blockedDischargesByReason`.
- **Links** out: Ward, Bed board, Statistics; in: Statistics, Capacity, Ward.
- **Done when** _Available_ never _Unoccupied_; every average states its population (_over 12
  admissions_) beside it, and a population under five hides the median (owner 2026-08-31).
- **Not built:** anything acuity-related; occupancy predictions.

### 4.15 Community team statistics — lane D (Ward Builder Four)

- **Mockup** `statistics-community-third-edition.html`: one team drawn, no switcher; Caseload (and
  case age) → Referrals into the team → Where referrals came from → Discharges into this team's care
  → Time to first contact → Contacts → People currently in a hospital bed.
- **App today** `/statistics/community/[teamId]` → `statistics-community-screen.tsx` (245 lines):
  serves every team; This team, in figures; Where this team sits (a comparison the drawing lacks);
  What this page cannot see.
- **Tasks**
  1. Restyle; add the real team switcher (§6.18); catcher: a DOM test switching teams.
  2. Caseload, referrals in, sources, discharges into care, people currently in a bed — all from
     `referrals` and `admissionBelongsToTeam` (depends on I-6); catcher: a DOM test over the seed
     asserts non-zero for a seeded team and _none_ for an empty one.
  3. Time to first contact and Contacts: **the model holds no contact records** — render the panels
     with the stated absence _Contacts are not recorded in this prototype_ (never an invented
     series); catcher: the DOM test pins the sentence; the marker test covers it.
  4. Q-12: Where this team sits (recommendation: keep, last).
- **Reads** `referrals`, `admissions`, `movements`, `now`; the community derivations; one team list
  (Q-5).
- **Links** out: Community team, Statistics; in: Statistics, Community team.
- **Done when** the page names its team list's provenance (invented until replaced) and hides any
  median under five cases.
- **Not built:** contact figures; catchment inference.

### 4.16 Emergency department statistics — lane D (Ward Builder Four)

- **Mockup** `statistics-emergency-department-third-edition.html`: a **working** department
  switcher (All departments plus eight); summary tiles → Wait time, band by band (five bands, under
  4h to over 24h) → Waiting now (longest first) → Wait time over the last 30 days (or an explicit
  _not drawn_ state) → outcomes → Comparison across departments.
- **App today** `/statistics/ed/[edId]` → `statistics-ed-screen.tsx` (634 lines): per-department
  route; On the list / Marked urgent / No ward yet; waits by 24h / 48h / longest; declines split; the
  comparison lives at `/statistics/compare` with wards too.
- **Tasks**
  1. Switcher of §6.18 over the eight EDs plus All departments (route stays per id; All is
     `/statistics/ed/all` or the overview — hand back if the route table needs a new entry, Ward
     Lead's file); catcher: `ward-nav.test.ts` green.
  2. Wait bands: five bands from open movements' `openedAt` against `now`, named with the owner's
     8/24-hour bands where they coincide (2026-09-08 ruling on the Delays bands — do not invent a
     conflicting band edge; hand back if the drawing's edges conflict); catcher: a unit test proved by
     mutation.
  3. Waiting now list (longest first) linking to Patient Now and the movement; catcher: link test and
     order assertion.
  4. 30-day trend: the seed holds no 30-day history (30 routine movements over 300 minutes) — render
     the drawing's own _not drawn_ state with the reason; catcher: the DOM test pins the sentence.
  5. Comparison across departments: render the ED table of `/statistics/compare` inline under that
     heading and link to Compare for wards (Q-12 records the placement choice); catcher: a DOM test
     that the inline table equals Compare's for the same seed.
- **Reads** `movements`, `referrals`, `units`, `now`; `edHomeSummaries`, `declinesByReason`.
- **Links** out: Emergency department, Statistics, Compare; in: Statistics, Emergency department.
- **Done when** every band carries its edges as text, the bands sum to the waiting count, and the
  trend panel is honest about the seed.
- **Not built:** a 30-day series from invented history; acuity.

---

## 5 · The integration phase — Phase 3, after all four lanes have folded (Ward Lead, one day)

Sixteen screens built in four lanes agree with each other only if something checks that they do.
Phase 3 is that check, and it is run by the one chat that can see all of them.

- [ ] **3.1 One figure, one number.** `tests/ward-facade-agrees-with-screens.test.ts` (Phase 1.4)
      is extended to every figure that appears on two screens: beds available (Command, Capacity,
      Ward, Bed board, ED shortlist, rail tally), open delays (Command, Delays, rail), open movements
      (Command, Movement, rail, Patient Now), referrals waiting (Command, ED, Community team, Raise a
      referral, rail), tasks (bar drawer, Command). Render each pair over the seed **and over three
      mutated seeds** (one movement added, one bed released, one referral declined) and assert
      equality. **Catcher:** the test itself, proved by `npm run mutate` against one derivation.
- [ ] **3.2 The example patients flow end to end**, driven through the real reducer by one Playwright
      journey per path, armed with `npm run test:e2e:ward-journeys` (`tests/ui-ward-third-edition-flow.spec.ts`,
      new, claim the path): 1. **Refer** — Raise a referral for a seeded patient → the referral appears on Command, on the
      ED it came from, on the Community team if addressed to one, and in the rail tally. 2. **Shortlist** — Command shows candidate wards with verdicts (standard §6.8, §6.9); the
      gender gate refuses without an override path; the sex-mix and specialling gates refuse with
      a reason; an unavailable ward is grouped and counted, never selectable. 3. **Accept** — the ward accepts in principle → Ward, Bed board and Capacity show the pulled
      bed as _Held_ (from `unitCapacity()`), the Movement stage advances, Delays drops the row. 4. **Move** — transport booked → Movement shows the leg, the officer view shows the job,
      Patient Now shows the current stage in words. 5. **Arrive** — `PATIENT_ARRIVED` → the admission exists, the bed reads _Occupied_ on Bed
      board, the ED count falls by one, the movement closes, Statistics counts it. 6. **Discharge** — the bed release is flagged, confirmed and released → the third stage reads
      _discharged_ (never _released_), Capacity shows the bed _Available_ (never _Unoccupied_), Ward
      statistics moves its figure.
      After each step the reconciliation line on every visited screen reads _figures reconcile_ and
      the live region announced the change (§7.4). **Catcher:** the journey; a red at any step names
      the screen and the figure.
- [ ] **3.3 The shell is the same on every route.** For all 37 routes: the rail's active link matches
      the route, the bar's place line matches `wardPlaceFor(pathname)`, the three drawers open and
      close by keyboard, Escape leaves the service alone, the appearance choice persists across
      routes, and the twenty-one un-redrawn routes render inside the shell without a second header
      or rail (`ModeHeader` on Network and Governance is the known second header, I-2 of A1 — remove
      it in this step, Ward Lead's file). **Catcher:** `tests/ward-shell-third-edition.dom.test.tsx`
      iterates the route table from `ward-nav.ts`; `tests/ward-nav.test.ts` stays green.
- [ ] **3.4 Every synthetic number carries its marker where it is read.** Extend the reach of
      `tests/ward-provenance-sentences-carry-their-own-marker.test.ts` from two files to the sixteen
      rebuilt screens (owner's "leave the reach at 2" was about priority, not about new screens — Q-3
      of §6.1 asks him to confirm). **Catcher:** the test; each lane's report names the sentence.
- [ ] **3.5 Words before colour, on every state.** One DOM sweep over the sixteen screens: every
      element with a status class carries visible text or an accessible name that states the status
      (`tests/ward-status-carries-a-word.dom.test.tsx`, new, claim the path). **Catcher:** the test,
      proved by removing one word and watching it redden.
- [ ] **3.6 Widths and themes.** Ward Lead renders each of the sixteen at 390, 820 and 1440, light and
      dark, and prints Handover and Ward statistics; a screenshot per width goes to the phase report.
      The two known 641–1000px reds (I-15) are re-run and reported by name.
- [ ] **3.7 Heavy gates once**, on the line: typecheck, lint, the full suite, `run-ward-tests.mjs`,
      `check-ward-expected-reds.mjs`, the ward journeys. Quote the decisive lines (§8).
- [ ] **3.8 Close the phase**: update `assignment-register.md`, `control/now.md`, the registry rows;
      write `docs/ward-flow/WARD-LEAD-HANDOVER-<date>.md` §"third edition built" with the SHAs, what
      was believed but not measured, what was withdrawn, what was not done; back up.

### 5.0 Definition of done for a screen built from a mockup (the gap A3 §6 found — this is it)

A screen is done when **all** of these are true and each is quoted in the lane's report with the
line that proves it:

1. It renders inside the shared shell on its existing route with no rail or header of its own.
2. Every panel, action and state the mockup draws is present, or its absence is recorded as an
   owner question by number — never silently dropped, never quietly added.
3. Every figure is derived through the facade or the lane's own derivation module; a grep of the
   screen's JSX for a numeric literal in text position returns only ordinals and dates.
4. Every link the mockup draws resolves through the facade's href builders and lands on a real route
   with the identifier intact (`ward-links-never-point-at-redirect-stubs` green).
5. The screen's DOM test asserts the words of every state (empty, refused, absent, zero as _none_),
   and was proved a catcher by one mutation.
6. The reconciliation line reads _Synthetic snapshot at <clock>, figures reconcile_ and goes red when a
   figure is made to disagree (one test).
7. Keyboard reach and visible focus on every control; the live region announces each change (§7.3,
   §7.4); nothing under 12px; tokens only; no edge bar or top highlight.
8. Looked at, by a person, at 390, 820 and 1440 in both themes; the screenshots are in the report.
9. `run-ward-tests.mjs` and `check-ward-expected-reds.mjs` green in the lane's worktree; prettier clean
   on touched files; one SHA handed to Ward Lead with an artefact grep.
10. The report ends with the three lines: proven by test, proven by looking, not proven.

---

## 6 · Issues found during the research, with a proposed fix each

**Proven** = verified by reading source at `20eb850792` (or by a command quoted here) by the research
pass or by the plan's author. **Unproven** = read from a document, or inferred; re-measure before
acting. Tier of the finder in brackets: (S) Sonnet extraction, (F) plan author.

| #    | Issue                                                                                                                                                                                                                                                               | Evidence                                                                                         | Proposed fix                                                                                                                                                                                                                                                                                                                   | Status                                                      | Where it lands                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------ |
| I-1  | The master line lacks the last three mockup commits; a builder reading mockups from the line builds the superseded shell                                                                                                                                            | `grep -c accent-press` → `0` on `911813e5f4`, `>0` on `fb7ef96b83` (F)                           | Phase 0.1 fold                                                                                                                                                                                                                                                                                                                 | **Proven**                                                  | Ward Lead                                        |
| I-2  | The rail is mounted per screen (≈28 files); the third-edition shell cannot be mounted per screen without repeating the same omission risk the code comments already name                                                                                            | `layout.tsx` doc comment; grep 39 hits / 30 files, 2 comments (S, A1 §2)                         | Phase 1.1–1.3: shell in `layout.tsx`, per-screen mounts removed                                                                                                                                                                                                                                                                | **Proven** (count re-measured each time)                    | Ward Lead                                        |
| I-3  | No appearance (theme) control exists in the app; the standard requires one (§7.5)                                                                                                                                                                                   | grep for a theme toggle → none (S, A1 §2)                                                        | Phase 1.1 ports the mockups' appearance script                                                                                                                                                                                                                                                                                 | **Proven**                                                  | Ward Lead                                        |
| I-4  | Three different "role" types (`WardFlowRole`, `WardChromeRole`, `WardRole`) with overlapping names and different values                                                                                                                                             | `ward-flow-events.ts:40`, `ward-chrome-role.ts:20`, `ward-derivations.ts:58` (S, A1 §7.1)        | Lanes use `WardFlowRole` for dispatch and `WardChromeRole` for shell adaptation, never `WardRole`; no fourth type. Renaming is out of scope                                                                                                                                                                                    | **Proven**                                                  | every lane (rule)                                |
| I-5  | A page reload wipes a demonstration — domain state is never persisted                                                                                                                                                                                               | no `localStorage` write path for `movements`, `patients`, `admissions`, `referrals` (S, A4 §5)   | Not fixed here: owner question D9-8 is open (§7). The reconciliation line's time comes from the clock, so a reload is at least honest                                                                                                                                                                                          | **Proven**                                                  | owner                                            |
| I-6  | Three of four seed sites still manufacture `Admission.referralId` from the admission id, so `admissionBelongsToTeam` returns false and community team pages read empty                                                                                              | `ward-admissions-seed.ts:240,273,341,378` unchanged; `:783` fixed to `RF-010` (S, A4 §7)         | Phase 1.5: every seeded admission points at a real, chronologically earlier referral; catcher `tests/ward-admissions-seed.test.ts` asserts the join is non-empty for every team page                                                                                                                                           | **Proven (partial fix confirmed)**                          | Ward Lead, before lane B's Community team screen |
| I-7  | Two live "community team" populations of different size and source: `COMMUNITY_TEAMS` (10, region) and `COMMUNITY_TEAM_PAGES` (65, catchment)                                                                                                                       | `ward-teams.ts:34`, `community-derivations.ts:88` (S, A4 §7)                                     | Ask the owner which is the list a screen shows (§7); until answered, lane B renders the one the current Community screen renders and names its source in the report                                                                                                                                                            | **Proven (both exist); whether it is a defect is unproven** | owner → lane B                                   |
| I-8  | Four derived figures have no reader: `legalDeadlineMinutes`, `blockedReleaseCount`, `statewideReleaseCount`, `elapsedMinutesSinceMount`                                                                                                                             | `figures-with-no-reader-2026-09-06.md` (S, A4 §7, not re-verified)                               | The Delays mockup shows the legal deadline sentence (§8.7) — lane A wires `legalDeadlineMinutes` rather than deriving a second one; the other three stay unread until a mockup shows them                                                                                                                                      | **Unproven** (document dated 2026-09-06)                    | lane A                                           |
| I-9  | `Unit.held` is a stored field nothing writes or reads; every "Held" on screen is `unitCapacity().held`                                                                                                                                                              | `ward-model.ts:378-386` (S, A4 §1)                                                               | Never read `Unit.held`; the facade exposes `unitCapacity()` only                                                                                                                                                                                                                                                               | **Proven**                                                  | every lane (rule)                                |
| I-10 | The mockups' embedded engines model the world differently from the app: no `PATIENTS` or `ADMISSIONS` arrays, Patient Now keyed by movement id, Search hub with its own ward id scheme, no bed releases, leave beds, inbox, scenarios, rejections or override trail | grep past the shared stylesheet in all 16 files (S, A4 §8)                                       | **Ruling for this plan:** the mockup engines are the spec for what is _shown_, never for how data is _held_. Every screen reads `WardFlowState` through the facade. A figure a mockup shows that the model cannot derive is a stop-and-hand-back to Ward Lead, who either extends the seed (Phase 1.5) or puts it to the owner | **Proven (the gap); the ruling is the author's**            | every lane                                       |
| I-11 | The invented-figure marker predicate at HEAD is the claim-shape rewrite; `marker-predicate-measured-2026-09-10.md` still describes it as undone                                                                                                                     | `tests/ward-provenance-sentences-carry-their-own-marker.test.ts:117-123` (S, A4 §6)              | Use the predicate in the test file; Ward Lead adds one line to the document saying the rewrite landed (with the SHA)                                                                                                                                                                                                           | **Proven (source); document staleness unproven**            | Ward Lead                                        |
| I-12 | The ward suite's own gates (`run-ward-tests.mjs`, `check-ward-expected-reds.mjs`) run in no automatic chain; a builder running only the standard pyramid never sees them                                                                                            | grep of `verify:cheap:internal`, `verify:pr-local`, `ci.yml` (S, A5 §7.4)                        | Named in §8 as the per-screen gate; Ward Lead runs both after every fold                                                                                                                                                                                                                                                       | **Proven**                                                  | every lane, Ward Lead                            |
| I-13 | 44% of non-DOM ward tests read files with `readFileSync`, so `test:focused` cannot select them                                                                                                                                                                      | `scripts/test-focused.mjs:70` → `vitest related` (S, A5 §1)                                      | §8: name and run them directly                                                                                                                                                                                                                                                                                                 | **Proven**                                                  | every lane                                       |
| I-14 | Two test defects: a dead literal assertion `expect(245 - 35).toBe(210)` at `ward-ed-psychiatry-hub.dom.test.tsx:1687`; the test id `ward-board-fixed-note` is asserted absent in two tests and exists nowhere in `src/`                                             | grepped at `20eb850792` (S, A5 §7)                                                               | Lane B (ED and Bed board owner) deletes the dead line and re-points the two absence assertions at the element that actually carries the frozen-board note, with a positive control that reddens when the note is removed                                                                                                       | **Proven**                                                  | lane B                                           |
| I-15 | Three ward browser journeys are red and owner-deferred from one run: approved referral columns off-screen at 641px (`ui-ward-referrals.spec.ts:1056`), a seed-order assertion (`:414`), a `peel-ed` test id (`ui-ward-roles.spec.ts:559`)                           | `deferred-ward-browser-failures-2026-09-10.md` (S, A5 §4)                                        | The 641px defect is a real reachability defect the Raise a referral rebuild (lane C) will meet: build the third-edition table (§6.15) and re-run that spec; the other two are re-run after Phase 1 and either go green or are reported, never quarantined on one run                                                           | **Proven (the reds); cause unproven**                       | lane C, Ward Lead                                |
| I-16 | Six of twelve ward specs sample no width between 641 and 1000px                                                                                                                                                                                                     | handover 2026-09-10 §12 (F, read)                                                                | §3.3: every lane samples at least one in-band width; the Playwright specs a lane touches gain one                                                                                                                                                                                                                              | **Unproven** (document)                                     | every lane                                       |
| I-17 | Two search screens exist in the app (`/search` finds open movements; `/hub` searches everything) and two in the mockups (Patient search; Search hub), and the app's "Patient search" searches movements, not patients                                               | `search/patient-search.tsx`, `hub-screen.tsx` (S, A1 §1)                                         | Owner question (§7): keep both, or merge. Until answered lane C builds both as drawn                                                                                                                                                                                                                                           | **Proven**                                                  | owner → lane C                                   |
| I-18 | `morning-page.tsx` and `tracker/live-tracker.tsx` are unreachable by design (owner ruling 2026-09-06); `wards/ward-overview.module.css` has no component                                                                                                            | self-documenting comments (S, A1 §7.3)                                                           | Nothing — do not treat their existence as a live screen, and never delete them (protected work)                                                                                                                                                                                                                                | **Proven**                                                  | every lane (rule)                                |
| I-19 | The standard's screens index (§14.1) lists twelve screens; the mockups are sixteen. Missing from §14: Delays, Bed board, Patient Now, Search hub, Ward statistics, Community team statistics, ED statistics                                                         | `WARD-FLOW-DESIGN-SYSTEM.md:1033-1052` (F)                                                       | Ward Mockups adds the seven entries to §14 (the standard is theirs); no lane blocks on it                                                                                                                                                                                                                                      | **Proven**                                                  | Ward Mockups                                     |
| I-20 | The Movements page shows `50 moves` at the top and `43 open moves` at the bottom with nothing reconciling them (6 arrived + 1 did not proceed)                                                                                                                      | ownership registry, Ward Builder Two's row (F, read)                                             | Lane A's Movement rebuild prints one reconciliation line for the two figures (§8.7)                                                                                                                                                                                                                                            | **Unproven** (registry note)                                | lane A                                           |
| I-21 | No notification mechanism exists anywhere while several owner rulings require one ("the referrer must be told when a pull is cancelled")                                                                                                                            | memory `ward-flow-is-destined-to-be-a-real-tool` (F, read)                                       | Out of scope for this phase; recorded in §7 as a thing the owner may be missing                                                                                                                                                                                                                                                | **Unproven**                                                | owner                                            |
| I-22 | Two live chats have edited the same mockup paths today: this branch (`claude/wardflow-design-review-43df97`, three unfolded commits) and Ward Mockups (`ward/mockups-20260910`, 17 commits ahead of its base) — the registry names only Ward Mockups as owner       | `worktree-ownership.md:108-124`; `ListAgents` and `git worktree list` 2026-09-10 (S, A3 §9.1; F) | Phase 0.1 `merge-tree` check before either fold; this branch writes no more mockup edits; mockup defects from lanes go to Ward Mockups                                                                                                                                                                                         | **Proven**                                                  | Ward Lead, Ward Mockups                          |
| I-23 | The ownership registry and `control/now.md` carry stale present-tense rows (a "RESERVED, not yet started" row beside a completion record; a "read this every turn" file dated 2026-09-02)                                                                           | (S, A3 §9.2–9.5)                                                                                 | Ward Lead updates the rows this plan changes (five lanes, five branches) at Phase 0.5, and each lane clears its own row at hand-in                                                                                                                                                                                             | **Proven (staleness); harm unproven**                       | Ward Lead, lanes                                 |
| I-24 | A definition of done exists for a drawing (standard §10) but none for a mockup built into `src/`                                                                                                                                                                    | (S, A3 §6)                                                                                       | §5.0 of this plan supplies one; Ward Lead may promote it into the standard's successor document                                                                                                                                                                                                                                | **Proven**                                                  | this plan                                        |
| I-25 | Sex-and-gender wording tension: the handover lists the gate as "unstarted" while the owner's 2026-09-09/10 rulings settle the model (two fields, gender decides the bed, no override); `docs/outstanding-issues.md` `#BAY1TY` still describes the one-field state   | `owner-decisions-2026-09-09.md:330-349`, `911813e5f4`, handover §5 (S, A3 §9.6)                  | Lanes build to the ruling; Ward Lead queues one `issues:update` request for `#BAY1TY` and records that the **use** gate (real patients) is separate from the **model** change                                                                                                                                                  | **Proven (both texts exist)**                               | Ward Lead                                        |
| I-26 | 58 test files named in dated plans were never written; the owner said those plans are superseded on 2026-09-09 and the handover reopened the question on 2026-09-10                                                                                                 | `owner-decisions-2026-09-09.md:322`; handover §11 (S, A3 §8)                                     | §7 question; no lane writes any of the 58 by name — a lane's catchers are the ones this plan names                                                                                                                                                                                                                             | **Unproven** (documents disagree)                           | owner                                            |

---

## 7 · Questions only the owner can answer — asked once, by Ward Lead, in Phase 0.4

Each carries one recommendation, so the answer can be a word. **Nothing below is built until it is
answered; everything else in this plan proceeds.**

| #    | Question                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Recommendation                                                                                                                                                           | What waits on it                                      |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Q-1  | **Acuity ordering.** The Command drawing orders beds partly by patient acuity. The system never computes acuity (ruled 2026-09-09); may it _order_ by the clinician's mark?                                                                                                                                                                                                                                                                                                                                                                                             | No — order by wait and deadline only, show the mark as a word                                                                                                            | Lane A, Command queue order                           |
| Q-2  | **The catchment rule.** The drawing narrows where a patient can go by where they live. Is that how WA services work?                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Show catchment as information, never as a filter, until a real mapping exists                                                                                            | Lane A (Command shortlist), lane C (Raise a referral) |
| Q-3  | **Two search screens.** The app and the mockups both have Patient search and Search hub. Keep both, or one?                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Keep both for this phase: Search hub is the entry point, Patient search is the person-first list; revisit after use                                                      | Lane C                                                |
| Q-4  | **Patient Now versus Movement detail.** Patient Now is keyed by movement in the drawing; the app has `/people/[patientId]` and `/movements/[movementId]`. Does Patient Now replace the movement workspace, or sit beside it?                                                                                                                                                                                                                                                                                                                                            | Patient Now is the person page (`/people/[patientId]`) and shows the person's current movement inside it; `/movements/[movementId]` stays as the coordinator's workspace | Lane C, lane A                                        |
| Q-5  | **Which community-team list is "the" list** — the ten region placeholders or the sixty-five catchment teams — and are the real team and ED lists coming now?                                                                                                                                                                                                                                                                                                                                                                                                            | The sixty-five, named as invented until replaced; the ten are retired when the real list lands                                                                           | Lane B, Phase 1.5 seed                                |
| Q-6  | **The 2026-09-06 header spec.** The third-edition bar replaces the header you approved on 2026-09-06 (`tests/ui-ward-chrome-header.spec.ts` pins it). May that spec be retired in favour of the third-edition shell test?                                                                                                                                                                                                                                                                                                                                               | Yes                                                                                                                                                                      | Phase 1.2                                             |
| Q-7  | **Where the demonstration controls live.** Clock, scenario and reset are not in the drawing. Tools drawer?                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Tools drawer, labelled _Demonstration_                                                                                                                                   | Phase 1.1                                             |
| Q-8  | **A reload wipes the demonstration** (D9-8, open since 2026-08-30). Keep as is for this phase?                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Yes — persistence is a separate decision with privacy consequences once data is real                                                                                     | none (recorded)                                       |
| Q-9  | **The 58 never-written test files.** Are the dated plans still the plan?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | No — strike the figure; this plan's catchers replace them                                                                                                                | none (recorded)                                       |
| Q-10 | **The seven screens missing from the standard's index** (Delays, Bed board, Patient Now, Search hub, and the three statistics pages): may Ward Mockups add them to §14?                                                                                                                                                                                                                                                                                                                                                                                                 | Yes                                                                                                                                                                      | Ward Mockups                                          |
| Q-11 | **Rail brass bar, flow-map ED-node bars, brand stripe** — keep or remove under the no-edge-bars ruling?                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Remove the two bars; keep the brand stripe (it is a mark, not a state)                                                                                                   | Phase 1.1 shell, lane A flow map                      |
| Q-12 | **Panels the app has and the drawings do not** — Ward Lead collects every lane's list (Delays: Worth your attention, Delays with no named person; Capacity: Ready now, Worth your attention, Beds freeing today; Ward: Withdrawn from {ward}, handover scoping; ED: Psychiatry outbox, Statewide capacity, Recently answered; Community team: Expected back, Left the ward another way; Statistics: the two funnels; Community statistics: Where this team sits; Search hub: browser memory; ED statistics: where Comparison lives) and asks once: keep, fold, or drop? | Keep each as a group inside the nearest drawn panel or in the Activity drawer, as each section recommends; drop nothing                                                  | every lane's Q-12 task                                |
| Q-13 | **The referral's history fields.** The Raise a referral drawing has three prose blocks with one required; your 2026-08-30 ruling allows exactly one story field, optional, last, never feeding eligibility. Which stands?                                                                                                                                                                                                                                                                                                                                               | The ruling — one field; Ward Mockups redraws                                                                                                                             | Lane C, 4.12 task 4                                   |

### 7.1 What you may be missing — for the owner to weigh, not for this plan to decide

1. **Communication has no mechanism.** The stated purpose is to _communicate_ bed decisions, and
   several rulings already require a message to someone ("the referrer must be told"). No screen,
   toast, inbox item or log carries a message to another role today. A built system without it
   demonstrates recording, not communicating.
2. **Nobody is anybody.** No viewer, scope or role argument exists; a role is only what a decision is
   recorded against. Every screen you approve assumes a person is looking who may see it — fine for a
   demonstration, a blocker for "a real tool" (your 2026-09-04 answer).
3. **The invented-figure marker reaches two files of seventy-six.** You ruled "leave the reach at 2".
   Sixteen rebuilt screens will each carry new sentences about figures; unless the marker test's
   reach grows to the sixteen, they are unexamined the day they land. Recommendation: extend the reach
   to the sixteen rebuilt screens only, as part of each lane's definition of done.
4. **The browser journeys are inert by default and six of twelve never sample a laptop width.** A
   rebuilt screen can be green in every automatic gate and broken at 820px. The plan asks every lane to
   look at three widths; nothing else will.
5. **The mockups model the world differently from the app** (no patients, no admissions, movement-keyed
   records). Building "what is drawn" literally would re-create a world the model already rejected. The
   plan's ruling: mockups say what is _shown_; the model says what is _true_. If you disagree, say so
   before Phase 1.
6. **Twenty-one routes have no third-edition drawing** (Network, Governance, Handover, Discharges, Out
   of area, All wards, community index, Transport officer, Referral board, New patient, Statistics
   compare and service, and the redirect stubs). They will sit inside the new shell in their old
   clothes. Handover and New patient are your own two priorities from 2026-09-09 — neither has a
   drawing yet.
7. **Three gates before real-patient use are unchanged and unstarted** (TGA/SaMD classification;
   sex-and-gender as bed-matching input — now ruled at model level, still un-reviewed as a use gate;
   Aboriginal cultural safety review). Nothing in this plan moves them, and two cannot be met from
   inside the project.
8. **The primary checkout `D:/Repos/Database` has no binaries**, so any gate run there is the silent
   version. Every lane runs gates in its own worktree only, after `ls node_modules/.bin | wc -l`.

---

## 8 · Verification — what proves each level

| Level  | Command or act                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Decisive line to quote                                                                                                                            | When                             |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Task   | `npm run test:focused -- --files <changed files>`; ⚠️ 44% of the non-DOM ward tests read files with `readFileSync` and have no import edge, so a focused run cannot select them — name them and run them directly: `npx vitest run tests/<file>` (A5 §1)                                                                                                                                                                                                                                                                                                                                                                                                                | `N passed`                                                                                                                                        | every task                       |
| Task   | a **new** test is proved a catcher before it is trusted: `npm run mutate` (`scripts/ward-flow/mutation-run.mjs`, restores from captured bytes and verifies the restore by content) — the injected defect must redden it                                                                                                                                                                                                                                                                                                                                                                                                                                                 | the mutant's `FAILED` line, then the restore line                                                                                                 | every new test                   |
| Task   | `npx prettier --check <touched files>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `All matched files use Prettier code style!`                                                                                                      | every commit                     |
| Screen | `node scripts/run-ward-tests.mjs` (every `tests/ward-*`, refuses if any file produced no result; takes no heavy lock) then `node scripts/check-ward-expected-reds.mjs` (actual reds must equal `tests/ward-expected-reds.json`, currently `"expected": []`, in both directions). Neither runs in `verify:cheap`, `verify:pr-local` or CI — a builder who runs only the standard pyramid never sees them (A5 §7.4)                                                                                                                                                                                                                                                       | `N passed`, floors `FLOOR_FILES=200` / `FLOOR_TESTS=2500` met; the reds script's own summary                                                      | before the SHA goes to Ward Lead |
| Screen | the existing structural nets, named so nobody assumes they ran: `ward-route-component-binding`, `ward-component-reachability`, `ward-mode-workspace-reachability`, `ward-event-reachability`, `ward-nav`, `ward-seed-reaches-every-branch`, `ward-table-min-width` (six column-count pins that must be re-derived, never deleted), `ward-css-token-references-resolve`, `ward-design-language-contract`                                                                                                                                                                                                                                                                 | `N passed` per file                                                                                                                               | before the SHA goes to Ward Lead |
| Screen | **render it and look** at 390, 820 and 1440 px, light and dark, plus print — one dev server per machine, the URL from `npm run ensure`, project identity confirmed at `/api/local-project-id`                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | a screenshot per width in the lane's report                                                                                                       | before the SHA goes to Ward Lead |
| Shell  | `tests/ward-shell-third-edition.dom.test.tsx`; the mockup harness on Command as the reference: `node docs/ward-flow/mockups/third-edition-kit/check.mjs docs/ward-flow/mockups/command-third-edition.html platinum` — **the harness proves the drawing, not the app**; the app's shell is proved by the DOM test and `tests/ui-ward-chrome-header.spec.ts` (or its owner-ruled successor)                                                                                                                                                                                                                                                                               | `ALL GREEN`; `N passed`                                                                                                                           | Phase 1 and after every fold     |
| Fold   | `scripts/ward-flow/folded.sh` (refuses to report until a known-folded commit reads folded); the artefact grep the requester named; `git merge-base --is-ancestor <sha> <line>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | folded / not folded / cannot tell — three verdicts                                                                                                | every fold                       |
| Line   | heavy gates **once**, at the end of each phase, on the master line only: `npm run typecheck`, `npm run lint`, the full Vitest suite; then the ward browser journeys armed for one run — `npm run ensure` first, then `npm run test:e2e:ward-journeys` (the `chromium-mockups` project; the default `chromium` project inverts the `@mockup` tag so `verify:ui` collects **zero** ward tests). `docs/ward-flow/deferred-ward-browser-failures-2026-09-10.md` lists three owner-deferred reds from a single run (referral columns off-screen at 641px; a seed-order assertion; a `peel-ed` test id) — a red beyond those is a finding for Ward Lead, not a fix for a lane | `Test Files N passed`, `Tests N passed`, `exit 0`; typecheck `0 errors`; the journeys' `N passed / N failed` line with the three known reds named | end of Phase 1, Phase 2, Phase 3 |
| Lock   | exit 75 or a capacity refusal means **blocked, retry** — never a failure, never something to fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | —                                                                                                                                                 | always                           |

**A report lists what it did not verify.** Three lines close every dispatch: proven by test, proven
by looking, not proven. An absent signal reads exactly like a passing one.

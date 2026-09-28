# Overview: Ward Flow and the project on one page

> [!NOTE]
> **Historical Code Map Context:**
> This overview was written on 25 September 2026 when Ward Flow was co-located in the Database monorepo with PsychSift. Ward Flow has since been separated into its own repository ([`BigSimmo/Ward-Flow`](https://github.com/BigSimmo/Ward-Flow)) with `main` as its base. References to "two products", "the ward line is local only and never pushed", and PsychSift deployment pipelines are historical context describing the extraction state.

Back to [the code map index](README.md). The other parts go file by file; this page is the
summary. Where this page and a part disagree, the part wins: it was written later, at tip
`ace8e9ee8d`, and each correction below is marked "(corrected)".

**Read-only map, written 25 September 2026 against tip `663a66484a`** on branch
`codex/task-ward-flow-live-state-20260831` (`D:/Worktrees/Database/ward-lead`). Nothing was run
except read-only listing, counting and grep. No test, build, server or provider was touched. Every
count below names how it was measured; re-check with `git log -1` before relying on any of it,
because this line moves several times a day.

This file is a map, not a ruling. Where it quotes another document's verdict, it names that
document and its date.

---

## 1. The whole thing on one page

Historically, the source monorepo held **two products that shared one Next.js app**:

1. **PsychSift** — the live clinical knowledge base (Supabase + pgvector + OpenAI), deployed to Railway.
2. **Ward Flow** — a prototype for coordinating psychiatric beds across Western Australian
   services with synthetic patients only. In this dedicated repository (`BigSimmo/Ward-Flow`),
   Ward Flow runs standalone with in-memory/browser-local state and no database connectors.

Ward Flow borrows the app frame (Next.js, the request proxy, a developer access gate, a handful
of shared UI pieces) and nothing else. Nothing in PsychSift imports Ward Flow.

| Area (tracked files, `git ls-files`)                         |  Files | Size                                               |
| ------------------------------------------------------------ | -----: | -------------------------------------------------- |
| Ward Flow engine + screens `src/components/ward-management/` |    315 | ~153,000 lines of `.ts/.tsx` (plus 99 CSS modules) |
| Ward Flow routes `src/app/mockups/ward-flow/`                |     49 | 42 `page.tsx`                                      |
| Ward Flow tests `tests/ward-*`, `tests/ui-ward-*`            |    648 | ~188,700 lines (635 unit/DOM + 13 browser)         |
| Ward Flow scripts `scripts/ward-flow/`                       |     49 | 45 top-level + `audit/`                            |
| Ward Flow docs `docs/ward-flow/`                             |  1,272 | incl. 140 files of design drawings                 |
| PsychSift `src/` (all, incl. Ward)                           |  1,765 | —                                                  |
| PsychSift tests (non-Ward)                                   | ~1,085 | 769 unit + 46 browser specs                        |
| `supabase/migrations/`                                       |    234 | none mention Ward Flow                             |

### How the pieces fit

```
Browser request /mockups/ward-flow/...
  └─ src/proxy.ts ── marks it a Ward Flow path, strips spoofed headers, lets it past the
  │                  production mockup block (developer-gated prefix)
  └─ src/app/layout.tsx ── sees the Ward Flow header, SKIPS the Supabase AuthProvider
  └─ src/app/mockups/layout.tsx ── 404 unless mockups enabled or developer-gated
  └─ src/app/mockups/ward-flow/layout.tsx
        WardFlowProvider          (the engine: useReducer + sessionStorage + clock)
          WardLiveRegion, WardRail, WardBarMount, WardBroadcastBanner   (the chrome)
          WardGround → {page}     (one of 42 routes → one screen component)

Screen ──dispatch(event)──▶ wardFlowReducer ──▶ new WardFlowState
   ▲                          (role check → stale check → eligibility/legal guards;
   │                           refusals recorded, protected events audited)
   └──── derivations (pure functions of state + now) ◀── state
```

---

## 2. Ward Flow engine and data model

All in the root of `src/components/ward-management/`. The engine is almost entirely
self-contained: only three engine files import anything from outside Ward Flow
(`@/lib/client-store-factory`, `@/lib/form-register`, `@/components/ui/sheet-focus`).

### 2.1 Engine files

**The core five (more than half of all engine lines):**

| File                   | Lines | What it is                                                                                                                                                                   |
| ---------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ward-flow-reducer.ts` | 8,741 | The reducer `wardFlowReducer(state, event)`, `seedWardFlowState` / `seedWardFlowStateAt`, 145 `case` labels (97 in the event switch; corrected), all guards and audit writes |
| `ward-movements.ts`    | 3,123 | Despite the name, the **seed fixtures**: movements, bed releases, leave beds, referrals                                                                                      |
| `ward-model.ts`        | 3,040 | Every entity type and fixed vocabulary (`Movement`, `Referral`, `Unit`, `Site`, `Decline`, `Override`, `BedRelease`, `LegalForm`, `Notice`, stages, tunables)                |
| `ward-flow-events.ts`  | 2,452 | The `WardFlowEvent` union (97 event types) and `EVENT_ROLE`, the who-may-do-what table                                                                                       |
| `ward-derivations.ts`  | 2,034 | 53 pure selectors shared by screens (`isOpen`, `stageSummaries`, `referralBlockedReason`, …)                                                                                 |

**Wiring and persistence:**

| File                                      | Lines | What it is                                                                                                                                    |
| ----------------------------------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `ward-flow-provider.tsx`                  |   804 | React context: `useReducer`, sessionStorage save/restore, clock tick, role-gated record reads; exposes `useWardFlow()` / `useWardFlowClock()` |
| `ward-flow-storage-validation.ts`         |   495 | Structural validator for a restored save; a bad save is discarded, never repaired                                                             |
| `ward-flow-persistence-classification.ts` |   481 | Classifies every event type as text-safe or typed-text, for the privacy lock on saving                                                        |
| `ward-audit.ts`                           |   534 | Audit trail state and `appendAudit` / `reviewDecision`                                                                                        |
| `ward-reanchor.ts`                        |   169 | Shifts seeded times so the fixture looks the same at any wall-clock time                                                                      |
| `ward-clock.ts`                           |   216 | The synthetic clock. `Instant` = minutes since day-0 midnight. The **only** file allowed to read the real clock                               |
| `ward-configuration.ts`                   |   135 | Coordinator-tunable numbers and their validation                                                                                              |
| `ward-scenarios.ts`                       |    44 | "standard" and "scarce" scenarios                                                                                                             |
| `ward-rulings-demo.ts`                    |   418 | Demo overlay merged onto the seed                                                                                                             |

**Seeds (all synthetic):** `ward-sites.ts` (909; sites, units, EDs, `NOW_ANCHOR` 10:42),
`ward-admissions-seed.ts` (920), `ward-patients-seed.ts` (777). Real WA place _names_ only (no
figures) come from `reference/ward-reference-registry.ts` (930), `ward-reference-distances.ts`
(519) and `ward-reference-teams.ts` (398), generated by `npm run ward:reference:build` from
`docs/ward-flow/reference-data/`.

**Domain rules and selectors:**

| File                          |      Lines | What it is                                                                                                                                                                                                                                                                                                |
| ----------------------------- | ---------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ward-eligibility.ts`         |        833 | Bed suitability gates: sex, legal status, locked/open, forensic, intake constraints                                                                                                                                                                                                                       |
| `ward-referrals.ts`           |      1,460 | Referral state, queue order, out-of-area banding                                                                                                                                                                                                                                                          |
| `ward-catchment.ts`           |      1,291 | Suburb → community team lookup, aliases, review states                                                                                                                                                                                                                                                    |
| `ward-referral-visibility.ts` |      1,076 | Which role sees which referral fields                                                                                                                                                                                                                                                                     |
| `ward-admissions.ts`          |        859 | `Admission` type and bed-occupancy helpers                                                                                                                                                                                                                                                                |
| `ward-change-reasons.ts`      |        713 | Fixed pick-lists for declines, overrides, blockers (no free text)                                                                                                                                                                                                                                         |
| `ward-patients.ts`            |        577 | `Patient` type and display helpers                                                                                                                                                                                                                                                                        |
| `ward-board-derivations.ts`   |        435 | Bed board figures                                                                                                                                                                                                                                                                                         |
| `ward-statistics.ts`          |        347 | Six flow statistics (length of stay etc.)                                                                                                                                                                                                                                                                 |
| `ward-service-colors.ts`      |        326 | Health-service colour tokens                                                                                                                                                                                                                                                                              |
| `ward-morning-rollup.ts`      |        306 | Unit → hospital → network capacity roll-up                                                                                                                                                                                                                                                                |
| `ward-service-scope.ts`       |        288 | Unit/movement/referral → health service                                                                                                                                                                                                                                                                   |
| `ward-contention.ts`          |        287 | One bed offered to two movements                                                                                                                                                                                                                                                                          |
| `ward-legal-clock.ts`         |        286 | Mental Health Act form expiry clocks                                                                                                                                                                                                                                                                      |
| `ward-priority.ts`            |        273 | Movement priority scoring                                                                                                                                                                                                                                                                                 |
| `ward-discharge-dates.ts`     |        255 | Forward bed releases from expected discharges                                                                                                                                                                                                                                                             |
| `ward-bed-availability.ts`    |        220 | `capacityBreakdown()` — every capacity-board figure, computed once                                                                                                                                                                                                                                        |
| `ward-discharge-records.ts`   |        170 | Role-scoped read gating for discharge records                                                                                                                                                                                                                                                             |
| Smaller                       | < 120 each | `ward-bed-designation`, `ward-patient-resolver`, `ward-distance`, `ward-legal-forms`, `ward-absence-labels`, `ward-diagnosis`, `ward-travel-bands`, `ward-board-time-features`, `ward-pressure`, `ward-stage-copy`, `ward-place`, `ward-chrome-role`, `ward-flow-roles`, `ward-modal-focus`, `ward-teams` |

**Most-imported engine files** (importers across Ward Flow code): `ward-model` 125,
`ward-clock` 100, `ward-sites` 73, `ward-derivations` 71, `ward-flow-provider` 59,
`ward-patients` 34, `ward-admissions` 33. The reducer itself is imported by only 9 files; screens
go through the provider.

### 2.2 Core entities (`ward-model.ts` unless noted)

- **Movement** (`:1176`) — one patient's journey to a bed; the widest type (~50 fields). Links to
  `Patient`, origin ED, `Referral` (or a recorded absence of one), referred and accepted units,
  legal status and form, declines, overrides, transport job, and the `Admission` once placed.
- **Referral** (`:2476`) — the front-door request, which comes before a Movement. Holds
  destinations (each with its own state), home region, suburb, source, tentative diagnosis and
  one free-text history field.
- **Patient** (`ward-patients.ts`) — a person, independent of any journey.
- **Admission** (`ward-admissions.ts`) — a person in a bed. Its `referralId` is seed-authored and
  not validated by any reducer path.
- **Unit** (`:530`) — a ward: beds, locked beds (open beds derived), sex mix, authorised for
  involuntary patients, forensic. Occupancy is derived from admissions, never stored.
- **Site** (`:669`) — a hospital with its ED and units. **BedRelease** (`:1719`), **Decline**
  (`:694`), **Override** (`:718`), **LegalForm** (`:384`), **Notice** (`:2998`).

### 2.3 Actions, state and guards

**97 event types** (unique `type:` literals in `ward-flow-events.ts`, re-counted for this map),
grouped:

- **Movement and bed pipeline (~21):** `RAISE_REFERRAL`, `REFER_TO_UNITS`, `ACCEPT_IN_PRINCIPLE`,
  `PULL_PATIENT`, `RELEASE_PULL`, `DECLINE`, `RELEASE_AND_REOPEN_SEARCH`, blockers, step-back,
  diversion, arrival and ED arrive/leave/outcome events.
- **Referrals (~9):** receive, accept, decline, withdraw, referrer withdrawal, refer to community
  team, local bed sought, no referral, correction.
- **Legal (~10):** change status, form written/received/expiry/continuation, country extension,
  correct receipt, flag/override mismatch, examination.
- **Capacity and bed release (~13):** confirm capacity, flag/confirm/revert/block/clear bed
  release, preparation, leave beds, intake constraints, refresh request, morning roll-up.
- **Transport (7):** need, book, accepted, en route, collected, cancel, stop.
- **Discharge (5), urgency/gender/clinical (~10), patients (1),** and **handover, broadcast,
  inbox, repatriation (~13).**
- **World (5):** `ADVANCE_CLOCK` (demo role only), `RESET_SCENARIO`, `SET_SCENARIO`,
  `SET_CONFIGURATION`, `REVIEW_AUDIT_EVENT`.

**Guard order** for protected events (`ward-flow-reducer.ts`, via `reduceRecordEvent`; line numbers are in [Engine](engine.md)):

1. Role check first, against `EVENT_ROLE`.
2. Payload sanity (finite times, safe counters).
3. Stale-view check: `expectedGeneration` must equal `worldGeneration`.
4. Domain guards: eligibility (12 calls), legal status, catchment answered, scenario,
   configuration, record-actor rights.

A refused event changes nothing except to record a `Rejection` (and, for protected events, an
audit entry). Eligibility is "refuse unless a reason is recorded": the coordinator can override
with a recorded reason (owner ruling, 2 Sept 2026).

**State** (`WardFlowState`, `ward-flow-reducer.ts:284`): movements, units, referrals, patients,
admissions, bed releases, leave beds, rejections, notices, broadcast alerts, repatriations,
handover sign-offs, clinical contacts, refresh requests, roll-up confirmations, inbox
acknowledgements and completions, configuration, scenario, clock offset, audit state, and
monotonic id counters (never array length).

### 2.4 Data flow and persistence

1. Seeds are deep-copied into a fresh state, the demo overlay is applied, and times are
   re-anchored to page-load time.
2. `WardFlowProvider` holds the state in `useReducer`.
3. **Saved to `sessionStorage`** (not localStorage) under `ward-flow-demo-state-v1`, payload
   version 4. On restore, any mismatch (bad JSON, failed validation, wrong version, wrong day,
   generation or clock mismatch) discards the save.
4. **Privacy lock:** once any typed-free-text event, or any rejection, happens, saving stops for
   the rest of that world until a reset (ruling D-11). So typed notes never reach storage.
   Since D-18 (Josh, 25 Sept 2026) a refusal no longer stops saving; only typed text does.
5. The clock only moves through `ADVANCE_CLOCK`, which adds to an offset. Tests all share one
   instant unless they advance it.
6. Screens read through the provider and the pure derivation modules.

Other browser storage: `shell/ward-service-store.ts` (chosen health service, sessionStorage),
`use-ward-sidebar-collapsed.ts` and hub "recents" (localStorage via `createBrowserStore`).

### 2.5 Roles

Eight `WardFlowRole`s (`ward-flow-roles.ts`): coordinator, ed, ward, officer, community,
bed_manager, executive, demo. **There is no signed-in identity: the role is the route you are
on** (`ward-chrome-role.ts`). Three separate layers:

- **Action permission:** `EVENT_ROLE` in the reducer.
- **Chrome and nav order:** `ward-chrome-role.ts`, `ward-nav-role-order.ts` (reorders, never
  hides), `ward-place.ts`.
- **Record reads:** `WardRecordActor` in `ward-discharge-records.ts`.

The role switcher (`ward-role-switcher.tsx`) is four links to role home pages, mounted in the top
bar's Tools drawer. The rail's "clinical persona" popover is cosmetic.

### 2.6 Engine notes

- No `TODO`/`FIXME` markers in engine files.
- `ward-teams.ts` has **no code importers** (re-checked: only comments mention it). Superseded by
  the site/team join; do not delete without the owner (protected path).
- Comments admit these are **not enforced**: `Unit.allocatable` vs offered beds can drift after
  `CONFIRM_CAPACITY` (`ward-eligibility.ts:496,533`); `TransportJob.formRequired` is an
  unvalidated string (`ward-model.ts:1021`); `Admission.referralId` unvalidated
  (`ward-model.ts:1227`); three referral draft fields stored with no runtime check
  (`ward-flow-persistence-classification.ts:106`); scenario on restore and one `originSiteCode`
  path trusted unchecked (`ward-flow-reducer.ts:1840,5524`).

---

## 3. Routes, shell and navigation

### 3.1 Routes (42 `page.tsx` under `src/app/mockups/ward-flow/`)

Every page file is a server component that renders one client screen.

| URL under `/mockups/ward-flow`                                                           | Screen (folder)                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `/` (home)                                                                               | `CoordinatorScreen` (coordinator)                                        |
| `/alerts`                                                                                | `AlertsScreen` (alerts)                                                  |
| `/board/[unitId]`                                                                        | `WardBoard` (board)                                                      |
| `/capacity`                                                                              | `CapacityScreen` (capacity)                                              |
| `/community`                                                                             | `CommunityIndex` (community)                                             |
| `/community/[teamId]`                                                                    | `CommunityScreen` (community)                                            |
| `/delays`                                                                                | `DelaysScreen` (delays) — absorbed queue, exceptions, escalation         |
| `/discharges`                                                                            | `DischargeBoard` (discharges)                                            |
| `/ed/[edId]`                                                                             | `EdScreen` (ed)                                                          |
| `/governance`                                                                            | `WardModeWorkspace` mode "governance" (root `ward-management-modes.tsx`) |
| `/handover`                                                                              | `HandoverPage` (handover)                                                |
| `/hub`                                                                                   | `HubScreen` (hub) — "Search hub"                                         |
| `/legal-forms`                                                                           | `LegalFormsScreen` (legal-forms)                                         |
| `/movements`                                                                             | `MovementsScreen` (movements) — absorbed the transport tracker           |
| `/movements/[movementId]`                                                                | `WardPatientWorkspace` (root `ward-management-console.tsx`, 3,287 lines) |
| `/network`                                                                               | `WardModeWorkspace` mode "network"                                       |
| `/on-call`                                                                               | `OnCallScreen` (on-call) — separate from PsychSift's on-call             |
| `/out-of-area`                                                                           | `OutOfAreaBoard` (out-of-area)                                           |
| `/people/[patientId]`                                                                    | `PersonScreen` + `PatientNowScreen` (patients)                           |
| `/people/new`                                                                            | `AddPatientForm` (patients)                                              |
| `/referrals`                                                                             | `ReferralBoard` (referrals)                                              |
| `/referrals/new`                                                                         | `ReferralIntakeForm` (referrals)                                         |
| `/search`                                                                                | `PatientSearchPage` (search)                                             |
| `/settings`                                                                              | `SettingsScreen` (settings)                                              |
| `/sovereign`                                                                             | `SovereignShowcaseScreen` — chrome showcase, no link to it anywhere      |
| `/statistics`                                                                            | `StatisticsScreen` (statistics hub)                                      |
| `/statistics/overview`, `/compare`                                                       | overview and compare screens (linked from the hub only)                  |
| `/statistics/ward/[unitId]`, `/ed/[edId]`, `/service/[serviceId]`, `/community/[teamId]` | per-place statistics screens                                             |
| `/transport/officer`                                                                     | `OfficerScreen` (officer) — phone-first                                  |
| `/ward/[unitId]` and `/ward/[unitId]/answer`                                             | `WardScreen` (ward), two presentations                                   |
| `/wards`                                                                                 | `WardIndex` (wards)                                                      |

**Six redirect stubs** keep old links working: `/constellation` → `/network`, `/ed` →
`/ed/fremantle-ed`, `/escalation`, `/exceptions`, `/queue` → `/delays?from=…`, `/transport` →
`/movements`.

**Error boundaries:** `error.tsx` at the root, a nearer one for `statistics/**`, and
`sovereign/` has its own error and loading pair. A throw inside the provider's initialiser or at
module load in `ward-movements.ts` is not caught by any of the three boundaries
(`ward-flow/error.tsx`, `mockups/error.tsx`, `app/error.tsx`); corrected, see
[Frame and PsychSift](frame-and-psychsift.md).

### 3.2 Navigation

- **`ward-nav.ts`** (747 lines) is the single source: six coordinator views (command, network,
  delays, capacity, movements, governance), 17 further destinations, a map of every route
  deliberately left out with its reason, one primary action per route, and a route → title
  resolver. `tests/ward-nav.test.ts` checks both directions (every link is a route; every route is
  listed or exempt).
- **The mounted rail** (`shell/ward-rail.tsx`, 1,231 lines) picks from those lists into four
  fixed groups (Operations, Service Hubs, Care Coordination, Oversight) and reorders within each
  group by role.
- **Nav badges** (`ward-nav-counts.ts`) only for capacity, movements, delays, discharges and
  referrals. Other destinations show no badge rather than a false zero.

### 3.3 Shell (`shell/`, the "third edition" chrome)

`ward-rail.tsx` (left rail), `ward-bar.tsx` (1,584; top bar with service selector, search,
Activity/Tasks/Tools drawers and the primary action), `ward-broadcast-banner.tsx`,
`ward-live-region.tsx` (the one screen-reader announcer), `ward-checks.ts` +
`ward-reconciliation-line.tsx` (screens publish reconciliation checks to the rail),
`ward-facade.ts` (433; framework-free link builders), `ward-drawer-bus.ts` (keyboard shortcuts
open drawers), `ward-command-activity.ts`, `ward-service-bed-alerts.ts`, small stores for sound,
wallboard and service.

**Retired chrome still on disk, not mounted:** `ward-management-navigation.tsx` (`ClinicalRail`),
`ward-sidebar-content.tsx`, `ward-chrome-header.tsx`, `ward-chrome-search.tsx`,
`ward-standing-strip.tsx`, the `WardShellHeader` export in `ward-shell.tsx`,
`use-ward-sidebar-collapsed.ts`, and `shell/ward-shell-tokens.module.css` (empty stub). These
are the only files that import PsychSift's `BrandMark`.

**Shared UI primitives** at the root: `ward-panel`, `ward-chip` (six worded states; throws
without text), `ward-bar.tsx` (a small stacked-bar chart; **not** the same as `shell/ward-bar.tsx`),
`ward-figure`, `ward-record-row`, `ward-controls`, `ward-freshness`, `ward-table/`.

### 3.4 Styling

CSS modules throughout, no CSS-in-JS. Two token layers, deliberately separate:
`ward-tokens.module.css` (aliases PsychSift v2 tokens; raw colours banned by
`tests/ward-raw-colour.test.ts`) and `src/app/ward-flow-shell-tokens.module.css` (the third
edition's closed palette, copied from the approved drawing, kept outside the scanned folder on
purpose). Several screens carry a `*-third-edition.module.css` beside an older module. Largest
stylesheets: `delays` 5,406, `ward` 5,233, `board` 4,847, `referrals` 4,802 lines.

---

## 4. Screens

Line counts are `.ts/.tsx` only (CSS excluded), measured for this map. "Actions" are reducer
events the screen dispatches.

| Folder                                                                |      Lines | What the user does there                                                                                           | Actions                            |
| --------------------------------------------------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `statistics/`                                                         |     16,363 | Read-only reporting: hub, overview, compare, per ward/ED/service/team                                              | none                               |
| `referrals/`                                                          |     10,355 | Referral board, raise a referral (`referral-intake.tsx` 4,440), match view, referral drawer                        | 10 types                           |
| `community/`                                                          |      7,093 | Team directory and one team's caseload, referrals, transport                                                       | 7 types                            |
| `ward/`                                                               |      6,924 | The per-ward operational screen (`ward-screen.tsx` 5,034): bed release, pulls, morning roll-up, intake constraints | **20 types, 29 call sites (most)** |
| `ed/`                                                                 |      6,409 | ED board (`ed-screen.tsx` 5,810, the largest file): referral, legal forms, clearance, transport, outcomes          | 20 types                           |
| `search/`                                                             |      4,924 | Patient search, typeahead, record preview                                                                          | none                               |
| `shell/`                                                              |      4,719 | See §3.3                                                                                                           | —                                  |
| `coordinator/`                                                        |      4,565 | Home: ED pressure, priority queue, flow diagram, shortlist panel (2,093), exception drawer                         | 7 types                            |
| `patients/`                                                           |      4,464 | Person record, patient-now summary, add a patient                                                                  | 2 types                            |
| `board/`                                                              |      4,234 | Bed board for one unit (`ward-board.tsx` 3,629), printable daily sheet                                             | 10 types                           |
| `movements/`                                                          |      4,173 | Movements list, 48-hour Gantt, traffic diagram, drawer                                                             | 2 types                            |
| `handover/`                                                           |      3,537 | Shift handover with sign-off                                                                                       | 1                                  |
| `capacity/`                                                           |      3,263 | Network bed capacity and bed map                                                                                   | 1                                  |
| `delays/`                                                             |      2,654 | "Why is this person still waiting"                                                                                 | none                               |
| `settings/`                                                           |      2,407 | Configuration and simulated operator switch                                                                        | 1                                  |
| `reference/`                                                          |      1,847 | Data only (see §2.1), no screen                                                                                    | —                                  |
| `tools/`                                                              |      1,785 | Catchment resolver and MHA calculator, opened from the top bar                                                     | none                               |
| `legal-forms/`                                                        |      1,761 | MHA form receipt and expiry tracking                                                                               | 2                                  |
| `alerts/`                                                             |      1,672 | Inbox of decisions and WA-wide broadcasts                                                                          | 3                                  |
| `hub/`                                                                |      1,647 | Search hub with provenance and recents                                                                             | none                               |
| `discharges/`                                                         |      1,444 | Expected discharges grouped by readiness                                                                           | 1                                  |
| `officer/`                                                            |      1,212 | Transport officer console                                                                                          | 5                                  |
| `wards/`                                                              |      1,031 | Ward directory with capacity cards                                                                                 | none                               |
| `on-call/`                                                            |        959 | On-call roster and contacts                                                                                        | 1                                  |
| `out-of-area/`                                                        |        950 | Repatriation ledger                                                                                                | 1                                  |
| `escalation/`, `tracker/`, `governance/`, `sovereign/`, `ward-table/` | < 250 each | See below                                                                                                          | —                                  |

Root-level screens: `ward-management-console.tsx` (3,287; movement workspace),
`governance-registers.tsx` (1,928; dispatches `REVIEW_AUDIT_EVENT`), `ward-management-modes.tsx`
(governance and network workspaces), `ward-management-network.tsx`, `decline-register.tsx`
(inside the coordinator's exception drawer), `override-register.tsx` (inside the ward screen).

**Unreachable on purpose** (each carries a "this component is unreachable" comment citing the
owner ruling of 6 Sept 2026 and is guarded by `tests/ward-component-reachability.test.ts`):
`escalation/`, `tracker/`, `community/community-home.tsx`, `ed/ed-home.tsx`. Not deleted because
deletion needs the owner.

---

## 5. Running and testing

### 5.1 Daily loop

```bash
npm run ward:dev                               # organisation check, then prints the local URL
node scripts/ward-flow/serve-mockups.mjs       # serve the drawings (never double-click them)
node scripts/run-vitest.mjs <affected-files>   # focused tests: changed files + up to 3 importers
node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit
```

Screens are at `<printed URL>/mockups/ward-flow`. Never assume a port.

### 5.2 Fold gates (once, when folding)

```bash
node scripts/check-ward-expected-reds.mjs      # the full offline ward suite
npm run test:e2e:ward-journeys                 # 13 browser specs, project chromium-mockups
```

Plus the generator checks (`screen-map`, `mockup-manifest`, `owner-rulings-index`,
`screen-verification`, `rules-index`, each `--check`) and `npm run ward:organise:check`.

### 5.3 The tests

- **635 `tests/ward-*` files:** 268 DOM tests (`*.dom.test.tsx`, jsdom) and 366 pure tests
  (`*.test.ts`, node), run by the repo-wide `vitest.config.mts` projects. Biggest groups by
  prefix: statistics 45, referral 44, community 31, ED 24, flow 22, capacity 17, board 17,
  movements 18, screen 15, patient 14.
- **13 browser specs** `tests/ui-ward-*.spec.ts`, run only under the `chromium-mockups`
  Playwright project, never in the production browser lane.
- Shared helpers in `tests/helpers/ward-*.ts` (captions, dead-end routes, invented figures,
  panels, place-name leaks, referral history).
- **`tests/ward-expected-reds.json`** lists tests that are allowed to fail. It is checked both
  ways: an unlisted failure fails the gate, and a listed test that starts passing also fails. It
  is **empty** at this tip (re-checked). The gate refuses to pass if fewer than 200 files or 2,500
  tests ran.

### 5.4 Ward-specific guards

- **Pre-commit hook** (`.githooks/pre-commit`): refuses committing Ward Flow files on local
  `main` without an explicit confirmation, and re-checks the generated indexes when their sources
  are staged.
- **Pre-push guard** (`scripts/guard-push.mjs:295-458`): blocks pushing Ward Flow files to
  `main` or any remote.
- **`check-ward-legal-language.mjs`** — no wording that claims legal authority.
- **`check-clinical-governance-gate.mjs`** — synthetic patients only, no live health-record
  endpoints, disclaimers mounted, no live deployment without sign-off records.
- **`design-test-registry.json` + `design-test-sync.mjs`** — links each of 34 screens to its
  tests; refuses to touch clinical or legal assertions.
- **Screen verification** (`screen-verification.json` → `SCREEN-VERIFICATION.md`) — the record of
  someone looking at each screen beside its drawing. A matching drawing hash means only that the
  drawing has not changed since the look.
- **Organisation registry** (`docs/ward-flow/organisation/registry.json`) — which of six systems
  owns each file.
- **Mutation tooling** (`mutate.mjs`, `mutation-run.mjs`) — safe break-and-restore testing.

### 5.5 `scripts/ward-flow/` at a glance

Generators: `screen-map`, `mockup-manifest`, `owner-rulings-index`, `rules-index`,
`screen-verification`, `build-reference-*`. Checks: `check-doc-links`, `check-drawing-rules`,
`check-errata-freshness`, `check-live-state`, `check-source-control-chars`,
`check-text-size-floor`, `check-ward-legal-language`, `check-ward-reference`,
`check-clinical-governance-gate`. Dev: `dev-with-organisation`, `serve-mockups`,
`contact-sheet`, `organisation(-core)`. Visual audits (manual, Playwright): `audit-*`,
`adversarial-visual-audit`, `inspect-targets`, `test-drawer`, `verify-movement-horizon`,
`table-sweep`, `token-collision-scan`. Coordination: `chat-control`, `whois`, `role-map.py`,
`folded.sh`, `sync-lessons`, `audit-lessons`. The `audit/` subfolder is explicitly not part of
the fold gates.

---

## 6. Documentation and design drawings

### 6.1 Documents that are current

`docs/ward-flow/README.md` is the only entry point. The working set: `STATUS.md`,
`HOW-WE-WORK.md`, `../ward-flow-task-ledger.md`, `OWNER-RULINGS.md` (generated),
`SCREEN-DEFINITION-OF-DONE.md`, `SCREEN-VERIFICATION.md` (generated), `SCREEN-MAP.md`
(generated; "68 mockups · 44 routes · 29 screen folders"), `RULES.md` (generated),
`LOCAL-FIRST-RUN.md`, `OPEN-QUESTIONS.md` (top part only), `plans/README.md`.

**Superseded, with banners:** `HIGH-FIDELITY-DESIGN-TO-PRODUCTION-PLAYBOOK.md`,
`PARALLEL-MULTI-AGENT-BUILD-PLAYBOOK.md`, `NEW-CHAT-PROMPT.md`, `how-chats-talk-to-each-other.md`,
`START-HERE-ward-builder-four.md`, `START-LOCAL-CHAT.md`, `PROJECT-ISSUES.md`. About 40 further
top-level files are dated point-in-time notes (1–22 Sept). Large history folders: `plans/` 374
files, `lessons/` 209 (source of `RULES.md`), `archive/dated-notes/` 178, `sdd-rescued/` 81,
`handover/` + `handovers/` 34.

### 6.2 Design drawings (`docs/ward-flow/mockups/`, 140 files)

- **Design authority:** `WARD-FLOW-DESIGN-SYSTEM.md`, mirrored by
  `design-system-third-edition.html` and `ward-flow-digest.html`.
- **Authoritative screens:** the sixteen third-edition pages (Command, Delays, Movement,
  Capacity, Ward, Bed board, ED, Community team, Patient search, Patient Now, Search hub, Raise a
  referral, Statistics, and three statistics variants), eleven added 11 Sept (Handover, Add a
  patient, Referrals, Governance, Out of area, Service statistics, Transport officer, Alerts,
  Settings, On-call, Sign in), and seven more (Network, Wards, Discharges, Statistics overview,
  Statistics compare, Legal forms, Ward answer).
- **Reference only:** `patient-search-console`, `patient-search-working`,
  `sovereign-chrome-and-drawers-perfected`, `sovereign-sidebar-ultimate`,
  `settings-perfected-third-edition`. The routed Settings drawing is `settings-third-edition.html`.
- About 27 variation or experiment files (`*-perfected*`, `header-text-*`, `*-experiment`)
  are not design sources. (No `.bak` files exist at `ace8e9ee8d`; corrected.)
- `third-edition-kit/` (37 files) is the drawing checker toolchain. `MANIFEST.json` holds a
  hash per drawing.
- **No gate reads the drawings.** A fixed defect can be redrawn back into a drawing with nothing
  going red.
- `docs/ward-flow/design/` (68 files) is earlier design exploration; `design/prototypes/` is in
  `.prettierignore` on purpose.

### 6.3 Other generated tools

- `docs/ward-flow/journey/` (33 files): the Journey Explorer, the owner's chosen master tool for
  mapping behaviour (18 Sept). Built by `npm run ward:journey`, served by
  `node docs/ward-flow/journey/serve.mjs`.
- `docs/ward-flow/reference-data/` (17 files): the WA catchment, capacity and distance data pack
  with its provenance audit.

---

## 7. The shared project around Ward Flow

### 7.1 What Ward Flow borrows

| From outside Ward Flow                                                              | Ward files | What for                                                   |
| ----------------------------------------------------------------------------------- | ---------: | ---------------------------------------------------------- |
| `react`                                                                             |         84 | hooks                                                      |
| `next/link`, `next/navigation`, `next` types                                        | 49, 22, 36 | links, pathname, page metadata                             |
| `lucide-react`                                                                      |         26 | icons                                                      |
| `@/components/ui-primitives`                                                        |         14 | shared control recipes                                     |
| `@/lib/client-store-factory`                                                        |          7 | SSR-safe browser stores                                    |
| `@/lib/form-register`                                                               |          4 | legal form titles                                          |
| `@/components/ui/sheet`                                                             |          4 | drawers                                                    |
| `@/components/ui/missing-value`, `contextual-back-link`, `clinical-dashboard/brand` |     2 each | empty values, back links, brand mark (retired chrome only) |
| `@/components/ui/tooltip`, `ui/sheet-focus`                                         |     1 each | rail tooltips, dialog focus                                |

**Reverse direction:** no file in `src/` outside Ward Flow imports Ward Flow (grep re-checked).

### 7.2 The frame

- **`src/proxy.ts`** (no `middleware.ts`): blocks `/mockups` in production except the
  developer-gated prefixes, which include `/mockups/ward-flow` and `/mockups/ward-flow-sign-in`;
  sets the Ward Flow offline header after stripping any client copy.
- **`src/app/layout.tsx`:** with that header, the Supabase auth providers are **not mounted**.
- **`src/app/mockups/layout.tsx`:** 404 unless mockups are enabled
  (`mockupsEnabled()` in `src/lib/env.ts:475`) or the path is developer-gated.
- **Access:** open. The developer-key gate (`ward-flow-access-gate.tsx`) was removed 28 September 2026 at Josh's request; Ward Flow now opens with no developer key.
  Ward Flow never uses Supabase auth or `isDemoMode()`.
- **Neighbour routes:** `src/app/mockups/ward-flow-sign-in` and `ward-flow-digest` sit beside
  (not inside) `ward-flow`, so they get no rail or provider.
- **Config:** `next.config.ts` adds `noindex` to all `/mockups`; `tsconfig.json` has one alias
  `@/*`; ESLint's mockup exemptions cover `src/app/mockups/ward-flow/**` but **not**
  `src/components/ward-management/**`, which is held to production lint rules.
- **Server side:** zero Ward Flow references in `src/app/api/**` and `supabase/migrations/**`.

---

## 8. The rest of the project (PsychSift), at module level

### 8.1 Top-level folders (tracked files)

| Folder                                                |      Files | What it is                                                                          |
| ----------------------------------------------------- | ---------: | ----------------------------------------------------------------------------------- |
| `docs/`                                               |      3,835 | Runbooks, governance, decisions; `codebase-index.md` and `site-map.md` are the maps |
| `src/`                                                |      1,765 | The Next.js app                                                                     |
| `tests/`                                              |      1,741 | Vitest and Playwright, side by side (incl. Ward)                                    |
| `.claude/`                                            |        446 | Claude Code agents, skills, hooks, settings                                         |
| `scripts/`                                            |        358 | Ops, eval, reindex, CI gate scripts                                                 |
| `supabase/`                                           |        247 | 234 migrations, `schema.sql` mirror, 2 edge functions                               |
| `public/`                                             |        127 | Static assets                                                                       |
| `.agents/`                                            |         92 | Skill catalogue                                                                     |
| `.design-sync/`, `.cursor/`                           |     62, 58 | Design-system metadata; Cursor rules                                                |
| `.github/`                                            |         33 | 24 CI workflows, PR template                                                        |
| `worker/`                                             |         29 | Ingestion worker (Node + Python OCR)                                                |
| `eval/`, `data/`, `caring-contacts/`                  | 18, 16, 10 | Eval labs; committed clinical data snapshots; isolated Caring Contacts migrations   |
| `eslint-rules/`, `.githooks/`, `plugins/`, `mockups/` | 5, 2, 3, 1 | Lint rules, git hooks, Codex plugin, notes                                          |

### 8.2 `src/`

- **`src/app/`** — 262 `page.tsx` in total: 91 real product routes (the `(search-app)` group
  backing 17 modes: answer, documents, services, forms, favourites, differentials, DSM,
  specifiers, formulation, prescribing, tools, calculators, therapy compass, factsheets,
  dictionary, sources, on-call; plus Caring Contacts, privacy, safety plan, auth callback), 129
  design-scratch pages under `mockups/` (404 in production), and Ward Flow's 42.
- **`src/app/api/`** — 62 route files in 21 groups; largest are caring-contacts 14, documents
  12, ingestion 4.
- **`src/lib/`** (420 files) — `rag/` 38, `caring-contacts/` 36, `clinical-ask/` 14, `sources/`
  13, `developer-area/` 13 (hosts the Ward Flow path helpers), `supabase/` 9, `validation/` 9,
  `observability/` 9, `on-call/` 8, plus 254 flat modules (retrieval, ranking, answer
  verification, ingestion, chunking, source governance, env, privacy, clinical data).
- **`src/components/`** (597 files outside Ward Flow) — `clinical-dashboard/` 132 (the app shell),
  `caring-contacts/` 57, `ui/` 41, `therapy-compass/` 37, `care-plan/` 34, `document-viewer/` 26,
  and per-mode folders.

### 8.3 The two PsychSift flows

- **Answer:** `/api/answer` → `src/lib/rag/rag.ts` → hybrid retrieval RPCs (pgvector + text) →
  selection → ranking → OpenAI generation → verification → cited answer; falls back to a
  source-only answer when generation fails its checks. Protected surface: read
  `docs/rag-behaviour/` before touching.
- **Ingestion:** `/api/upload` → private storage + job row → `worker/` or the
  `indexing-v3-agent` edge function → extract, OCR, caption, chunk, embed → Postgres, with quality
  gates and atomic reindex.

### 8.4 Deploy and CI

In the historical PsychSift monorepo, Railway project `Database` and Supabase migrations deployed on push/merge to `main`.
**In `BigSimmo/Ward-Flow`**, Ward Flow deploys to its own dedicated Railway project `Ward Flow` with zero database connections, and follows the repository boundary rules in [`AGENTS.md`](../../../AGENTS.md).

---

## 9. Known gaps

⚠️ **The documents disagree about the current state, on the same day.** `STATUS.md` (committed,
25 Sept) says the top five structural defects are resolved. Two later audits say otherwise:

- `audit-2026-09-25-full-review.md` (committed, audited tip `3e38413195`): 72 ward test files
  failing (135 of 1,056 checks).
- `audit-2026-09-25-fresh-full.md` (**uncommitted**, written by another session, audited tip
  `13ce7b588b`): full ward suite 77 unexpected failing files (~172 of 1,033 tests); ESLint 96
  errors; TypeScript clean; browser check **not run** because the local server would not start.

This map did not run any suite, so it cannot settle which is right. The expected-reds list is
empty at this tip, so any failing ward test is unsanctioned. **Run the full ward suite before
trusting either verdict.**

### 9.1 Truthfulness of screens (from the uncommitted fresh audit, "confirmed in code, not checked in a browser")

Screens show things the data does not hold: handover can put the wrong patient against a real
movement; the ward drawer invents vitals; the bed board invents pods; people search invents legal
status, age and sex; the referral drawer shows a fake live search and non-existent wards; alerts
show the wrong identity for one movement; statistics and delays show uncomputed figures. The
22 Sept `audit-and-repair-report.md` found the same family of defect. None is recorded as fixed.

### 9.2 Engine rules

- Fixed: the 2 Sept finding that nothing stopped an unsuitable placement. Suitability gates now
  refuse unless a reason is recorded. A reducer-level proof for a judgement-only refusal was still
  missing on 6 Sept (`docs/outstanding-issues.md:165`).
- Open (fresh audit, uncommitted): locked-bed count drift, invented admissions on arrival,
  "no transport" closing a booked vehicle, bed release freeing the wrong bed, a catchment lookup
  that crashes on the word "constructor", mismatched secure-bed rules between referral and
  movement, weaker sex-mix rules, withdrawn arms kept on the worklist, broadcasts accepted
  without validation, and a seed person whose sex and gender contradict.
- Open P1 (4 Sept): sex and gender identity are one field and it drives bed matching.
- Open P1 (4 Sept): the "it suggests nothing" rule may have been reversed verbally, with the
  reversal written nowhere; affects medical-device classification.
- The "not enforced" comments in §2.6.

### 9.3 Screens against drawings

No test can see a mismatch; only looking can. `SCREEN-VERIFICATION.md` has rows marked stale
because drawings changed after the look, and the fresh audit says the looking is not refreshed to
this tip. Phone widths on Ward and Handover do not match their drawings (`STATUS.md`, 22 Sept).
Four screens have no entry in the design standard's screens index. A shared popover sits 125px
off-screen on phones in every published drawing.

### 9.4 Docs hygiene

`README.md` and `STATUS.md` still cite tip `8d1c7c1e00`, about 75 commits behind.
`STATUS.md` has broken characters (encoding damage). `OPEN-QUESTIONS.md` describes transport
booking as in progress although it is built. 25 doc links still unresolved (said to be
deliberate).

### 9.5 Before any real patient

Hard gates, all parked by the owner: Aboriginal cultural safety review (deferred, not to be
re-raised), medical device / TGA, clinical safety officer, privacy, WA legal advice on forms,
catchment data, post-incident review, and a fresh decision on internal patient codes. The
`governance/` folder holds internal drafts only, not the outside reviews.

---

## 10. How this map was made, and what it did not check

Seven read-only helpers (Sonnet, extraction) each surveyed one area; I re-checked the headline
facts myself against the tree: the reducer's size and case count, 97 event types, sessionStorage
key, the empty expected-reds list, the access gate in the layout, no outside importers of Ward
Flow, and `ward-teams.ts` having no importers.

**Not checked:** any test, build, lint or browser run; whether screens match drawings; live
Supabase or Railway state; every file in the large doc folders; the contents of all 635 ward
tests (grouped by name only). Figures are from tip `663a66484a` on 25 Sept 2026 and will drift.

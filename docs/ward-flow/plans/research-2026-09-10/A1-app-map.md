# A1 — Ward Flow app map

Source: `D:/Worktrees/Database/readonly-plan-20260910`, detached HEAD `20eb850792a7`, clean tree (verified `git status --short` empty). All findings **verified by reading source** unless marked "inferred."

## 1. Route table

Every `page.tsx` is a thin, non-`"use client"` wrapper (async only when it awaits a dynamic `params`); every screen component it renders carries `"use client"` (checked the first line of all 29 screen-component files — zero exceptions). **The split is uniform**: routing/param-decoding is server, every rendered screen is client.

| URL                                                 | Renders (file)                                                      | Server/Client                                | What it shows                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| `/mockups/ward-flow`                                | `CoordinatorScreen` (`coordinator/coordinator-screen.tsx`)          | page: server · screen: client                | Flow coordinator home: ED pressure, priority queue, network, shortlist   |
| `/mockups/ward-flow/network`                        | `WardModeWorkspace mode="network"` (`ward-management-modes.tsx`)    | server · client                              | Network diagram (`WardNetworkWorkspace`)                                 |
| `/mockups/ward-flow/governance`                     | `WardModeWorkspace mode="governance"`                               | server · client                              | AI-assurance/audit/boundary view (`GovernanceView`)                      |
| `/mockups/ward-flow/delays`                         | `DelaysScreen`                                                      | server · client                              | Why each waiting patient is waiting (merged queue+exceptions+escalation) |
| `/mockups/ward-flow/capacity`                       | `CapacityScreen`                                                    | server · client                              | Bed-state + capability (merged former "morning" board)                   |
| `/mockups/ward-flow/movements`                      | `MovementsScreen`                                                   | server · client                              | Six-stage movement board (merged former transport tracker)               |
| `/mockups/ward-flow/wards`                          | `WardIndex` (`wards/ward-index.tsx`)                                | server · client                              | Index of every ward by health service                                    |
| `/mockups/ward-flow/ward/[unitId]`                  | `WardScreen`, prop `unitId`                                         | page async (awaits `params`) · screen client | One ward's detail                                                        |
| `/mockups/ward-flow/board/[unitId]`                 | `WardBoard`, prop `unitId`                                          | async · client                               | One ward's bed tile board                                                |
| `/mockups/ward-flow/ed/[edId]`                      | `EdScreen`, prop `edId`                                             | async · client                               | One ED's detail                                                          |
| `/mockups/ward-flow/community`                      | `CommunityIndex`                                                    | server · client                              | Index of every community team                                            |
| `/mockups/ward-flow/community/[teamId]`             | `CommunityScreen`, prop `teamId`                                    | async · client                               | One community team                                                       |
| `/mockups/ward-flow/hub`                            | `HubScreen`                                                         | server · client                              | Cross-entity search hub with live preview pane                           |
| `/mockups/ward-flow/search`                         | `PatientSearchPage` (`search/patient-search.tsx`)                   | server · client                              | Find an open movement by id/dept/destination/stage/owner                 |
| `/mockups/ward-flow/discharges`                     | `DischargeBoard`                                                    | server · client                              | Discharge/egress board, blocked releases first                           |
| `/mockups/ward-flow/out-of-area`                    | `OutOfAreaBoard`                                                    | server · client                              | Out-of-area ledger                                                       |
| `/mockups/ward-flow/handover`                       | `HandoverPage`                                                      | server · client                              | Point-in-time printable shift handover                                   |
| `/mockups/ward-flow/referrals`                      | `ReferralBoard`                                                     | server · client                              | Referral board + full-network match view                                 |
| `/mockups/ward-flow/referrals/new`                  | `ReferralIntakeForm`                                                | server · client                              | Front-door referral intake                                               |
| `/mockups/ward-flow/people/new`                     | `AddPatientForm`                                                    | server · client                              | Front-door add-patient form                                              |
| `/mockups/ward-flow/people/[patientId]`             | `PersonScreen` or `WardMovementNotFound`, prop `patientId`          | async · client                               | One person's record; 404s if id doesn't start `PT-`                      |
| `/mockups/ward-flow/movements/[movementId]`         | `WardPatientWorkspace` or `WardMovementNotFound`, prop `movementId` | async · client                               | One movement's workspace; 404s if id doesn't start `WF-`                 |
| `/mockups/ward-flow/transport/officer`              | `OfficerScreen`                                                     | server · client                              | Transport officer phone view                                             |
| `/mockups/ward-flow/statistics`                     | `StatisticsScreen`                                                  | server · client                              | Coordinator statistics home                                              |
| `/mockups/ward-flow/statistics/overview`            | `StatisticsOverviewScreen`                                          | server · client                              | Whole-of-prototype statistics                                            |
| `/mockups/ward-flow/statistics/compare`             | `StatisticsCompareScreen`                                           | server · client                              | Ward/ED comparison chooser                                               |
| `/mockups/ward-flow/statistics/ward/[unitId]`       | `StatisticsWardScreen`, prop `unitId`                               | async · client                               | One ward's statistics                                                    |
| `/mockups/ward-flow/statistics/ed/[edId]`           | `StatisticsEdScreen`, prop `edId`                                   | async · client                               | One ED's statistics                                                      |
| `/mockups/ward-flow/statistics/service/[serviceId]` | `StatisticsServiceScreen`, prop `serviceId`                         | async · client                               | One health service's statistics                                          |
| `/mockups/ward-flow/statistics/community/[teamId]`  | `StatisticsCommunityScreen`, prop `teamId`                          | async · client                               | One community team's statistics                                          |

Redirect-only stubs (owner-approved merges, kept so old links/bookmarks don't 404):

| Route                              | Redirects to | File                         |
| ---------------------------------- | ------------ | ---------------------------- |
| `/mockups/ward-flow/constellation` | `/network`   | `constellation/page.tsx:114` |
| `/mockups/ward-flow/escalation`    | `/delays`    | `escalation/page.tsx:171`    |
| `/mockups/ward-flow/exceptions`    | `/delays`    | `exceptions/page.tsx:184`    |
| `/mockups/ward-flow/queue`         | `/delays`    | `queue/page.tsx:429`         |
| `/mockups/ward-flow/morning`       | `/capacity`  | `morning/page.tsx:248`       |
| `/mockups/ward-flow/transport`     | `/movements` | `transport/page.tsx:673`     |

Non-page files: `layout.tsx` (shell, §2), `error.tsx` + `ward-flow-error-panel.tsx` (boundary for 25 routes), `statistics/error.tsx` (nearer boundary for the 5 statistics routes).

## 2. The shell — verified by reading source

**Not one component — two layers.** `layout.tsx` (71 lines) mounts, in order: `DeveloperAreaGate` → `WardFlowProvider` → `WardGround` → `WardChromeHeader` → `WardShellHeader` → `{children}` (`src/app/mockups/ward-flow/layout.tsx:59-70`). That gives every route a sticky top header (`WardChromeHeader`, 193 lines, `ward-chrome-header.tsx`) and a place-name line (`WardShellHeader`, `ward-shell.tsx:63-76`) automatically.

**The side rail is NOT in the layout.** `ClinicalRail` (`ward-management-navigation.tsx:87-143`, 306 lines total) is exported from that one module and each screen mounts it itself. A raw `grep -rn "<ClinicalRail" src --include=*.tsx` currently returns 39 hits across 30 files — **do not quote that number as a fact**: 2 of those 30 files (`layout.tsx:37`, `ward-shell.tsx:26`) are _comment text_ quoting the grep command itself, not real mounts, and this exact count has already gone stale three times in the file's own history (26 → 35 → today's 39/30) — re-run the grep, don't trust a written figure, including this one. Confirmed real JSX mounts: `coordinator-screen.tsx:177` (`activeMode="command"`), `ward-management-modes.tsx:570` (governance/network), plus `ward-management-console.tsx`, `statistics-section-frame.tsx`, and ~25 more screen files — one per screen, not shared.

`ClinicalRail` itself renders three responsive shapes from one component (not three components): a phone top bar + `Sheet` drawer (`ward-management-navigation.tsx:92-107, 127-140`), a tablet/desktop icon-only rail (`WardIconRail`, lines 149-259), and — when the user has expanded it — a labelled panel (`WardSidebarNav`/`WardSidebarFooter` from `ward-sidebar-content.tsx`, lines 118-124). All three read the same `WARD_NAV`/`WARD_VIEWS` arrays, so there is one nav list, not several.

**Nav items, verbatim** (`ward-nav.ts`):

`WARD_VIEWS` (the "eight" views — really six today, lines 115-122):
`Command → /mockups/ward-flow` · `Network → /network` · `Delays → /delays` · `Capacity → /capacity` · `Movements → /movements` · `Governance → /governance`

`WARD_NAV` (lines 215-314, group `role` then `board`): `Statistics → /statistics` · `All wards → /wards` · `All community teams → /community` · `Ward — RPH Adult Secure → /ward/rph-adult-secure` (exampleOnly) · `Ward board — RPH Adult Secure → /board/rph-adult-secure` (exampleOnly) · `Officer → /transport/officer` · `Emergency department → /ed/peel-ed` (exampleOnly) · `Handover → /handover` · `Patient search → /search` · `Search hub → /hub` · `Discharges → /discharges` · `Referral board → /referrals` · `New referral → /referrals/new` · `Out of area → /out-of-area`.

Everything else (redirect stubs, `/statistics/overview`, `/statistics/compare`, `/people/new`) is deliberately **un-listed**, each with a one-line reason in `WARD_NAV_INTENTIONALLY_UNLISTED` (lines 346-401) — this map plus `WARD_NAV`/`WARD_VIEWS` is checked two-way by `tests/ward-nav.test.ts` against the real route tree.

**Other rail controls**, all mounted once inside `WardIconRail`'s bottom block (`ward-management-navigation.tsx:228-256`): `WardRoleSwitcher` (role-screen jump — Coordinator/Ward/Officer/ED), a link back to `/mockups/development` (`WARD_DEVELOPER_HUB_HREF`, the sandbox's one exit), and `WardDemoControls` (clock + scenario — see §3). **Search box**: `WardChromeSearch` (`ward-chrome-search.tsx:30-44`) lives in the top header, not the rail — one search box, identical on every role, only its scope-chip label changes. No theme toggle exists anywhere in this tree (not found by grep). No shared "shift" control beyond the demo clock.

**How the shell knows the current page**: every adaptive piece (`WardShellHeader`, `WardChromeHeader`, `useWardNavCounts`, `WardIconRail`'s role ordering) calls `usePathname()` directly and derives from it (`wardPlaceFor`/`wardPlaceIdFor` in `ward-place.ts`, `wardChromeRole` in `ward-chrome-role.ts`) — no prop is threaded down for "current route." `ClinicalRail`'s `activeMode` prop is the one exception, passed explicitly by each screen for its own highlight.

**Provider mount point**: `WardFlowProvider`, in `layout.tsx:62` only — nowhere else. `useWardFlow()` throws if called outside it (`ward-flow-provider.tsx:365`), by design ("conservative failure," same file).

## 3. State wiring — verified by reading source

- **Reducer + seed**: `src/components/ward-management/ward-flow-reducer.ts` (3,819 lines). Exports `wardFlowReducer` (line 897), `seedWardFlowState`/`seedWardFlowStateAt` (lines 439, 486).
- **Provider**: `src/components/ward-management/ward-flow-provider.tsx`. Exports `WardFlowProvider` (line 187) and the hook `useWardFlow()` (line 363).
- **Read**: a screen calls `const { movements, units, referrals, patients, admissions, now, dispatch, ... } = useWardFlow();` — context value shape at lines 52-106. Fields: `movements, units, referrals, rejections, bedReleases, leaveBeds, refreshRequests, inboxAcknowledgements, inboxCompletions, patients, admissions, now, dayZero, scenario, dispatch, focusMovementId, setFocusMovementId`.
- **Dispatch**: `dispatch(event)` where `event: WardFlowEvent` (union defined in `ward-flow-events.ts`). Every event carries a `role: WardFlowRole` (`"coordinator"|"ed"|"ward"|"officer"|"demo"|"community"`, `ward-flow-events.ts:40`); the reducer/`EVENT_ROLE` table authorizes or rejects by that role.
- **Persistence**: the domain state (movements/patients/referrals/etc.) does **not** persist to `localStorage` — it lives only in `useReducer` state, re-seeded from `seedWardFlowStateAt` on every mount (no `localStorage` reference anywhere in `ward-flow-reducer.ts` or `ward-flow-provider.tsx`). Three unrelated, narrower `localStorage` uses exist elsewhere: sidebar-collapsed preference (key `"ward-flow-sidebar-collapsed"`, `use-ward-sidebar-collapsed.ts:18`), the community index's "recently opened" strip (`community-index.tsx:538`), and the hub's browser memory (`hub-browser-memory.ts`).
- **Reset**: `WardDemoControls` (`ward-demo-controls.tsx`, mounted once in the rail) dispatches `{ type: "RESET_SCENARIO", role: "demo", now }` (line 70) → reducer case at `ward-flow-reducer.ts:936-937` calls `seedWardFlowStateAt(...)` again, discarding all in-session changes. `{ type: "SET_SCENARIO", ... }` (line 75) does the same but loads a different named night (`WARD_SCENARIOS`).
- **Clock**: `grep ADVANCE_CLOCK` hits: type declared `ward-flow-events.ts:331`, role table `ward-flow-events.ts:1214` (`ADVANCE_CLOCK: ["demo"]` — only the demo role may raise it), reducer case `ward-flow-reducer.ts:942-943` (`clockOffsetMinutes: state.clockOffsetMinutes + event.minutes`), dispatch site `ward-demo-controls.tsx:66` (`advance(15)`/`advance(60)` buttons, "+15 min"/"+1 hour"). The clock also free-runs: a 30-second `setInterval` in `ward-flow-provider.tsx:295` re-renders so elapsed wall-clock time shows, unless `initialNow` is pinned (tests/deterministic renders).

## 4. Cross-screen navigation — verified by reading source

Static same-app links (label text omitted where obvious): rail brand/home links to `/mockups/ward-flow` from three files (`ward-management-navigation.tsx:94,170`, `ward-sidebar-content.tsx:86`); `ward-chrome-header.tsx:160` and `160` link Handover; `community-screen.tsx:899,909` link the community index and referral board; `handover-page.tsx:349` and `morning-page.tsx:692` (the **parked, unreachable** component — see §7) cross-link handover/capacity; `person-screen.tsx:167` links patient search.

Id-carrying links (dynamic, via template literal or a named `*Href` builder):

| From (file:line)                                                                                                                                                                                  | To pattern                                      | Carries                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------- |
| `delays-screen.tsx:905`                                                                                                                                                                           | `/ward/${id}`                                   | unit id                                      |
| `ed-home.tsx:205`, `ed-service-bands.tsx:94`                                                                                                                                                      | `/ed/${id}`                                     | ED id                                        |
| `movements-screen.tsx:301,371`, `search/patient-search.tsx:662`, `record-preview.tsx:246,276`, `tracker/live-tracker.tsx:167`, `ward-management-network.tsx:1276`, `ward-sidebar-content.tsx:257` | `/movements/${id}`                              | movement id                                  |
| `search/patient-search.tsx:462`, `record-preview.tsx:215,294`, `ward-global-search.tsx:117` (`personHref`)                                                                                        | `/people/${id}`                                 | patient id                                   |
| `person-screen.tsx:260`                                                                                                                                                                           | `/referrals/new?patientId=${id}`                | patient id, as query param                   |
| `ward-role-switcher.tsx:195`                                                                                                                                                                      | `/ward/${id}`                                   | unit id (role-switch target)                 |
| `ward-role-switcher.tsx:227`                                                                                                                                                                      | `/ed/${id}`                                     | ED id (role-switch target)                   |
| `ward/ward-screen.tsx:852`                                                                                                                                                                        | `/board/${id}`                                  | unit id                                      |
| `wards/ward-index.tsx:254`                                                                                                                                                                        | `/ward/${id}`                                   | unit id                                      |
| `community-screen.tsx:1192` (`communityTeamHref`)                                                                                                                                                 | `/community/${id}`                              | team id                                      |
| `statistics-sections.ts:199,204,222,239` (`wardStatisticsHref`/`edStatisticsHref`/`serviceStatisticsHref`/`communityStatisticsHref`)                                                              | `/statistics/{ward,ed,service,community}/${id}` | respective id, `encodeURIComponent`-wrapped  |
| `ward-management-console.tsx:712,722` (not-found recovery links)                                                                                                                                  | `/movements/${id}` / `/people/${id}`            | the mistyped id, offered as the _other_ kind |

`router.push` (imperative navigation, not a `<Link>`): `hub-screen.tsx:199` (hub search jump), `patients/add-patient.tsx:281` (after adding a patient, jumps to their new `/people/${id}`), `ward-chrome-header.tsx:114` (opening a task from the tasks drawer), `ward-global-search.tsx:241` (global search result), `ward-tasks-panel.tsx:46`.

**Routes with no inbound app link found in this pass**: none among the 28 real routes — each is either in `WARD_NAV`/`WARD_VIEWS` or in `WARD_NAV_INTENTIONALLY_UNLISTED` with a named in-page link (e.g. `/statistics/overview`/`/compare` link from the statistics hub, not the rail). This two-way property is enforced by `tests/ward-nav.test.ts` — not independently re-verified here, see NOT CHECKED.

## 5. Component directory inventory (`src/components/ward-management/**`) — inferred from filenames/comments

| Dir            | Purpose (inferred)                                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `board/`       | The per-ward bed-tile board (`ward-board.tsx`) and a daily sheet variant                                                                                                                               |
| `capacity/`    | Bed-state/capability screen + its derivations + bed-map visual                                                                                                                                         |
| `community/`   | Community-team index, hub, screen, table, and their derivations/vocabulary                                                                                                                             |
| `coordinator/` | The root Command screen: flow diagram, pressure strip, priority queue, exception drawer, shortlist panel                                                                                               |
| `delays/`      | The merged "why still waiting" board + derivations                                                                                                                                                     |
| `discharges/`  | Discharge/egress board                                                                                                                                                                                 |
| `ed/`          | ED home + per-department screen + service-band visuals                                                                                                                                                 |
| `escalation/`  | `escalation-board.tsx` — still imported by `delays-screen.tsx`, `referral-board.tsx`, `patient-search.tsx` etc.; folded conceptually into Delays but its module still supplies shared logic (not dead) |
| `handover/`    | Printable shift-handover page                                                                                                                                                                          |
| `hub/`         | Cross-entity search hub, its derivations, and browser-memory (recents)                                                                                                                                 |
| `morning/`     | **Parked/unreachable** — `morning-page.tsx` self-documents as unmounted since the capacity merge (§7); `morning-tour.tsx` is its companion walkthrough                                                 |
| `movements/`   | The six-stage movement board + derivations                                                                                                                                                             |
| `officer/`     | Transport-officer phone screen                                                                                                                                                                         |
| `out-of-area/` | Out-of-area ledger board                                                                                                                                                                               |
| `patients/`    | Add-patient form, person (record) screen                                                                                                                                                               |
| `referrals/`   | Referral board, intake form, destination-matching logic                                                                                                                                                |
| `search/`      | Patient/movement search page, typeahead, result-preview panel                                                                                                                                          |
| `statistics/`  | Nine-plus files: the statistics home, per-scope screens (ward/ED/service/community), the shared section frame/disclaimers/derivations                                                                  |
| `tracker/`     | `live-tracker.tsx` — **parked/unreachable** since the movements merge (§7), same pattern as `morning/`                                                                                                 |
| `ward/`        | Single-ward detail screen                                                                                                                                                                              |
| `ward-table/`  | A reusable ward-row table component (inferred — used by index/board screens)                                                                                                                           |
| `wards/`       | Ward index; `ward-overview.module.css` present with **no matching `.tsx`** — self-documented in `ward-index.tsx:83` as "unused, kept pending [a reversion] decision rather than deleted"               |

Plus ~45 flat files directly under `ward-management/` (not in a subdirectory): the reducer, provider, events, nav, shell, chrome-header, sidebar-content, navigation (`ClinicalRail`), demo-controls, role-switcher, global-search, clock, model/derivation/eligibility/pressure/priority modules, and two standalone registers (`decline-register.tsx`, `override-register.tsx`, inferred as audit-trail displays for declined/overridden decisions).

## 6. Reachability, demo mode, bundle-budget exemptions — verified by reading source

- **Base path**: `/mockups/ward-flow/**`, an ordinary Next.js App Router tree — no special base-path rewriting found.
- **Demo mode**: **no dependency**. `grep -rl isDemoMode src/components/ward-management src/app/mockups/ward-flow` returns nothing — Ward Flow seeds its own synthetic world (`seedWardFlowStateAt`) regardless of Supabase/OpenAI env, unlike the rest of the app's `isDemoMode()` fallback.
- **Access gate**: `layout.tsx:61` wraps everything in `DeveloperAreaGate` (`src/components/developer-area/developer-area-gate.tsx`, async server component). In production this requires a signed-in administrator (`resolveDeveloperAccessState`) and shows a sign-in/access-denied screen otherwise; **outside production it is a no-op** ("matching every other /mockups/* route"). A double-flag bypass (`PLAYWRIGHT_OFFLINE_MODE=true` + `NEXT_PUBLIC_MOCKUPS_ENABLED=true`) exists solely for the isolated Playwright production build.
- **Bundle-budget/wiring exemptions** (`docs/agents/wiring-and-bundle-budget.md`, verbatim): mockups (including `src/app/mockups/**`) are exempt from `require-button-wiring.mjs`, `tests/route-reachability.test.ts`, `no-hardcoded-hex`, `require-z-index-ladder`, `require-lucide-icon-aria`, `check:icon-scale`, `check:design-system-contract`, and the required Playwright lane (mockup specs carry `@mockup`, excluded from the `chromium` project). They are **not** exempt from CodeRabbit review, typechecking, or `check:bundle-budget` (measured against a separate 25%-tolerance `mockups` bucket, not the 10%-tolerance `production` one). The doc explicitly names `/mockups/ward-flow` as "live in production behind `DeveloperAreaGate`" and "never a cleanup candidate."
- **`src/lib/ward-output.ts` is unrelated** — see §7.

## 7. Defects/notable patterns noticed in passing — evidence only

1. **Three different "role" types, easy to conflate**: `WardFlowRole` (`ward-flow-events.ts:40`, 6 values, gates which reducer events a caller may raise), `WardChromeRole` (`ward-chrome-role.ts:20`, 3 values, drives header/rail adaptation from the current path), and `WardRole` (`ward-derivations.ts:58`, 3 different values `"flow"|"ed"|"ward"`, purely local `useState` on the two `WardModeWorkspace` screens). Same domain, three names, three value sets — a new screen reaching for "the role" has three plausible, non-interchangeable answers.
2. **The rail is per-screen, not shared layout** (§2) — a known, load-bearing choice (comments call out that `ClinicalRail` "goes missing from whichever screen forgot it"), not a bug, but it means each of the 16 planned screens must remember to mount it; only a dedicated test (`tests/ward-component-reachability.test.ts`, not opened here) would catch an omission.
3. **`morning/morning-page.tsx` and `tracker/live-tracker.tsx` are self-documented dead components** — each opens with a `🔴 THIS COMPONENT IS UNREACHABLE` comment (owner ruling 2026-09-06, parked not deleted per `docs/agents/dead-code-deletion.md`). Announced, not hidden — but a planner should not treat "file exists under ward-management/" as proof a screen is live. Same pattern, smaller: `wards/ward-overview.module.css` has no matching component (`ward-index.tsx:83`).
4. **`src/lib/ward-output.ts` is a false lead for "the one ward file under `src/lib`."** It formats clinical RAG answers as a "ward note" (a medical documentation term) — `formatWardNote`, `buildClinicalOutputSections` — with zero import relationship to Ward Flow (`grep -rl ward-output src/components/ward-management src/app/mockups/ward-flow` → no matches). Ward Flow's only two `@/lib` imports are `client-store-factory` and `form-register`.
5. **`WardModeWorkspace` screens (`/network`, `/governance`) carry a second, page-local header** (`ModeHeader`, `ward-management-modes.tsx:116-172`) alongside the shared `WardChromeHeader`/`WardShellHeader` — already reconciled in CSS (the duplicate brand mark hides when the labelled sidebar panel is open) but still a second header component, not the same one reused.

## PROVEN BY READING

Full route tree and every `page.tsx`/`layout.tsx`/`error.tsx` under `src/app/mockups/ward-flow`; client/server split for all 29 screen components (checked directly); `ward-nav.ts` nav lists verbatim; provider context shape, `useWardFlow` export, clock/reset dispatch sites and reducer cases; all `localStorage` keys in this tree; every static and id-carrying `Link`/`router.push` between ward-flow routes found by grep; `DeveloperAreaGate` mechanics; the wiring/bundle-budget mockup-exemption paragraph verbatim; `src/lib/ward-output.ts`'s lack of relationship to Ward Flow.

## NOT CHECKED

`tests/ward-nav.test.ts`, `tests/ward-component-reachability.test.ts`, `tests/route-reachability.test.ts` themselves (relied on source comments describing them, did not open and re-verify their assertions); the 3,819-line reducer beyond cited cases; `ward-management-console.tsx`/`ward-flow-events.ts` beyond lines quoted; whether every one of the 39 raw `<ClinicalRail` grep hits is a real mount (spot-checked several; 2 of 30 files were comment-only); CSS/visual behaviour; any test's pass/fail state.

## QUESTIONS

1. For the 16 new screens: should each mount `<ClinicalRail activeMode=.../>` itself (matching all 28 existing screens), or is centralising the rail into `layout.tsx` now in scope — the codebase's own comments flag the per-screen approach as the source of "goes missing from whichever screen forgot it," and 16 new call sites is a natural point to reconsider that.
2. Do any of the 16 new screens need a genuinely new "role" concept, and if so, should it reuse `WardFlowRole`, `WardChromeRole`, or neither — given three already exist with overlapping names and different value sets (§7.1)?
3. Is `WARD_MODES`/`WARD_VIEWS` (the six coordinator "lenses") meant to grow for any of the 16, or do they all belong in `WARD_NAV`'s `board` group instead (the hub/hand-over/discharges precedent)? This is a judgement call the brief's own two-way nav-test convention doesn't resolve by itself.

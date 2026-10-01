# Routes, shell, navigation and shared UI

Read-only map, written 25 September 2026 against tip `ace8e9ee8d` on branch
`ward/extend-ward-flow-code-map` (`D:/Worktrees/Database/ward-code-map`). Covers every tracked file
under `src/app/mockups/ward-flow/`, `src/app/mockups/ward-flow-sign-in/`,
`src/app/mockups/ward-flow-digest/` and `src/app/ward-flow-shell-tokens.module.css` (§1); every file
in `src/components/ward-management/shell/` and `.../ward-table/` (§2–3); and every root-level
`.tsx`/`.module.css` file in `src/components/ward-management/` plus the seven root `.ts` files named
in this part's brief (`ward-nav.ts`, `ward-nav-counts.ts`, `ward-nav-icons.ts`,
`ward-nav-role-order.ts`, `use-ward-nav-counts.ts`, `use-ward-sidebar-collapsed.ts`,
`use-printable-disclosures.ts`) (§4). `ward-flow-provider.tsx` is out of scope here — it is covered
by [Engine](engine.md). Line counts are `wc -l`. Every importer count was measured for this map by
`grep -rlE 'from ["'"'"'][^"'"'"']*/<name>["'"'"']'` over `src/` (and, where noted, `tests/`), read from the
raw match list rather than the grep count alone — a naive path-suffix grep for `ward-bar` also
matches `shell/ward-bar`, and that collision was checked and removed by hand for every file where it
mattered. Nothing was run except reads, `grep`, `wc` and `git ls-files`. Back to
[the code map index](README.md).

---

## 1. Routes (`src/app/mockups/ward-flow/`, `ward-flow-sign-in/`, `ward-flow-digest/`)

### 1.1 The layout chain

Every request under `/mockups/ward-flow/**` passes through one server layout before reaching a
screen:

```
src/app/mockups/ward-flow/layout.tsx  (WardFlowMockupLayout, a Server Component)
  <WardFlowProvider>                   the engine — see Engine
    <WardLiveRegion />                 the shell's one aria-live announcer
    <div className={styles.shellRow}>
      <WardRail />                     left rail
      <div className={styles.shellContent}>
        <WardBarMount />               resolves the route's primary action, then renders <WardBar>
        <WardBroadcastBanner />
        <WardGround>{children}</WardGround>   plain wrapper div; {children} is the routed page
      </div>
    </div>
  </WardFlowProvider>
```

`/mockups/ward-flow-sign-in` and `/mockups/ward-flow-digest` are **siblings** of `/mockups/ward-flow`,
not children — they have no `layout.tsx` of their own beneath the app root, so neither the access
gate, the provider nor any shell component wraps them. `ward-flow-sign-in/page.tsx`'s own doc
comment states this is deliberate: a person who has not signed in "has no rail to stand in and no bar
to read" (owner ruling, 10 September 2026).

### 1.2 Route table

Every `page.tsx` is a bullet in §1.4 below; this table is the URL-first view. "Screen" is the
component the page renders; its file is named once in §1.4 rather than repeated per row.

| URL under `/mockups/ward-flow`    | Screen                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| `/`                               | `CoordinatorScreen`                                                                             |
| `/alerts`                         | `AlertsScreen`                                                                                  |
| `/board/[unitId]`                 | `WardBoard`                                                                                     |
| `/capacity`                       | `CapacityScreen`                                                                                |
| `/community`                      | `CommunityIndex`                                                                                |
| `/community/[teamId]`             | `CommunityScreen`                                                                               |
| `/constellation`                  | redirect → `/network`                                                                           |
| `/delays`                         | `DelaysScreen`                                                                                  |
| `/discharges`                     | `DischargeBoard`                                                                                |
| `/ed`                             | redirect → `/ed/fremantle-ed`                                                                   |
| `/ed/[edId]`                      | `EdScreen`                                                                                      |
| `/escalation`                     | redirect → `/delays?from=escalation`                                                            |
| `/exceptions`                     | redirect → `/delays?from=exceptions`                                                            |
| `/governance`                     | `WardModeWorkspace` mode `"governance"` → `GovernanceWorkbench`                                 |
| `/handover`                       | `HandoverPage`                                                                                  |
| `/hub`                            | `HubScreen`                                                                                     |
| `/legal-forms`                    | `LegalFormsScreen`                                                                              |
| `/movements`                      | `MovementsScreen`                                                                               |
| `/movements/[movementId]`         | `WardPatientWorkspace` (or `WardMovementNotFound`)                                              |
| `/network`                        | `WardModeWorkspace` mode `"network"` → `WardNetworkWorkspace`                                   |
| `/on-call`                        | `OnCallScreen`                                                                                  |
| `/out-of-area`                    | `OutOfAreaBoard`                                                                                |
| `/people/[patientId]`             | `PatientNowScreen`, or `PersonScreen` with `?view=governed`/`legacy`, or `WardMovementNotFound` |
| `/people/new`                     | `AddPatientForm`                                                                                |
| `/queue`                          | redirect → `/delays?from=queue`                                                                 |
| `/referrals`                      | `ReferralBoard`                                                                                 |
| `/referrals/new`                  | `ReferralIntakeForm`                                                                            |
| `/search`                         | `PatientSearchPage`                                                                             |
| `/settings`                       | `SettingsScreen`                                                                                |
| `/sovereign`                      | `SovereignShowcaseScreen`                                                                       |
| `/statistics`                     | `StatisticsScreen`                                                                              |
| `/statistics/community/[teamId]`  | `StatisticsCommunityScreen`                                                                     |
| `/statistics/compare`             | `StatisticsCompareScreen`                                                                       |
| `/statistics/ed/[edId]`           | `StatisticsEdScreen`                                                                            |
| `/statistics/overview`            | `StatisticsOverviewScreen`                                                                      |
| `/statistics/service/[serviceId]` | `StatisticsServiceScreen`                                                                       |
| `/statistics/ward/[unitId]`       | `StatisticsWardScreen`                                                                          |
| `/transport`                      | redirect → `/movements`                                                                         |
| `/transport/officer`              | `OfficerScreen`                                                                                 |
| `/ward/[unitId]`                  | `WardScreen`                                                                                    |
| `/ward/[unitId]/answer`           | `WardScreen` (`presentation="answer"`)                                                          |
| `/wards`                          | `WardIndex`                                                                                     |

`/mockups/ward-flow-sign-in`: `WardFlowSignInScreen`. `/mockups/ward-flow-digest`: not a page — a
route handler (`GET`) that streams `docs/ward-flow/mockups/ward-flow-digest.html` back verbatim.

**Six redirect stubs**, all `redirect()` from a Server Component with no UI of their own:
`constellation` → `/network`; `ed` → `/ed/fremantle-ed`; `escalation`, `exceptions`, `queue` → each
its own `/delays?from=<name>` (Delays reads that query param to show an alias banner); `transport` →
`/movements`. `transport/officer` is a separate, nested route unaffected by the `transport` redirect.

### 1.3 Error and loading boundaries

Three `error.tsx` files, one `loading.tsx`, and no `not-found.tsx` under this tree:

- `src/app/mockups/ward-flow/error.tsx` — the outer boundary. Wraps every route in the tree except
  the five `statistics/**` routes (which have their own nearer boundary) and the `sovereign/` pair
  (which have their own). It **cannot** catch a throw from `layout.tsx` itself (the provider's
  `useReducer` initialiser, or a module-scope throw in `ward-movements.ts`'s seed construction) —
  those still escape to the app-wide `src/app/error.tsx`.
- `src/app/mockups/ward-flow/statistics/error.tsx` — the nearer boundary for the five statistics
  routes. Exists because six of the prototype's render guards (five "section no longer defined"
  checks plus `admissionStagePosition`'s `default:` arm) live only there, so `retry()` re-renders
  just that segment and the message can name what failed.
- `src/app/mockups/ward-flow/sovereign/error.tsx` and `sovereign/loading.tsx` — a self-contained
  pair for the one showcase route, styled from `sovereign-showcase.module.css` rather than
  `WardFlowErrorPanel`.
- `src/app/mockups/ward-flow/ward-flow-error-panel.tsx` — the shared recovery UI the first two
  boundaries both render (`WardFlowErrorPanel`), deliberately **not** the repository's generic
  `@/components/route-error-boundary`: `tests/ward-flow-seam.test.ts` caps Ward Flow's outward
  dependencies at seven approved shared modules, so the panel markup is duplicated here rather than
  importing an eighth.

### 1.4 Files

- **`src/app/mockups/ward-flow/page.tsx`** (13 lines) — `/`. Renders `CoordinatorScreen`
  (`@/components/ward-management/coordinator/coordinator-screen`).
- **`src/app/mockups/ward-flow/layout.tsx`** (120 lines) — `WardFlowMockupLayout`, the Server
  Component that mounts the whole shell (see §1.1). Its doc comment is the authoritative history of
  the second-edition-to-third-edition chrome retirement (Task 8, 2026-09-11) — most of the file's
  length is that record, not code.
- **`src/app/mockups/ward-flow/ward-flow-layout.module.css`** (50 lines) — `.shellRow`/
  `.shellContent`, the flex-row ancestor `WardRail` needs to size itself against; composes
  `wardShellTokens` from `../../ward-flow-shell-tokens.module.css`. Switches to a column below
  1000px, matching `ward-rail.module.css`'s own breakpoint exactly (must stay in sync by hand).
- **`src/app/mockups/ward-flow/ward-flow-error-panel.tsx`** (153 lines) — `WardFlowErrorPanel`, the
  shared error-boundary body (see §1.3). Renders the error message and, in development, the stack,
  behind a `<details>`. Imported by `error.tsx` and `statistics/error.tsx` only.
- **`src/app/mockups/ward-flow/error.tsx`** (56 lines) — the outer error boundary. See §1.3.
- **`src/app/mockups/ward-flow/statistics/error.tsx`** (41 lines) — the nearer statistics boundary.
  See §1.3.
- **`src/app/mockups/ward-flow/sovereign/error.tsx`** (32 lines) — self-contained boundary for the
  showcase route; does not use `WardFlowErrorPanel`.
- **`src/app/mockups/ward-flow/sovereign/loading.tsx`** (26 lines) — skeleton loading state for the
  showcase route.
- **`src/app/mockups/ward-flow/alerts/page.tsx`** (13) — `/alerts` → `AlertsScreen`.
- **`src/app/mockups/ward-flow/board/[unitId]/page.tsx`** (14) — `/board/[unitId]` → `WardBoard`.
- **`src/app/mockups/ward-flow/capacity/page.tsx`** (19) — `/capacity` → `CapacityScreen`. Doc
  comment records that this screen absorbed the former bed-state view and the retired "morning" page
  (MERGE 02, then owner answer 41 retired the redirect outright).
- **`src/app/mockups/ward-flow/community/page.tsx`** (32) — `/community` → `CommunityIndex`. Doc
  comment is explicit this is the parent route of `[teamId]` on purpose (deleting a team id from the
  URL should land on a list, not a 404) and that it is a real, linked nav entry, not a leftover.
- **`src/app/mockups/ward-flow/community/[teamId]/page.tsx`** (22) — `/community/[teamId]` →
  `CommunityScreen`; `generateMetadata` resolves the team name via `communityTeamById`.
- **`src/app/mockups/ward-flow/constellation/page.tsx`** (10) — redirect → `/network`.
- **`src/app/mockups/ward-flow/delays/page.tsx`** (13) — `/delays` → `DelaysScreen`.
- **`src/app/mockups/ward-flow/discharges/page.tsx`** (12) — `/discharges` → `DischargeBoard`.
- **`src/app/mockups/ward-flow/ed/page.tsx`** (12) — redirect → `/ed/fremantle-ed`.
- **`src/app/mockups/ward-flow/ed/[edId]/page.tsx`** (24) — `/ed/[edId]` → `EdScreen`;
  `generateMetadata` resolves the department name via `edById`.
- **`src/app/mockups/ward-flow/escalation/page.tsx`** (13) — redirect → `/delays?from=escalation`.
- **`src/app/mockups/ward-flow/exceptions/page.tsx`** (13) — redirect → `/delays?from=exceptions`.
- **`src/app/mockups/ward-flow/governance/page.tsx`** (12) — `/governance` → `WardModeWorkspace
mode="governance"`.
- **`src/app/mockups/ward-flow/handover/page.tsx`** (12) — `/handover` → `HandoverPage`.
- **`src/app/mockups/ward-flow/hub/page.tsx`** (13) — `/hub` → `HubScreen`.
- **`src/app/mockups/ward-flow/legal-forms/page.tsx`** (13) — `/legal-forms` → `LegalFormsScreen`.
- **`src/app/mockups/ward-flow/movements/page.tsx`** (12) — `/movements` → `MovementsScreen`.
- **`src/app/mockups/ward-flow/movements/[movementId]/page.tsx`** (41) — `/movements/[movementId]`
  → `WardPatientWorkspace`, or `WardMovementNotFound` when the segment does not start with `WF-`.
  Doc comment records a fixed defect: the old cast happened before the `startsWith` check and let a
  bare `"WF-"` sentinel satisfy the `MovementId` template-literal type, so a wrong-shaped id like
  `PT-004` was echoed back quoted as `"WF-"` rather than as the text actually typed.
- **`src/app/mockups/ward-flow/network/page.tsx`** (13) — `/network` → `WardModeWorkspace
mode="network"`.
- **`src/app/mockups/ward-flow/on-call/page.tsx`** (24) — `/on-call` → `OnCallScreen`. Doc comment
  warns this is unrelated to PsychSift's own `(search-app)/on-call` mode and to
  `caring-contacts/team-roster.tsx` — three unrelated "on-call" surfaces in one repository, none a
  source of staff data for the others.
- **`src/app/mockups/ward-flow/out-of-area/page.tsx`** (13) — `/out-of-area` → `OutOfAreaBoard`.
- **`src/app/mockups/ward-flow/people/new/page.tsx`** (12) — `/people/new` → `AddPatientForm`.
- **`src/app/mockups/ward-flow/people/[patientId]/page.tsx`** (62) — `/people/[patientId]`.
  `?view=governed` or `?view=legacy` → `PersonScreen`; otherwise → `PatientNowScreen` (a `PT-`
  prefix is passed as `patientId`, a `WF-` prefix as `movementId`); an id starting with neither →
  `WardMovementNotFound`. Doc comment: deliberately `/people/`, not `/patients/`, because the old
  `/patients/[patientId]` route actually looked a _Movement_ up by id.
- **`src/app/mockups/ward-flow/queue/page.tsx`** (13) — redirect → `/delays?from=queue`.
- **`src/app/mockups/ward-flow/referrals/page.tsx`** (13) — `/referrals` → `ReferralBoard
defaultSelectFirst`.
- **`src/app/mockups/ward-flow/referrals/new/page.tsx`** (12) — `/referrals/new` →
  `ReferralIntakeForm`.
- **`src/app/mockups/ward-flow/search/page.tsx`** (12) — `/search` → `PatientSearchPage`.
- **`src/app/mockups/ward-flow/settings/page.tsx`** (13) — `/settings` → `SettingsScreen`.
- **`src/app/mockups/ward-flow/sovereign/page.tsx`** (12) — `/sovereign` →
  `SovereignShowcaseScreen`.
- **`src/app/mockups/ward-flow/statistics/page.tsx`** (25) — `/statistics` → `StatisticsScreen`.
  Doc comment: the screen must never be passed `admissions`/`referrals`/`bedReleases`/`movements` —
  those are test-only override props, and passing them from the route would silently pin a live
  figure to a fixture.
- **`src/app/mockups/ward-flow/statistics/community/[teamId]/page.tsx`** (23) —
  `/statistics/community/[teamId]` → `StatisticsCommunityScreen`.
- **`src/app/mockups/ward-flow/statistics/compare/page.tsx`** (21) — `/statistics/compare` →
  `StatisticsCompareScreen`; must never be passed `units`/`emergencyDepartments` overrides, for the
  same fixture-pinning reason as above.
- **`src/app/mockups/ward-flow/statistics/ed/[edId]/page.tsx`** (23) — `/statistics/ed/[edId]` →
  `StatisticsEdScreen`.
- **`src/app/mockups/ward-flow/statistics/overview/page.tsx`** (17) — `/statistics/overview` →
  `StatisticsOverviewScreen`.
- **`src/app/mockups/ward-flow/statistics/service/[serviceId]/page.tsx`** (23) —
  `/statistics/service/[serviceId]` → `StatisticsServiceScreen`.
- **`src/app/mockups/ward-flow/statistics/ward/[unitId]/page.tsx`** (24) —
  `/statistics/ward/[unitId]` → `StatisticsWardScreen`; must never be passed a `units` override.
- **`src/app/mockups/ward-flow/transport/page.tsx`** (18) — redirect → `/movements`.
- **`src/app/mockups/ward-flow/transport/officer/page.tsx`** (12) — `/transport/officer` →
  `OfficerScreen`.
- **`src/app/mockups/ward-flow/ward/[unitId]/page.tsx`** (36) — `/ward/[unitId]` → `WardScreen`.
  `generateMetadata` resolves the unit's name from the frozen `ward-sites.ts` fixture rather than
  the live provider (metadata generation runs on the server; `useWardFlow()` is client state) — the
  file's own comment says this is safe because a unit's _name_ is never reducer-written, so the two
  sources cannot disagree.
- **`src/app/mockups/ward-flow/ward/[unitId]/answer/page.tsx`** (17) — `/ward/[unitId]/answer` →
  `WardScreen unitId presentation="answer"`.
- **`src/app/mockups/ward-flow/wards/page.tsx`** (13) — `/wards` → `WardIndex`.
- **`src/app/mockups/ward-flow-sign-in/page.tsx`** (21) — `/mockups/ward-flow-sign-in`, a sibling
  route with no shell (§1.1). Renders `WardFlowSignInScreen`
  (`@/components/ward-flow-sign-in/ward-flow-sign-in-screen`, outside this part's scope).
- **`src/app/mockups/ward-flow-digest/route.ts`** (11) — `GET /mockups/ward-flow-digest`, a route
  handler (not a page) that reads and streams back `docs/ward-flow/mockups/ward-flow-digest.html`
  verbatim, "without a second, drifting copy."
- **`src/app/ward-flow-shell-tokens.module.css`** (456 lines) — the third-edition token layer:
  every CSS custom property the sixteen third-edition screens and the shell components paint with,
  copied verbatim from the approved drawing's own `:root` block. Lives under `src/app/`, **not**
  under `src/components/ward-management/`, specifically so `tests/ward-raw-colour.test.ts` (which
  walks only the latter, recursively, forbidding any literal hex/`rgb()`/`hsl()`) does not have to
  make an exception for it — this file's whole job is to declare that raw colour once. Composed
  directly by ~39 files (`grep`, this map): every third-edition screen module, plus
  `shell/ward-bar.module.css`, `shell/ward-rail.module.css`,
  `shell/ward-reconciliation-line.module.css`, `shell/ward-service-scope-bar.module.css` and
  `ward-flow-layout.module.css`. A few names it declares (`--surface`, `--danger`) collide in NAME
  only with `globals.css`/`ckb-v2-tokens.css` — harmless, because every rule here is scoped under
  `.wardShellTokens`, which only that element and its descendants ever resolve against.

---

## 2. Shell (`src/components/ward-management/shell/`)

The "third-edition" chrome, mounted once by `layout.tsx` (§1.1) — see §5, "How a screen gets its chrome," below
for the exact mount order. 23 tracked files (11 `.tsx`/`.ts` component/logic pairs plus their CSS
modules, plus five logic-only `.ts` files and one CSS-only stub).

- **`shell/ward-bar.tsx`** (1,584 lines) — the top bar: place/route title, the Service selector
  (scopes lists to one `HealthService`, `sessionStorage`-backed via `ward-service-store.ts`), search
  (reuses `WardGlobalSearch`), three `<Sheet>` drawers (Activity — a derived event feed and page
  tally; Tasks — `WardTasksDrawer` fed by `buildActionInbox`; Tools — demonstration controls, role
  switcher, ward/ED contact tables), and the bar's one primary action
  (`resolveWardPrimaryAction`/`WARD_PRIMARY_ACTIONS` from `ward-nav.ts`). Key exports: `WardBar`,
  `WardBarClock`, `WardBarMount` (the route-aware wrapper `layout.tsx` actually mounts —
  see §5), `useAppearanceStore`/`applyAppearance` (the one light/dark/auto preference writer,
  `localStorage` key kept private so a second writer cannot exist by construction). Owns the
  Escape-key order standard §7.3/§7.6 describes: an open drawer/popover closes first; then search;
  the chosen **service is never cleared by Escape**, only announced. 6 importers.
- **`shell/ward-bar.module.css`** (2,180 lines) — `WardBar`'s styles; composes
  `wardShellTokens` from `../../../app/ward-flow-shell-tokens.module.css`.
- **`shell/ward-rail.tsx`** (1,230 lines) — the left rail: four fixed groups (Operations, Service
  Hubs, Care Coordination, Oversight) built from `ward-nav.ts`'s lists and reordered within each
  group by role (`ward-nav-role-order.ts`), open/closed state (`localStorage`, open by default —
  the opposite default from the retired `use-ward-sidebar-collapsed.ts`), the appearance toggle, and
  a service dot beside the current health service (a dot next to a _word_, never a bare colour bar —
  owner ruling Q-11 forbids the drawing's own brass "you are here" edge bar and its `.svcStripe`
  service-tint bar). Key exports: `WardRail`, `useRailOpenStore`/`setRailOpenPreference`,
  `computeShiftProgress`/`ShiftProgress`. Re-exports `ServiceBedAlert` from
  `ward-service-bed-alerts.ts`. 1 importer (`layout.tsx`).
- **`shell/ward-rail.module.css`** (2,827 lines) — the largest stylesheet in this part; must keep
  its `max-width: 1000px` breakpoint exactly matched to `ward-flow-layout.module.css`'s own.
- **`shell/ward-broadcast-banner.tsx`** (121 lines) — `WardBroadcastBanner`: renders the single
  active WA-wide broadcast alert (`getActiveBroadcastAlert`, `alerts/ward-broadcast-model.ts`) with
  a severity badge, time-remaining, acknowledgement count and an "Acknowledge" button that dispatches
  `ACKNOWLEDGE_BROADCAST_ALERT`; renders nothing when there is no active alert. 1 importer
  (`layout.tsx`).
- **`shell/ward-broadcast-banner.module.css`** (193 lines) — its styles.
- **`shell/ward-live-region.tsx`** (105 lines) — the shell's one polite `aria-live` region.
  `announceToWardShell(text)` is the module-level store every announcement in the shell goes
  through; a repeated sentence gets a trailing zero-width space (escaped, never a raw invisible
  byte) so a screen reader re-announces it. Key exports: `WardLiveRegion`, `announceToWardShell`,
  `useWardLiveRegionText`, `resetWardLiveRegionForTests`. Doc comment corrects an earlier version of
  itself that cited the wrong standard section for the rule it implements. 1 importer (`layout.tsx`)
  for the component; `announceToWardShell` itself is called from several shell and screen files.
- **`shell/ward-checks.ts`** (139 lines) — **O-9**: the module store a ward screen uses to publish
  its own reconciliation checks up to the rail/bar, which are its siblings in `layout.tsx` and so
  cannot receive a prop. `WardChecksPublication` is a discriminated union
  (`{published:false}` vs `{published:true, checks}`), not an array — the whole point is that
  `??`/`|| []` cannot silently collapse "no screen has published" into "a screen published zero
  checks" (owner ruling D-40). Key exports: `useWardChecks`, `useWardChecksPublisher`,
  `resetWardChecksForTests`, `WardChecksPublication`. 2 importers (`shell/ward-bar.tsx`,
  `shell/ward-rail.tsx` via `ward-reconciliation-line.tsx`).
- **`shell/ward-command-activity.ts`** (201 lines) — `deriveCommandActivity`: projects reducer
  state (movement opens, urgency changes, legal-deadline breaches, declines, escalations,
  overrides, stage changes, referral raises/triage, rejections, capacity-refresh requests) into a
  synthetic Activity-drawer feed and four summary tiles, because Command has no real append-only
  event log. 1 importer (`shell/ward-bar.tsx`).
- **`shell/ward-drawer-bus.ts`** (38 lines) — a bare `window` `CustomEvent` bus so a screen can open
  or close one of the bar's drawers (Activity/Tasks/Tools/Referral/Service) without a prop path
  through the layout. Key exports: `openWardDrawer`, `closeWardDrawer`, `subscribeWardDrawer`,
  `subscribeWardDrawerClose`. 1 importer (`shell/ward-bar.tsx`).
- **`shell/ward-facade.ts`** (433 lines) — the one place every Ward Flow URL is built:
  `patientHref`, `unitHref`, `wardBoardHref`, `teamHref`, `communityTeamHref`, `edHref`,
  `movementHref`, `handoverHref`, `settingsHref`, `officerHref`, `onCallHref`, `digestHref`,
  `signInHref`, `wardStatisticsHref` and siblings, plus `shellFigures`/`SHELL_FIGURE_IDS` (the fixed
  set of top-line figures the shell may show) and re-exports of `ward-eligibility.ts`'s gate types.
  9 importers.
- **`shell/ward-live-region.tsx`**, **`shell/ward-prototype-footer.tsx`** (32 lines) —
  `WardPrototypeFooter`: the "Demonstration records only — Not a medical device" footer strip, a
  reusable primitive with a default note and an overridable one. 4 importers.
- **`shell/ward-prototype-footer.module.css`** (32 lines) — its styles.
- **`shell/ward-reconciliation-line.tsx`** (145 lines) — the ONE place the fixed reconciliation
  sentence is composed ("Invented figures, reconciled with each other" / "…, N figures do not
  reconcile" / the unpublished/nothing-to-reconcile variants — owner ruling 2026-09-10 §7), reading
  a `WardChecksPublication` from `ward-checks.ts`. Mounted as a sibling of `.railFoot` in
  `ward-rail.tsx`, not inside it. Key exports: `WardReconciliationLine`, `reconciliationSentence`,
  `reconciliationProblems`, `NO_RECONCILIATION_CLAUSE`, `NOTHING_TO_RECONCILE_SENTENCE`. 1 importer
  (`shell/ward-rail.tsx`).
- **`shell/ward-reconciliation-line.module.css`** (90 lines) — its styles.
- **`shell/ward-service-bed-alerts.ts`** (200 lines) — `deriveServiceBedAlerts`: groups live wards
  by health service and reports free/occupied beds, occupancy colour band (`occupancyTone`), and
  compound escalation, built on top of `capacity/service-capacity-tracker.ts`'s
  `trackServiceBedCapacity`. Key exports: `deriveServiceBedAlerts`, `occupancyTone`,
  `ServiceBedAlert`, `ServiceBedAlertsSummary`. 1 importer within this scope (`shell/ward-rail.tsx`
  re-exports its types); also used by capacity screens outside this part's scope.
- **`shell/ward-service-scope-bar.tsx`** (97 lines) — `WardServiceScopeBar`: the one control a
  scoped screen mounts to say "narrowed to one service" plus what was left out (no-recorded-service
  count, urgent-movements-outside-service count); owns the "Show all services" clear action so seven
  screens do not each reimplement it slightly differently. 1 importer within this scope's grep, plus
  several capacity/delays/movements screens outside it.
- **`shell/ward-service-scope-bar.module.css`** (70 lines) — its styles.
- **`shell/ward-service-store.ts`** (113 lines) — the one `sessionStorage`-backed module store for
  the chosen `HealthService | null` (`SERVICE_SCOPE_STORAGE_KEY = "ward-flow-service"`), read by
  `WardBar`'s Service selector, `WardRail`'s dot, and any scoped screen. `sessionStorage`, never
  `localStorage` — the choice does not outlive the tab and is not part of the persisted demo state.
  Anything that is not exactly one of `HEALTH_SERVICES` (unset key, typo, stale name) reads as
  `null`. Key exports: `useServiceScope`, `setServiceScope`, `resetServiceScopeForTests`,
  `SERVICE_SCOPE_STORAGE_KEY`. 2 importers within this scope (`shell/ward-bar.tsx`,
  `shell/ward-rail.tsx`), plus scoped screens outside it.
- **`shell/ward-shell-tokens.module.css`** (20 lines) — **superseded stub**, content moved to
  `src/app/ward-flow-shell-tokens.module.css`; left on disk only because deleting anything under
  `ward-management/` needs the owner's go-ahead. Composes/`@import`s nothing itself; nothing under
  `src/` composes from it any more.
- **`shell/ward-shell-types.ts`** (106 lines) — shared shell types with no React dependency:
  `WardReconciliationCheck`, `WardActivityTile`, `WardActivityCategory`, `WardActivityChange`,
  `WardActivityContent`, `WardAppearance`; re-exports `WardPrimaryAction` from `ward-nav.ts` rather
  than defining a second, incompatible version of it (D-16 closed that two-types-one-name trap by
  deletion, not translation). 3 importers.
- **`shell/ward-sound-store.ts`** (137 lines) — offline Web Audio synthetic two-tone chime for
  urgent buzz alerts, with `localStorage`-backed audio/visual-pulse preferences. Key exports:
  `playSyntheticUrgentChime`, `triggerUrgentBuzzAlert`, `getAudioBuzzPreference`/
  `setAudioBuzzPreference`, `getVisualPulsePreference`/`setVisualPulsePreference`. 2 importers
  outside this scope's own directory: `settings/settings-screen.tsx` (the preference toggles) and
  `ward/ward-notification-center.tsx` (the actual alert trigger) — both outside this part's file
  list, so not detailed further here.
- **`shell/ward-wallboard-store.ts`** (38 lines) — `localStorage`-backed wallboard auto-refresh
  interval preference (`"off" | 15 | 30 | 60`). 1 importer, `settings/settings-screen.tsx`, outside
  this part's file list.

---

## 3. Ward table (`src/components/ward-management/ward-table/`)

- **`ward-table/ward-table.tsx`** (99 lines) — `WardTable`: the shared horizontal-scroll wrapper
  plus `<table>`, extracted from eleven independently-declared `.table` blocks across five screens.
  Deliberately minimal — callers still write their own `<thead>`/`<tbody>`. `hasScrollThreshold`
  renders a fixed "scrolls sideways" sentence and a visible wrapper border, driven by the caller's
  own `--ward-table-min-width`; `overflowing` stamps `data-overflowing="true"` from a caller's own
  measured `scrollWidth` check (this is a Server Component with no access to that measurement
  itself). 15 importers.
- **`ward-table/ward-table.module.css`** (289 lines) — the canonical `.table` block;
  `tests/ward-table-single-source.test.ts` asserts no other stylesheet under `ward-management/`
  re-declares it. `ed`, `ward-management-modes` and `ward-management-network` are deliberately NOT
  migrated onto it — their tables use different token layers, border modes and sticky headers by
  design, not by drift.

---

## 4. Root-level files (`src/components/ward-management/*`)

### 4.1 Classification

25 root `.tsx` files (excluding `ward-flow-provider.tsx`, covered in [Engine](engine.md)) fall into
four groups. Importer counts are `grep`-measured across `src/` only, deduplicated for the
`ward-bar`/`ward-demo-controls`/`ward-role-switcher`/`ward-chip` path-suffix collision noted in this
file's scope note.

**Mounted chrome** — rendered as part of the persistent shell or a route the shell always wraps:

- `ward-role-switcher.tsx` — mounted once, inside `shell/ward-bar.tsx`'s Tools drawer. 3 importers
  total, but 2 of them (`ward-management-navigation.tsx`, `ward-sidebar-content.tsx`) are
  themselves retired (§4.4) — only the `shell/ward-bar.tsx` mount is live.
- `ward-demo-controls.tsx` — mounted once, inside `shell/ward-bar.tsx`'s Tools drawer. Same
  3-importer/1-live pattern as above; its own doc comment still says it is "Mounted once in
  `ClinicalRail`", which has not been true since Task 8 (2026-09-11) — see
  the Pitfalls section below.
- `ward-global-search.tsx` — mounted once, inside `shell/ward-bar.tsx`, as the shell's one search
  box (`WardGlobalSearch`). 1 importer.
- `ward-shell.tsx` (`WardGround` export only) — mounted once, in `layout.tsx`, as the ground every
  route's content sits inside. 1 importer. (The file's other export, `WardShellHeader`, is retired
  — see §4.4.)
- `ward-tasks-drawer.tsx` — the drawer body `shell/ward-bar.tsx`'s Tasks drawer renders
  (`WardTasksDrawer`). 3 importers total; one (`ward-chrome-header.tsx`) and one
  (`ward-tasks-panel.tsx`) are themselves not mounted (§4.4) — only the `shell/ward-bar.tsx` path is
  live.

**Shared primitives** — presentational building blocks used across many screens, not part of the
shell itself:

- `ward-bar.tsx` (the small stacked-bar chart — **not** `shell/ward-bar.tsx`, a same-named,
  unrelated component) — 3 importers (`capacity-screen.tsx`, `delays-derivations.ts` type-only,
  `movements-screen.tsx`).
- `ward-chip.tsx` — the six-state coloured/worded chip; throws if rendered with no text. 9
  importers.
- `ward-controls.tsx` — `WardFilters`/`WardSegmented`. 2 importers.
- `ward-figure.tsx` — `WardFigure`/`WardFigureStrip`, a labelled value pair. 6 importers.
- `ward-freshness.tsx` — the one "As at …" / "Confirmed … · Ward X" / "Never confirmed" freshness
  stamp every board renders. 4 importers.
- `ward-panel.tsx` — `WardPanel`, the bordered section-with-heading primitive. 24 importers, by far
  the most-reused root file in this scope.
- `ward-record-row.tsx` — `WardRecordRow`/`WardGroupHeading`/`WardRecordList`, the one record row
  shared by Delays, Capacity and Movements. 4 importers.
- `decline-register.tsx` — `DeclineRegister`, the read-only accountability list for
  `Movement.declines`; takes an already-scoped list, performs no derivation itself. 1 importer
  (`coordinator/exception-drawer.tsx`).
- `override-register.tsx` — `OverrideRegister`, the equivalent read-only list for
  `Movement.overrides` (owner decision OD-3: visible to the party overridden). 3 importers
  (`coordinator/exception-drawer.tsx`, `governance-registers.tsx`, `ward/ward-screen.tsx`).

**Root-level screens** — rendered directly (or one hop away) by a route:

- `ward-management-console.tsx` (3,287 lines) — `WardPatientWorkspace` and
  `WardMovementNotFound`, mounted by `movements/[movementId]/page.tsx` (the movement workspace
  route) and by `people/[patientId]/page.tsx` (the not-found branch). 2 importers.
- `governance-registers.tsx` (1,928 lines) — `GovernanceWorkbench` (plus
  `GovernanceOverridesRegisterPanel`, `GovernanceAccessRecordPanel`), mounted by
  `ward-management-modes.tsx` for the `/governance` route, and separately by
  `governance/governance-screen.tsx`. 2 importers.
- `ward-management-modes.tsx` (535 lines) — `WardModeWorkspace`, the mode dispatcher mounted
  directly by `governance/page.tsx` and `network/page.tsx`; also defines `GovernanceView`,
  `NotAMedicalDeviceStatement`, `WARD_WORKSPACE_MODES`. 2 importers.
- `ward-management-network.tsx` (1,459 lines) — `WardNetworkWorkspace`, mounted by
  `ward-management-modes.tsx` for the `/network` route. 1 importer.

**Retired / not mounted** — verified by `grep` for every importer under `src/` (not just this
scope's own directory):

- `ward-chrome-header.tsx` (193 lines) — `WardChromeHeader`, the second-edition top chrome
  `shell/ward-bar.tsx` replaced (Task 8, 2026-09-11). 0 `src` importers; 2 test files still render
  it directly, both named in `tests/ward-component-reachability.test.ts`'s
  `DECLARED_UNREACHABLE` list.
- `ward-chrome-search.tsx` (675 lines) — `WardChromeSearch`, reached only from
  `ward-chrome-header.tsx` above. 1 `src` importer, which is itself unmounted; 0 test files render
  it directly (it is declared unreachable anyway, as a pin against anything ever mounting it again).
- `ward-standing-strip.tsx` (380 lines) — `WardStandingStrip`/`WardStatsToggle`/`WardStatsPanel`,
  the figures panel `WardChromeHeader` used to toggle open; reached only from it. 1 `src` importer
  (unmounted); 1 test file renders it directly (declared unreachable).
- `ward-management-navigation.tsx` (313 lines) — `ClinicalRail` and `WardModeNavigation`, the
  second-edition rail `shell/ward-rail.tsx` replaced. **Not** in `DECLARED_UNREACHABLE` — it counts
  as file-level "reachable" per that guard's transitive-import walk, because
  `ward-management-modes.tsx` does a **type-only** import of it (`import type { WardMode } from
"./ward-management-navigation"`, itself just a re-export of `ward-nav.ts`'s own `WardMode`). The
  `ClinicalRail`/`WardModeNavigation` **components** are rendered by no route — see
  the Pitfalls section below.
- `ward-sidebar-content.tsx` (332 lines) — `WardSidebarContent`/`WardSidebarNav`/
  `WardSidebarFooter`, the labelled sidebar body `ClinicalRail` used to mount. 1 `src` importer,
  which is `ward-management-navigation.tsx` above — itself unmounted, so this is unreachable two
  hops from any route. 1 test file renders it directly; not declared in
  `DECLARED_UNREACHABLE` (see the same pitfall).
- `ward-tasks-panel.tsx` (82 lines) — `WardTasksPanel`, a second mounting wrapper around
  `WardTasksDrawer` with its own open/closed state. 0 importers anywhere (`src` or `tests`) — dead
  code duplicating what `shell/ward-bar.tsx`'s own Tasks drawer wiring already does.
- `ward-flow-command-overview.tsx` (5 lines) — a bare re-export of `CoordinatorScreen` as
  `WardFlowCommandOverview`/`default`. 0 importers anywhere (`src` or `tests`) — a fully orphaned
  file.

`use-ward-sidebar-collapsed.ts` (root `.ts`, in the §4.5 list below) belongs in this same
"unreachable" family: its only importer is `ward-management-navigation.tsx`.

### 4.2 Navigation `.ts` files

- **`ward-nav.ts`** (746 lines) — the single source of every Ward Flow destination. Key exports:
  `WARD_MODES`/`WardMode` (the runtime-derived 7-id list — `command` excluded from the map but
  still live, `transport` retained-but-unlisted, both explained in-file), `WARD_VIEWS` (the six
  coordinator-level views), `WARD_NAV` (the 17 further destinations), `WARD_HOME_HREF`,
  `WARD_NAV_INTENTIONALLY_UNLISTED` (every static route deliberately absent, with a reason),
  `WARD_NEW_REFERRAL_MENU`, `WARD_PRIMARY_ACTIONS`/`WardPrimaryAction`/`resolveWardPrimaryAction`
  (the bar's one primary-action lookup), `resolveWardScreenTitle`. 15 `src` importers, 13 test
  files. See §5 below for the two-way test this file's own header describes.
- **`ward-nav-counts.ts`** (116 lines) — `wardNavCounts`: the handful of nav badge figures
  (capacity beds-ready, movements open, delays severe-cause count, discharges blocked-today,
  referrals awaiting-decision) — deliberately most destinations get **no** badge rather than an
  invented zero. `wardNavCountLabel` composes the accessible name ("Delays, 2 needing attention
  now"), never a bare digit for a screen reader. 5 `src` importers.
- **`ward-nav-icons.ts`** (104 lines) — `WARD_VIEW_ICONS`/`WARD_NAV_ICONS`, one Lucide icon per
  destination id, kept out of `ward-nav.ts` so that file stays a plain-data module runnable in a
  Node test context with no React dependency. Both maps are `Record<..., LucideIcon>` over the
  exact id union, so an id with no icon (or an icon for a retired id) is a compile error. 3
  importers.
- **`ward-nav-role-order.ts`** (122 lines) — `orderViewsForRole`/`orderRoleScreensForRole`/
  `orderBoardsForRole`/`wardNavRoleRank`: **reorders** `ward-nav.ts`'s lists per role, never adds or
  removes (owner ruling, 2026-09-06, "reorder real screens only" — the drawn ward/ED sidebars named
  three destinations that were never built). An id a role's list does not mention keeps its source
  position, last, rather than vanishing. 3 importers.
- **`use-ward-nav-counts.ts`** (44 lines) — `useWardNavCounts()`: the one hook both the rail and
  the bar call for `{role, counts, placeId}`, all derived from `usePathname()` so the two chrome
  trees cannot disagree about which route they are on. Its own doc comment still says `ClinicalRail`
  "is mounted 35 times across 27 files" — stale since Task 8 retired every one of those mounts (see
  the Pitfalls section below). 4 importers.
- **`use-ward-sidebar-collapsed.ts`** (70 lines) — the second-edition sidebar's own
  `localStorage`-backed collapse preference (`ward-flow-sidebar-collapsed`, collapsed by default —
  the opposite default from `shell/ward-rail.tsx`'s own open-by-default store, and a deliberately
  separate key from the clinical app's equivalent hook). 1 importer, `ward-management-navigation.tsx`
  — itself unmounted (§4.1), so this hook is dead along with its one caller.
- **`use-printable-disclosures.ts`** (49 lines) — `usePrintableDisclosures()`: on `beforeprint`,
  force-opens every `<details class="source-print">` (removing its `name` attribute so an
  accordion group does not fight the forced-open state) and restores each one's exact prior
  open/closed state and `name` on `afterprint`. 11 importers — the widest-used of the seven `.ts`
  files in this section, used by screens that print (handover, board, discharges, etc.) outside this
  part's own scope.

### 4.3 Root `.module.css` files

One line each: which component(s) compose/import it, and whether anything does.

- **`decline-register.module.css`** (101) — `decline-register.tsx` only.
- **`governance-third-edition.module.css`** (1,633) — `governance/governance-screen.tsx`,
  `governance-registers.tsx`, `ward-management-modes.tsx`.
- **`override-register.module.css`** (107) — `override-register.tsx` only.
- **`ward-bar.module.css`** (224) — `ward-bar.tsx` (the root stacked-bar chart) only; unrelated to
  `shell/ward-bar.module.css`, which is a different, much larger file for a different component.
- **`ward-chip.module.css`** (87) — `ward-chip.tsx` only.
- **`ward-chrome-header.module.css`** (232) — `ward-chrome-header.tsx` only; that component is
  itself unmounted (§4.1), so this stylesheet ships but paints no live route.
- **`ward-controls.module.css`** (90) — `ward-controls.tsx` only.
- **`ward-demo-controls.module.css`** (224) — `ward-demo-controls.tsx` only.
- **`ward-figure.module.css`** (211) — `ward-figure.tsx` only.
- **`ward-freshness.module.css`** (103) — `ward-freshness.tsx` only.
- **`ward-global-search.module.css`** (706) — `ward-global-search.tsx` only.
- **`ward-management-modes.module.css`** (1,513) — `ward-management-modes.tsx` only.
- **`ward-management-network-third-edition.module.css`** (471) — `ward-management-network.tsx`.
- **`ward-management-network.module.css`** (1,445) — `ward-management-network.tsx` (imported
  alongside the third-edition module above — both are live in the same file at once).
- **`ward-management.module.css`** (1,413) — `ward-management-console.tsx` and
  `ward-management-navigation.tsx` (the latter unmounted, §4.1).
- **`ward-modes-second-edition.module.css`** (586) — `governance/governance-screen.tsx`,
  `governance-registers.tsx`, `ward-management-modes.tsx` (same three files as
  `governance-third-edition.module.css`; both second- and third-edition classes are live in each).
- **`ward-panel.module.css`** (175) — `ward-panel.tsx` only.
- **`ward-record-row.module.css`** (191) — `ward-record-row.tsx` only.
- **`ward-reduced-motion.module.css`** (32) — not imported from any `.tsx`/`.ts` file; **composed
  from** by ten other CSS modules' own classes (`coordinator.module.css`, `officer.module.css`,
  `tracker/live-tracker.module.css`, `ward-demo-controls.module.css`,
  `ward-management-modes.module.css`, `ward-management-network.module.css`,
  `ward-management.module.css`, `ward-role-switcher.module.css`, `ward-sidebar.module.css`,
  `ward-tasks-drawer.module.css`) — a shared `prefers-reduced-motion` kill-switch, not a
  standalone stylesheet.
- **`ward-role-switcher.module.css`** (303) — `ward-role-switcher.tsx` only.
- **`ward-shared.module.css`** (87) — `patients/person-screen.tsx` only within this map's grep,
  despite its own header comment describing seven classes "every Ward Flow screen independently
  invented" — worth re-checking with a wider search if this file's adoption matters to a future
  task.
- **`ward-shell.module.css`** (115) — `ward-shell.tsx` only.
- **`ward-sidebar.module.css`** (558) — `ward-management-navigation.tsx` and
  `ward-sidebar-content.tsx` — both unmounted (§4.1), so this stylesheet also ships but paints no
  live route.
- **`ward-standing-strip.module.css`** (199) — `ward-standing-strip.tsx` only; unmounted (§4.1).
- **`ward-tasks-drawer.module.css`** (576) — `ward-tasks-drawer.tsx` only.
- **`ward-tasks-panel.module.css`** (68) — `ward-tasks-panel.tsx` only; that component itself has
  0 importers (§4.1), so this stylesheet is fully dead weight.
- **`ward-tokens.module.css`** (416) — not imported from any `.tsx`/`.ts` file directly; **composed
  from** by 60 other CSS modules under `ward-management/`. This is the second-edition alias layer
  (`--ward-*` names bridging onto this app's existing v2 palette) — distinct from, and much more
  widely used than, the third-edition's `ward-flow-shell-tokens.module.css` (§1.4).

---

## 5. How a screen gets its chrome

For every route under `/mockups/ward-flow/**` except the sign-in and digest siblings (§1.1), in
mount order:

1. **`src/app/mockups/ward-flow/layout.tsx`** (§1.4) — the one Server Component ancestor of every
   route.
2. **Access gate** — none. `WardFlowAccessGate` was removed 28 September 2026 at Josh's request; Ward Flow now opens with no developer key.
3. **Provider** — `WardFlowProvider` (`ward-flow-provider.tsx`, [Engine](engine.md)): seeds the
   world, holds the reducer state, ticks the clock.
4. **Rail / bar / banner / live region**, all siblings of the routed page inside the provider, in
   this exact JSX order: `<WardLiveRegion />`, then a flex row containing `<WardRail />` and a
   column containing `<WardBarMount />`, `<WardBroadcastBanner />`. `WardBarMount`
   (`shell/ward-bar.tsx`) is a thin Client Component wrapper whose only job is to call
   `usePathname()` and resolve `resolveWardPrimaryAction(pathname)` before handing the result to
   `WardBar` as a prop — `layout.tsx` itself cannot call that hook, because it renders the
   Server-Component-only access gate directly and so can never become a Client Component itself.
5. **Ground** — `<WardGround>{children}</WardGround>` (`ward-shell.tsx`), a plain wrapper `<div>`
   with no `<h1>`/`<main>` of its own, so it can be a real ancestor of every route's own landmarks
   without adding a second one.
6. **The page** — one `page.tsx` from §1.2/§1.4, rendering one screen component (covered in
   [Screens A](screens-a.md) / [Screens B](screens-b.md)).

A screen that wants to publish reconciliation checks to the rail/bar cannot pass them as a prop
(the screen is layout.tsx's grandchild via `WardGround`, not an ancestor of the rail or bar, which
are its siblings) — it calls `useWardChecksPublisher` (`shell/ward-checks.ts`) in an effect instead,
and the store clears on unmount so a stale claim never survives a route change.

---

## 6. Navigation source of truth

`ward-nav.ts` (§4.2) is the single list every rail, panel, drawer and redirect reads. Before it
existed, the rail's destinations were hand-pasted link blocks with nothing checking the two lists
(nav entries, real routes) against each other — which is how three routes (`/handover`,
`/escalation`, `/search`) shipped with no rail entry at all and nothing noticed.

`tests/ward-nav.test.ts` enforces the two-way property that closed that gap, both directions:

- every `href` in `WARD_VIEWS`/`WARD_NAV` must resolve to a real `page.tsx` under
  `src/app/mockups/ward-flow/`, **and**
- every static route under that tree must appear in one of those two lists or in
  `WARD_NAV_INTENTIONALLY_UNLISTED` with a stated reason.

The same file also renders each real route's screen component through `renderToStaticMarkup` (an
SSR-string render, not jsdom — mocking `next/link` and `next/navigation`'s router/search-params
hooks) to catch a route whose page throws before any browser test would.

`ward-nav-role-order.ts` reorders (never adds or removes) what `ward-nav.ts` lists, per the eight
`WardChromeRole`s; `ward-nav-icons.ts` supplies one icon per id, checked at compile time by `Record`
totality over the exact id unions; `ward-nav-counts.ts`/`use-ward-nav-counts.ts` supply the small
set of badge figures. Together these five files are read by both `shell/ward-rail.tsx` and the
retired `ward-management-navigation.tsx`/`ward-sidebar-content.tsx` — the single-source design is
what let the second-edition-to-third-edition chrome swap (Task 8) happen without re-deriving any of
the destination list itself.

---

## Pitfalls in this area

- **`ward-management-navigation.tsx` looks "reachable" but its components are not mounted.**
  `tests/ward-component-reachability.test.ts` walks file-level imports transitively from every
  route, and it follows type-only imports on the stated theory that doing so can only make the
  reachable set too _large_, never invent a false orphan. `ward-management-modes.tsx` does exactly
  one type-only import of `ward-management-navigation.tsx` (for the re-exported `WardMode` type),
  which is enough to mark the whole file — and therefore its runtime-only import of
  `ward-sidebar-content.tsx` — as "reachable" by that walk, even though the `ClinicalRail` and
  `WardModeNavigation` components it actually defines render on no route. A future reader trusting
  the reachability guard's silence about these two files would be wrong; check §4.1 and §4.4, not
  just that test, before assuming either file is live.
- **Two stale "mounted here" claims sit in doc comments of live files.**
  `ward-demo-controls.tsx` still says it is "Mounted once in `ClinicalRail`", and
  `use-ward-nav-counts.ts` still says `ClinicalRail` "is mounted 35 times across 27 files" — both
  true before Task 8 (2026-09-11) retired every `ClinicalRail` mount in favour of
  `shell/ward-rail.tsx`/`shell/ward-bar.tsx`, neither corrected since. Do not trust a component's own
  "where I'm mounted" comment in this tree without a `grep`.
- **`ward-bar.tsx` is two unrelated components with the same base name.** The root file (a small
  stacked-bar chart, 171 lines) and `shell/ward-bar.tsx` (the top bar, 1,584 lines) are different
  components with different CSS modules; a path-suffix `grep` for `ward-bar` silently merges their
  importer counts unless the `shell/` matches are filtered out by hand (done for this map — see the
  scope note).
- **Two token layers, and which one applies depends on where a class sits in the tree, not on
  which folder a file is in.** `ward-tokens.module.css` (60 composers, the v2-alias layer used by
  most second-edition screens) and `ward-flow-shell-tokens.module.css` (~39 composers, the
  third-edition's own closed palette) declare some of the same custom-property _names_ with
  _different values_. Both resolve correctly wherever they are the nearest ancestor class — but a
  component nested inside a third-edition `.bar`/`.rail` inherits the third-edition values even if
  it never composes that class itself (documented explicitly in
  `ward-flow-shell-tokens.module.css`'s own header, for `WardGlobalSearch` rendered inside
  `shell/ward-bar.tsx`'s `<header>`).
- **`ward-nav.ts`'s own runtime-derived `WARD_MODES` list has a deliberately excluded id
  (`command`) and a deliberately retained-but-unlisted one (`transport`).** Both are still live
  (`command` is the most-used mode id in the app), so "not in `WARD_MODES`" must not be read as
  "dead" — see `WARD_MODES_NOT_LISTED` and the file's own header for why each is excluded from the
  rail's map without being unreachable.
- **`ward-shell-tokens.module.css` under `shell/` is a dead stub, not a live token file** — its
  content moved to `src/app/ward-flow-shell-tokens.module.css` and nothing composes from the stub
  any more, but it is still on disk (protected-path deletion rule) and its filename is one character
  away from the real, still-used `ward-flow-shell-tokens.module.css`.
- **`ward-tasks-panel.tsx` and `ward-flow-command-overview.tsx` are fully dead** (0 importers
  anywhere, including tests) but are not declared in `tests/ward-component-reachability.test.ts`'s
  `DECLARED_UNREACHABLE` list, because that guard only declares components a **test still renders**
  — an orphan nothing renders at all is invisible to it by design (see that file's own comment on
  why it narrows to `.tsx` and to tested modules).
- **`WardBarMount` exists only because `layout.tsx` cannot call `usePathname()`.** A future edit
  that tries to fold `WardBarMount`'s one line of logic back into `layout.tsx` "to simplify it" would
  break: `layout.tsx` is a Server Component, and turning it into a Client Component would make
  every route beneath it client-rendered from the root down.

## Not checked

No test, lint, typecheck or browser render was run for this map. Screen files themselves (what each
`page.tsx` target component actually does) are covered in Screens A/B, not here. Every importer
count is a static `grep` over import specifiers, not a bundler or type-checker's resolution — a
dynamic `import()` with a computed path, or a re-export chain more than one hop deep, could in
principle be missed, though none was found while assembling this map. `ward-shared.module.css`'s
narrower-than-expected one-file footprint (§4.3) was checked only against `src/`; docs/scripts
referencing it by name were not searched, and its own header comment's claim about "every Ward Flow
screen" is unverified beyond that one importer. Whether `shell/ward-bar.tsx`'s
Escape-order and drawer-history behaviour actually works in a browser was not verified here — only
read from source and the doc comments' own citations of `tests/ward-shell-third-edition.dom.test.tsx`.

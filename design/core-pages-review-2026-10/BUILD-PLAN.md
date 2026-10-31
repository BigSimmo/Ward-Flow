# Redesign build plan: from mock-ups to the real app

_Updated 2026-10-31 - first build plan, written from D-74, D-83, D-89, D-91, this folder's handovers and the four other pull requests' handovers; Design owns._

**In one line:** nothing here is approved for building yet. This is the order and the method for when Josh approves.
It plans work; it authorises no merge, push, release or page build.

## 1. Purpose and status

- **The mock-ups are the design master.** Every visual change lives in the redesign viewer
  (`/mockups/ward-flow-redesign`, draft PR #1118, branch `claude/core-pages-design-review-f5vf4g`). The real-app
  pull requests carry only behaviour and accessibility fixes until Josh approves a page (D-91).
- **Nothing is built from a mock-up until Josh approves that mock-up** (D-74 standing rule: "DO NOT EVER GO AHEAD
  UNTIL I APPROVE THE MOCKUP"). Approval is per page. A yes to the plan is not a yes to a page.
- **D-91 rules, in short:**
  - Merge order into `main`, each fixed first and each with Josh's yes: #1120, #1119, #1124 (behaviour part), #1123.
  - Clear-cut bugs go in small separate PRs: restore says nine rules (there are twelve); Settings Export and Import
    do not match; Community save failures vanish (CT-09).
  - #1118 stays a draft until Josh approves the design direction. It then merges with the mock-ups still blocked in
    production, and each page build deletes its own mock-up copy.
  - Build order after Josh's page-by-page review: shared frame, control sizes and notice position first; then Home;
    then one page per pull request.
  - D-91 approves no page, merge, release, deployment or real data.
- **Other rules that shape every build:** D-83 (full names everywhere, surname first); D-89 (mock-up copies may pass
  the 1,500-line cap; real files keep their cap and never shorten on-screen words); D5 and D-70 (legal times only as
  typed, never computed); D4 ("Not wired in this prototype."); design tokens only; synthetic data only.
- **Retirement note:** `docs/mockup-retirement-policy.md` is marked superseded and historical. D-91 still points to it
  for "each page build deletes its own copy". What is enforced today is `npm run check:mockups`
  (`scripts/check-mockup-retirement.mjs`, read the script); its `--diff auto` mode fails a deleted file that anything
  still imports, and needs a `## Retired mockups` entry in `mockups/README.md` when a whole route goes.

## 2. Starting the project chat

Copy this into the project chat that will coordinate the build chats.

```text
You coordinate the Ward Flow redesign build. Repository: BigSimmo/Ward-Flow only (synthetic-data
prototype for psychiatric bed flow in WA). Josh is a psychiatrist, not an engineer: plain
Australian English, answer first, questions in one numbered list with one recommendation each.

Read first, in order:
1. AGENTS.md (hard rules) and docs/agents/checks-and-evidence.md.
2. docs/ward-flow/decisions.md D-74, D-83, D-89, D-91 (D-91 is the governing brief).
3. design/core-pages-review-2026-10/BUILD-PLAN.md (this plan), then HANDOVER.md and
   HANDOVER-TOOLS.md in the same folder.

Rules you must keep:
- Nothing is built from a mock-up until Josh approves that page (D-74). Ask, page by page.
- Each merge into main needs Josh's yes at the time. Never push to `live`; only the daily
  release workflow moves it. Never merge #1118 or mark it ready without Josh's yes.
- Ask Josh before any GitHub, CI, Supabase, Railway or network Git action (git fetch included).
  Ask once for a standing yes to post claim comments on the pinned "Who is editing what" issue
  (#688) and to read PR status; record his answer.
- Stage named files only. No --no-verify, no git add -A, no stash, no force-push.

Order of work (BUILD-PLAN.md sections 3 to 5):
- Phase 2: real-app PRs into main, in D-91 order, each fixed first: #1120, #1119, #1124 part A,
  #1123, plus three small bug PRs. Find out what #1120 is before anything else.
- Phase 3: merge main into #1118 once, refresh the stale mock-up copies, republish the preview.
- Phase 4: after Josh approves a page, build it into the real app, one page per PR, deleting
  its mock-up copy in the same PR. Shared frame and kit first, then Home, then by use.

Running several build chats without clashes:
- One branch and one worktree per build, started from verified main:
  git worktree add ../wf-build-<slug> -b claude/build-<slug> origin/main
  Confirm `git remote get-url origin` and `git remote get-url --push origin` both name
  BigSimmo/Ward-Flow before any Git write.
- Before a chat edits, it writes its claim in the sign-out log (WARD_SIGNOUT_FILE, one line per
  owned path, ending repo=BigSimmo/Ward-Flow) and comments on issue #688 (paths and branch only).
  Release both when done. An overlap needs the other owner's release or Josh's scoped takeover.
- Shared files have one owner at a time, held by you: src/components/wf/*, the viewer registry
  (src/app/mockups/ward-flow-redesign/_preview/*), script-budget.json and
  docs/script-budget-history.md, eslint-rules/max-lines-baseline.mjs, docs/ward-flow/decisions.md,
  docs/FACTS.md, mockups/README.md, docs/site-map.md, help/ward-help-content.ts.
  A build chat that needs one asks you; you sequence those PRs.
- One wide gate per machine at a time (the run lock); one dev server per container (each takes
  6 to 7 GB). Take screenshots from the built preview copy where possible.
- Merge build PRs one at a time. After each merge, every open build branch merges main in
  before its next push.
- Each build chat reports: branch, commit, files changed, checks run with the decisive output
  line, checks not run, and screenshots location. Never claim a skipped check passed.
```

## 3. Phase 2: real-app pull requests, in order

Each PR below needs fixes before merge, then the checks in the table at the end of this section, then Josh's yes.
Merge one, then rebase or merge main into the next before checking it.

### 3.1 #1120 (first in D-91's order)

- **Not described** in any handover read for this plan. Before any work, identify it: ask Josh, or with his yes run
  `gh pr view 1120 --repo BigSimmo/Ward-Flow`. Then list its required fixes here before starting #1119.

### 3.2 #1119 Help (`claude/help-menu-design-review-a1isgp`)

Good spotlight engine and Show me (points, never clicks). Fixes before merge:

1. **Keep `howToHref` importable for #1123.** Either keep a thin re-export from `help/ward-help-ask.tsx`, or have
   #1123 import from `help/ward-help-href.ts` when it rebases. Pick one and say which in both PRs.
2. **Shortcut rows need `short` and `group`.** #1119's `KEYBOARD_SHORTCUTS` entries each carry `short` and `group`.
   #1124's Alt+N row has neither, so #1124 must add them when it rebases (or #1119 adds a safe default).
3. **Live switch off.** `ward-feature-flags.ts` turns `help-ask` on in demo and production. D-91: Show me stays off
   live until Josh has seen it in the mock-ups. Keep it on in development only.
4. **"How do I…" is the first tab** and the sidebar's Help opens on it with this screen's tasks first (D-91 confirms
   #1119's choice).
5. **Phone tabs on one sliding row at the kit size** (today they wrap).
6. **D-90 wording.** It quotes no words from Josh, and D-91 overrides its "switch on everywhere". Add his words or a
   note pointing to D-91.
7. **Decision-file conflict.** Whichever of #1118 and #1119 merges second keeps D-89, D-90 and D-91 in order, then
   reruns `node scripts/ward-flow/owner-rulings-index.mjs` and `npm run docs:facts:write`.
8. **Not run yet on #1119:** `verify:pr-local`, the build and phone script budget, hosted CI.

### 3.3 #1124 Notifications (`claude/notifications-popups-design-qarfyt`), split in two

**Part A, behaviour only (merge in Phase 2):**

- The screen adapter (`ward-action-toast.ts`, `useActionToast`, `useTaggedToast`).
- Read once (remove the board's duplicate announcements).
- One bell count (`ward/ward-alert-counts.ts` for badge and panel).
- Layering fixes (record document dialog off z-index 9999; drop the `1000` fallbacks; the dead `.actionToast`).
- Escape for the Help corner cards.
- Smart timers (6 to 12 s, pause on hover, focus and hidden tab; undo windows keep running in a hidden tab).
- Alt+N to reach Undo, with `short` and `group` on its shortcut row (see 3.2 item 2).
- **Route every Community save failure as a warning, with a test** (CT-09). The review found some still vanish.
- **Never drop a warning when the stack is full.** A warning stays until closed, whatever else arrives.
- **Keep thin re-exports** of `board/ward-board-toast.tsx` and `ward/ward-page-action-toast.tsx`, and keep the toast
  CSS classes the forks use. Eight mock-up files import them: `stays`, `as-ward-stays`, `ward/ward-screen.tsx`,
  `community-team`, `as-community-home`, `pop-confirm-beds`, `pop-ward-notices`, `pop-bed-record`.
- **Out of part A:** the Recent chip (D-91: missed notices go into Activity's "Recent activity" tab and clear on idle
  lock and desk switch), the folded stack, corner-card moves, the new shadow and motion. If the in-memory recent list
  stays in A, it must clear on idle lock and desk switch and show nowhere yet.

**Part B, visual (after the mock-up):** folded stack, corner-card moves, shadow, motion and the Recent list inside
Activity. These are mocked up in #1118 first (`pop-state-toast`, Home's Activity panel), then built after Josh
approves. The notice position (clear of the phone dock) is built with the shared frame in Phase 4.

**Not run yet on #1124:** full lint and typecheck, the build and phone script budget (the provider adds about 3 to
5 KB per route), Playwright journeys, a real screen reader.

### 3.4 #1123 Search and forms (`claude/search-forms-optimization-44anqi`)

Rebase on main after #1119 and #1124 A. Fixes before merge:

1. **Contact typo gate.** Contact near-spelling matching ignores the "no person matched" gate in
   `search-directory.ts`. Near spellings must apply only when no person, movement or referral matched.
2. **No ED row autofocus on phones.** ED row forms take focus on open; on a phone that throws up the keyboard. Focus
   the first field on larger screens only, as Add a patient does.
3. **Legal time buttons: Now only.** The mock-up offers +15m, +30m and +1h on "time the form was written". Any
   legal-form time offers Now only (D5, D-70, D-91).
4. **Help content line ~140.** `help/ward-help-content.ts` still tells All EDs users to "Search by ED, hospital or
   service", but #1123 removes that box. Reword to the filters that remain.
5. **Import `howToHref`** from wherever 3.2 item 1 leaves it.
6. **Move the stand-alone mock-up out.** `/mockups/ward-flow-search` and `ward-management/search-redesign/` move into
   the redesign viewer (a re-forked `pop-search` and a page search field in `parts/`). Remove them from #1123.
7. **Finish the full gate:** `npm run verify:pr-local -- --base origin/main` (it stopped once at `typecheck:backend`),
   Playwright including `tests/ui-ward-search.spec.ts`, `npm run build`, then the phone script budget.
8. The removals are already ratified by D-91 (no new decision needed).

### 3.5 Small bug PRs, each from main

| Bug                                                | Where                                         | Owner                                                    |
| -------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| Restore says "all nine rules"; it restores twelve  | `settings/reset-baseline-modal.tsx` line ~103 | needs a small PR                                         |
| Settings Export writes things Import does not read | `settings/` export and import                 | needs a small PR                                         |
| Community save failures vanish (CT-09)             | community screens' save paths                 | small PR (D-91); #1124 A must keep it fixed, with a test |

### 3.6 Checks for every Phase 2 PR

| Check                                                     | Command                                                                                               |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Format owned paths, then commit the result                | `npm run format -- --files <paths>`                                                                   |
| Focused tests while editing                               | `node scripts/run-vitest.mjs run <test>`                                                              |
| Local readiness (selects lint, typecheck, unit, journeys) | `npm run verify:pr-local -- --base origin/main`                                                       |
| Test-count guard                                          | `npm run check:diff-integrity`                                                                        |
| Removed exports                                           | `npm run check:dead-code-candidate -- --diff origin/main` (full history)                              |
| Mock-up imports still resolve                             | `npm run check:mockups`                                                                               |
| Build and phone size limits                               | `npm run build`, then `node scripts/check-script-budget.mjs` (D-82: up to 5 KB a screen, with reason) |
| Browser                                                   | `npm run ensure`, then look at 1440, 1024 and 390, light and dark                                     |
| Hosted CI                                                 | only read with Josh's yes; never babysit                                                              |

Each merge needs Josh's yes at the time. Merging changes `main`, not the live site.

## 4. Phase 3: refresh the mock-ups

1. After all of Phase 2 is merged, merge `main` into #1118 **once** (with Josh's yes for the push).
2. Merge #1122 (Settings round 3) into #1118 if not already in: keep its `ScopeLine` in `settings-rows.tsx`, keep
   both sides of `build-notes.ts`, accept the deletion of the two role `settings-screen.tsx` copies; then its small
   fixes (phone Theme and Row density at kit size, the stale "cannot drift" comment, "Save 3 rule changes?" against
   "Save 3 rules", "None over" with no noun).
3. Refresh each stale fork (table below), then run the checks in HANDOVER.md "How it was checked", rebuild the preview
   copy and republish the private preview (Josh's yes).

**How to refresh one fork:**

1. Save today's design difference: `git show b6aa5cd:<real file>` against the fork file (normalise the `@/components`
   imports and the renamed export first, so only design lines differ).
2. Copy the new real file from `main` over the fork, redo the import rewrite and export rename (`fork.py` in
   HANDOVER-TOOLS.md).
3. Re-apply the saved difference by hand, line by line. `git merge-file` can help once imports match.
4. Note the new base commit in the page's build notes ("Forked from main at <commit>"), so Phase 4 diffs against it.

| PR that lands | Forks that go stale                                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #1119 Help    | `pop-help` (also has its own `help-href.ts` copy), `pop-tour`, `pop-shortcuts`                                                                                                       |
| #1123 Search  | `pop-search` (re-fork, add the moved mock-up), `eds`, `statistics`, `as-executive-home`, `community-team`, `as-community-home` (breaks: `communitySearchRenderer`, `v6.searchPanel`) |
| #1124 Notices | `ward/ward-screen.tsx`, `stays`, `community-team`, `waiting`, `on-call`, `pop-ward-notices` (plus the eight toast importers in 3.3)                                                  |
| Settings bugs | `settings` (restore wording, export and import)                                                                                                                                      |
| #1120         | unknown until identified                                                                                                                                                             |

## 5. Phase 4: building pages into the real app

**Before the first page:** Josh approves the design direction and #1118 merges into `main` (with the mock-ups still
blocked in production, D-91). From then on, each build works from `main`, where both the fork and the real file live.

### 5.1 Order

1. **Shared frame and kit** (one PR each, in this order):
   - `shell-next` becomes the real sidebar and header (`shell/ward-bar.tsx`, `ward-bar-controls.tsx`, `ward-rail.tsx`,
     `ward-rail-entries.ts`, `ward-phone-menu.tsx`, `ward-phone-menu-sheet.tsx`). Includes: no "Synthetic prototype"
     pill (footer notice stays), "Search Ward Flow", the bell with icon and count, a phone dock per desk, Settings
     without its own "Go to a desk".
   - The kit standard into `src/components/wf`: `parts/kit-standard.css` (one size per control), `parts/phone-rows.module.css`
     (chip rows, hero pills), `parts/show-more-row.tsx`, and the page search field from #1123's mock-up.
   - Notice position: toasts clear of the phone dock and the foot of Home (and #1124 part B once mocked up).
2. **Home** (`home-activity/` into `coordinator/coordinator-screen.tsx` and `coordinator/shortlist-panel.tsx`).
3. **Pages by use:** Capacity, Waiting, Referrals (with New referral), Discharges, My ward, Movements; then suggested:
   Handover, ED board, Stays and discharges, Transport, Patients, All EDs, All wards, Alerts, Legal forms, the
   Statistics family, Out of area, On-call, Seclusion, Governance, Bed meeting TV, Agenda, Downtime, Chronology,
   Places, Community, Community team, Patient record, Add a patient, Ward answer, Settings, Sign in. Josh may reorder.
   Each page's role views (`as-*`) and its popups build with it.

### 5.2 Checklist for each page PR

1. Josh's approval of this page is recorded (quote and date in the PR).
2. Own branch and worktree from `main`; sign-out claim and #688 comment for the real files, the fork folder and any
   registry lines.
3. List what changed in each real file since the fork was taken:
   `git log --oneline b6aa5cd..main -- <real file>` (or from the refresh commit in its build notes). Fold those
   changes into the design difference before applying it.
4. Apply the fork's design difference to the real file. Role views: turn each `ROLE BRANCH (<role>)` comment into a
   branch on the desk's role in the one real component. No override stylesheets.
5. Keep the real file under its line cap by splitting, never by cutting words (D-89 applies to mock-ups only).
6. Delete the fork folder (page, its `as-*` copies and its popups) in the same PR, with its entries in
   `_preview/screens.ts`, `built-pages.ts`, `screen-components.tsx`, `popup-components.tsx`, `build-notes.ts` and any
   `max-lines-baseline.mjs` line. `npm run check:mockups` must pass.
7. Update tests: unit and DOM tests for changed behaviour, test ids kept or migrated, `tests/ward-help-howto.test.ts`
   if a Show me target moved. `check:diff-integrity` explains any drop.
8. Browser check at 1440, 1024 and 390 px, light and dark: no sideways scroll, nothing under the dock, no text under
   12 px (`npm run check:ward-text-size`), focus visible, every button wired.
9. Build and `node scripts/check-script-budget.mjs`; follow D-82 if a limit moves.
10. The page's build notes become the PR description (with the "Question for you" lines answered or listed).
11. Format, commit, push with Josh's go-ahead; merge only with his yes.

### 5.3 Page and popup map

Real paths are under `src/components/ward-management/` unless shown. "unknown" means no fork comment names it.

| Slug               | Fork folder           | Real file(s) it copies                                                                                                                                             |
| ------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| home               | `home-activity/`      | `coordinator/coordinator-screen.tsx`, `coordinator/shortlist-panel.tsx`, `coordinator/home.module.css`                                                             |
| capacity           | `capacity/`           | `capacity/capacity-screen.tsx` (rebuilt on real derivations), `capacity-ward-sidebar.tsx`, `planned-admissions-panel.tsx`, `step-down-board.tsx`, `ward-panel.tsx` |
| movements          | `movements/`          | `movements/movements-screen.tsx`                                                                                                                                   |
| waiting            | `waiting/`            | `delays/delays-screen.tsx`, `delays-board.tsx`, `delays-board-graphs.tsx`, `delays-board-rows.tsx`, `coordinator/missed-requests-panel.tsx`                        |
| eds                | `eds/`                | `ed/ed-index.tsx`                                                                                                                                                  |
| referrals          | `referrals/`          | `referrals/referral-board.tsx`, `referral-board-sections.tsx`, `referral-board-phone.tsx`, `referral-board-parts.tsx`, `referral-match*.tsx`                       |
| new-referral       | `new-referral/`       | `referrals/ward-referral-drawer-head.tsx`, `ward-referral-drawer-rail.tsx`, `use-ward-referral-drawer-state.ts`, `shell/ward-bar.module.css`                       |
| handover           | `handover/`           | `handover/handover-page.tsx`, `handover-phone.tsx`                                                                                                                 |
| ward               | `ward/`               | `ward/ward-screen.tsx`, `ward-home-tab.tsx`, `ward-screen-derivations.ts`, `ward-screen-home-section.tsx`, `ward-screen-top-bar.tsx`, `since-last-look-pill.tsx`   |
| stays              | `stays/`              | `board/ward-board.tsx`, `board/ward-board-grid-column.tsx`                                                                                                         |
| ed-board           | `ed-board/`           | `ed/ed-screen.tsx`, `ed-screen-desktop.tsx`, `ed-screen-board.tsx`, `ed-screen-board-row.tsx`, `ed-overview.tsx`                                                   |
| transport          | `transport/`          | `officer/officer-screen.tsx`, `officer-job-detail.tsx`, `officer-forms-pack.tsx`                                                                                   |
| patients           | `patients/`           | `search/patient-search.tsx`, `patient-census-view.tsx`, `census.module.css`                                                                                        |
| discharges         | `discharges/`         | `discharges/discharge-board.tsx`, `discharge-board-filters.tsx`, `discharge-flow-charts.tsx`, `discharge-detail-panes.tsx`, `discharge-weekend-prep.tsx`           |
| wards              | `wards/`              | `wards/ward-index.tsx`                                                                                                                                             |
| statistics         | `statistics/`         | `statistics/statistics-screen.tsx`, `statistics-network-cards.tsx`, `statistics-session-trends-card.tsx`, `statistics-summary-phone.tsx`                           |
| statistics-compare | `statistics-compare/` | `statistics/statistics-compare-screen.tsx`                                                                                                                         |
| statistics-list    | `statistics-list/`    | `statistics/statistics-wards-index.tsx` (from the route; no fork comment)                                                                                          |
| statistics-unit    | `statistics-unit/`    | `statistics/statistics-ward-screen.tsx`                                                                                                                            |
| statistics-weekly  | `statistics-weekly/`  | `reports/weekly-report-screen.tsx`                                                                                                                                 |
| alerts             | `alerts/`             | `alerts/alerts-screen.tsx`, `alerts-hero.tsx`, `alerts-queue.tsx`, `forecast/forecast-alerts-group.tsx`                                                            |
| legal-forms        | `legal-forms/`        | `legal-forms/legal-forms-screen.tsx`, `legal-forms-panel.tsx`                                                                                                      |
| out-of-area        | `out-of-area/`        | `out-of-area/out-of-area-board.tsx`, `out-of-area-side.tsx`, `out-of-area-phone.tsx`                                                                               |
| on-call            | `on-call/`            | `on-call/on-call-screen.tsx`, `on-call-parts.tsx`, `on-call-phone.tsx`, `on-call.module.css`                                                                       |
| seclusion          | `seclusion/`          | `restrictive-practice/seclusion-screen.tsx` (from the route)                                                                                                       |
| governance         | `governance/`         | `ward-management-modes.tsx`, `governance-event-detail.tsx`, `governance-phone.tsx`                                                                                 |
| bed-meeting-tv     | `bed-meeting-tv/`     | `bed-meeting/bed-meeting-tv.tsx` (from imports)                                                                                                                    |
| agenda             | `agenda/`             | `bed-meeting/bed-meeting-agenda-screen.tsx` (from the route)                                                                                                       |
| downtime           | `downtime/`           | `reports/downtime-pack-screen.tsx`, `reports/use-take-downtime-pack.ts`                                                                                            |
| chronology         | `chronology/`         | `reports/patient-chronology-screen.tsx`                                                                                                                            |
| places             | `places/`             | `hub/hub-screen.tsx`                                                                                                                                               |
| community          | `community/`          | `community/community-index.tsx`                                                                                                                                    |
| community-team     | `community-team/`     | `community/community-screen.tsx`, `community-screen-drawer.tsx`, `community-screen-in-bed-tab.tsx`, `community-screen-panels.tsx`                                  |
| patient            | `patient/`            | `patients/patient-now-screen.tsx`, `patient-now-panel.tsx`, `patient-now-summary.tsx`, `patient-flight-header.tsx`                                                 |
| add-patient        | `add-patient/`        | `patients/add-patient.tsx` (from the route)                                                                                                                        |
| ward-answer        | `ward-answer/`        | `ward/ward-answer-view.tsx`                                                                                                                                        |
| settings           | `settings/`           | `settings/settings-screen.tsx`, `settings-panes.tsx`, `settings-rows.tsx`, `reset-baseline-modal.tsx`, `access-settings.tsx`                                       |
| sign-in            | `sign-in/`            | `src/components/ward-flow-sign-in/ward-flow-sign-in-screen.tsx`, `ward-flow-sign-in-data.ts`                                                                       |
| frame (today)      | `shell/`              | `shell/ward-bar.tsx`, `ward-bar-controls.tsx`, `ward-rail.tsx`, `ward-rail-lazy.tsx`, `ward-rail-entries.ts`, `ward-phone-menu.tsx`, `use-ward-nav-counts.ts`      |
| frame (new)        | `shell-next/`         | the same shell files plus `shell/ward-phone-menu-sheet.tsx`                                                                                                        |
| kit                | `parts/`              | new files for `src/components/wf`                                                                                                                                  |

**Role views** build into the same real files as their coordinator page, as role branches:

| Role folders                                                                                 | Real file(s)                                                                                                            |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `as-ward-home`, `as-bed-manager-ward`                                                        | as `ward`                                                                                                               |
| `as-ward-stays`                                                                              | as `stays`                                                                                                              |
| `as-ward-discharges`, `as-bed-manager-discharges`                                            | as `discharges`                                                                                                         |
| `as-ward-referrals`, `as-ed-referrals`, `as-community-referrals`, `as-bed-manager-referrals` | as `referrals`                                                                                                          |
| `as-ward-waiting`, `as-ed-waiting`                                                           | as `waiting`                                                                                                            |
| `as-ward-legal-forms`, `as-ed-legal-forms`                                                   | as `legal-forms`                                                                                                        |
| `as-ward-handover`, `as-ed-handover`                                                         | as `handover`                                                                                                           |
| `as-ward-statistics`, `as-bed-manager-statistics`                                            | as `statistics` (plus `statistics-hero.tsx`, `statistics-nav.tsx`)                                                      |
| `as-ed-statistics`                                                                           | `statistics/statistics-ed-screen.tsx`                                                                                   |
| `as-community-statistics`                                                                    | `statistics/statistics-community-screen.tsx`                                                                            |
| `as-executive-home`                                                                          | `statistics/statistics-network-cards.tsx`, `statistics-summary-phone.tsx`                                               |
| `as-ward-seclusion`, `as-bed-manager-seclusion`                                              | as `seclusion`                                                                                                          |
| `as-ward-alerts`, `as-officer-alerts`                                                        | as `alerts`                                                                                                             |
| `as-ward-settings`, `as-executive-settings`                                                  | as `settings`                                                                                                           |
| `as-admin-home`                                                                              | `settings/access-settings.tsx`                                                                                          |
| `as-admin-governance`                                                                        | as `governance`                                                                                                         |
| `as-ed-home`                                                                                 | `ed/ed-overview.tsx` and as `ed-board`                                                                                  |
| `as-community-home`                                                                          | `community/community-screen-hero.tsx`, `community-screen-phone.tsx`, `community-team-phone.tsx` and as `community-team` |
| `as-community-movements`                                                                     | as `movements`                                                                                                          |
| `as-community-patient`                                                                       | as `patient`                                                                                                            |
| `as-officer-home`                                                                            | as `transport`                                                                                                          |
| `as-bed-manager-home`, `as-executive-capacity`                                               | as `capacity`                                                                                                           |
| `as-bed-manager-wards`                                                                       | as `wards`                                                                                                              |
| `as-bed-manager-places`                                                                      | as `places`                                                                                                             |

**Popups and states:**

| Slug                                                                       | Real file(s)                                                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| pop-alerts                                                                 | app bar Alerts drawer: `shell/ward-bar.tsx`, `shell/ward-bar-lazy-panels.tsx`, `ward-tasks-drawer.tsx` |
| pop-tools                                                                  | `tools/ward-tools-sheet.tsx`                                                                           |
| pop-search                                                                 | `ward-global-search.tsx` (re-fork after #1123)                                                         |
| pop-help                                                                   | `help/ward-help-sheet.tsx`, `help/ward-help-ask.tsx`                                                   |
| pop-shortcuts                                                              | `help/ward-shortcuts-sheet.tsx`, `help/ward-help-content.ts`                                           |
| pop-tour                                                                   | `help/ward-tour.tsx`, `ward-tour-steps.ts`                                                             |
| pop-demo                                                                   | `shell/ward-demo-menu.tsx`                                                                             |
| pop-menu, pop-create                                                       | `shell/ward-phone-menu.tsx`, `ward-phone-menu-sheet.tsx`                                               |
| pop-ward-switcher                                                          | `ward/ward-screen.tsx` (`wardSwitchMenu`)                                                              |
| pop-shift-brief                                                            | `board/ward-daily-sheet.tsx`, `board/ward-shift-summary-card.tsx`                                      |
| pop-desk                                                                   | `settings/operator-switcher-modal.tsx`                                                                 |
| pop-service-picker                                                         | `shell/ward-bar-controls.tsx` (`WardBarServiceControl`)                                                |
| pop-more-pages                                                             | `shell/ward-rail.tsx` (its foot sheet)                                                                 |
| pop-bed-record                                                             | `ward/ward-bed-dossier-drawer.tsx`, `ward/ward-screen-overlays.tsx`                                    |
| pop-confirm-beds                                                           | `ward/ward-screen-overlays.tsx`                                                                        |
| pop-broadcast                                                              | `alerts/broadcast-composer.tsx`, `alerts/alerts-screen.tsx`                                            |
| pop-ward-notices                                                           | `ward/ward-notification-center.tsx`, `ward/ward-screen-top-bar.tsx`                                    |
| pop-refer-ward                                                             | unknown (the shared referral sheet: `referrals/referral-board-sheets.tsx`?)                            |
| pop-ed-actions                                                             | `ed/ed-screen-row-menu.tsx`                                                                            |
| pop-log-transport                                                          | `ed/ed-screen-transport-dialog.tsx`                                                                    |
| pop-officer-job                                                            | draws the Transport fork of `officer/officer-job-detail.tsx` (builds with `transport`)                 |
| pop-record-form                                                            | `legal-forms/legal-forms-sheets.tsx` (`RecordFormSheet`)                                               |
| pop-record-exam                                                            | unknown (today's step lives on the ED board's row forms, `ed/ed-screen-row-forms.tsx`?)                |
| pop-add-time                                                               | `legal-forms/legal-forms-panel.tsx`                                                                    |
| pop-state-error                                                            | `src/app/ward-flow/error.tsx`, `ward-flow-error-panel.tsx`                                             |
| pop-state-loading                                                          | `src/app/ward-flow/loading.tsx`                                                                        |
| pop-state-offline                                                          | `shell/ward-offline-banner.tsx`                                                                        |
| pop-state-toast                                                            | `src/components/wf/toast*.tsx` (after #1124)                                                           |
| pop-state-empty, pop-state-not-wired                                       | no single real file (drawn over Home)                                                                  |
| pop-bed-meeting-sheet, pop-scenario, pop-capacity-ward, pop-forecast-sheet | open from the `capacity` fork; build with Capacity                                                     |
| pop-movement                                                               | opens from the `movements` fork; builds with Movements                                                 |
| pop-activity                                                               | Home's Activity panel (`home-activity/activity-panel.tsx`); builds with Home                           |

## 6. Real-app bug list

| #   | Bug                                                                                                                                             | Status and owner                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | Restore says nine rules; it restores twelve                                                                                                     | needs a small PR (3.5)                                 |
| 2   | Settings Export writes things Import does not read                                                                                              | needs a small PR (3.5)                                 |
| 3   | Community save failures vanish (CT-09)                                                                                                          | small PR (D-91); #1124 A keeps it fixed                |
| 4   | Non-statewide coordinator's phone Rules sheet says "Save to apply"                                                                              | needs a small PR                                       |
| 5   | Two Settings search ids named the wrong way round (`settings-search-index.ts`)                                                                  | needs a small PR                                       |
| 6   | Toast covers the foot of Home and touches the phone dock                                                                                        | Phase 4 frame PR (notice position)                     |
| 7   | Board read each outcome twice to screen readers                                                                                                 | #1124 A                                                |
| 8   | Ward Notices badge and panel count differently                                                                                                  | #1124 A                                                |
| 9   | Record document dialog at z-index 9999, above its own toasts                                                                                    | #1124 A                                                |
| 10  | Contact typo matching ignores the "no person matched" gate                                                                                      | #1123 fix (3.4)                                        |
| 11  | Help still describes the removed All EDs keyword box                                                                                            | #1123 fix (3.4)                                        |
| 12  | Quick commands block shows "+15m" twice, sits 8 px off, clipped by the footer                                                                   | #1123 (labels fixed; check the offset and clip)        |
| 13  | Capacity's "See Waiting" link opens patients waiting, not held-up releases; Discharges has no Held up query                                     | needs a small PR, or the Capacity build                |
| 14  | "Synthetic prototype" pill in the app bar (Josh wants it gone; footer stays)                                                                    | Phase 4 frame PR                                       |
| 15  | New referral button: 14 px left padding, 5 px right (`ward-bar.module.css`)                                                                     | Phase 4 frame PR                                       |
| 16  | Names first name first: My ward tiles and round list, Notices, ED Lists and access-risk card, Stays' Worth a look, Transport, Out of area       | each page's build (D-83)                               |
| 17  | Surname first missing in shared code: `reports/use-take-downtime-pack.ts`, community record drawer, Add a patient's save toasts, chronology CSV | needs a small PR (shared code)                         |
| 18  | Referral slide-out uses `displayName` not `formalName` (`ward-referral-drawer-model.ts`)                                                        | needs a small PR, or the New referral build            |
| 19  | Bed meeting TV does not fit 1080p (Brief cut off)                                                                                               | Bed meeting TV build                                   |
| 20  | Planned admissions Book button stacks its icon over the word                                                                                    | Capacity build (one line)                              |
| 21  | Capacity ward panel links not checked against the desk's access                                                                                 | needs a small PR                                       |
| 22  | Statistics tab chips cut off at the phone's right edge (`StatisticsNav`)                                                                        | Statistics build                                       |
| 23  | Rail shows network figures on a site desk, "Handover in 4h 18m" on the executive desk, "Statewide" on Midland                                   | Phase 4 frame PR                                       |
| 24  | Side-panel Add the time uses a 12-hour browser time picker                                                                                      | needs a small PR, or Legal forms build                 |
| 25  | Date fields show mm/dd/yyyy in some browsers                                                                                                    | needs a small PR (DD/MM/YYYY text field)               |
| 26  | Referral alerts show a literal "Not recorded" as a legal chip                                                                                   | needs a small PR                                       |
| 27  | `wardLabel` writes "— open"                                                                                                                     | needs a small PR                                       |
| 28  | Bed 12 on the nurse in charge's My ward reads "Name not recorded" (out-of-scope `referralId` treated as broken)                                 | needs a small PR                                       |
| 29  | Kit segmented tabs 38 px tall on phones                                                                                                         | kit standard PR (larger invisible tap area, not 48 px) |
| 30  | Discharges shows three totals (207, 63, 59) with no agreed meaning                                                                              | needs Josh's decision, then the Discharges build       |
| 31  | Shared phone hero shows 3 of 5 figures                                                                                                          | the build of the page that uses it                     |
| 32  | Officer, Answer-view and discharge "ready to leave" toasts still use their own code; Officer has its own Undo (D-57 item 17)                    | needs a small PR after #1124 A                         |
| 33  | About 20 hand-built modals with their own scrim, radius and z-index                                                                             | later pass onto the shared `Dialog`                    |
| 34  | `window.confirm` in `use-dirty-state-guard.ts` (twice) and `ward-tasks-drawer.tsx`                                                              | needs a small PR                                       |
| 35  | Shareable preview bundle dropped scoped styles                                                                                                  | fixed in the mock-up bundle script (mock-up only)      |

## 7. Checks not yet run anywhere

| Check                                                                          | Where it is missing                                                        |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Full `npm run verify:pr-local -- --base origin/main`                           | #1118, #1119, #1124 (lint and typecheck per file only), #1123 (unfinished) |
| Playwright suites (`npm run test:e2e:ward-journeys`, `ui-ward-search.spec.ts`) | #1118, #1123, #1124 (#1119 ran its two Help specs only)                    |
| `npm run build` and the phone script budget                                    | all four PRs                                                               |
| Hosted CI on the current head                                                  | all PRs; read only with Josh's yes                                         |
| Full history checks (`check:dead-code-candidate`, `check:stale-docs`)          | blocked on a shallow clone; deepening needs Josh's yes                     |
| A real screen reader (VoiceOver, NVDA)                                         | nowhere; #1124's read-once and inert cards need it most                    |
| Colour contrast on every page, light and dark                                  | nowhere as a full pass                                                     |
| Physical iPhone, Safari and installed app                                      | nowhere                                                                    |
| #1124's folded stack in a real browser                                         | DOM tests only                                                             |

Local checks do not prove hosted CI, and Chromium does not prove Safari. A skipped or deferred check is never a pass.

# Settings mock-up: handover

_Updated 2026-10-31 - full handover of Settings round 3 and Josh's answers; draft PR #1122; Design owns._

This is the one place to start for the Settings mock-up work. It explains what was asked, what was
built and why, what Josh decided, how it was checked, and what is still open.
[SETTINGS-ROUND-3.md](SETTINGS-ROUND-3.md) keeps the shorter change list.
For an independent review in another chat, use
[SETTINGS-REVIEW-HANDOVER.md](SETTINGS-REVIEW-HANDOVER.md), which ends with a copy-paste prompt.

## Where it stands

- **Mock-up only.** No real `/ward-flow` screen has changed. Nothing is built into the app until Josh
  approves this mock-up (D-74).
- **Branch:** `claude/settings-mockup-improvements-9j8gcz` of `BigSimmo/Ward-Flow`, pushed. It starts
  from `claude/core-pages-design-review-f5vf4g` at `9da375a1`, which carries `main` at `b6aa5cd`, the
  app these pages depict (D-75).
- **Pull request:** draft [#1122](https://github.com/BigSimmo/Ward-Flow/pull/1122), into
  `claude/core-pages-design-review-f5vf4g` (itself draft #1118), so its diff shows only the Settings
  work. Do not merge into `main`. Do not arm auto-merge.
- **Review page for Josh:** https://claude.ai/artifact/DYY3QFivR4pKS6LkPFNpL3, private, with screenshots,
  the reason for each change and Josh's answers.
- **Waiting on Josh:** (1) a yes to merge the design branch into this branch to clear one small
  conflict (below); (2) approval of the Settings mock-up for building, or changes.

## What Josh asked for, and what he decided

| Date   | Josh said                                                                                                                                             | What happened                                                                            |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 30 Oct | Suggestions, grounded in the repo and the two mock-up chats, to improve Settings: functionality, design, usability, logic, smart and general settings | Researched today's Settings and the round 1 and 2 mock-ups; wrote a plan                 |
| 30 Oct | "Go ahead with all recommendations"                                                                                                                   | Built round 3 as a mock-up, pushed, published the review page                            |
| 31 Oct | "Yes to all recommendations" (the three round 3 questions)                                                                                            | Kept Open Ward Flow on and Text size; dropped Theme follows the shift; recorded the rest |
| 31 Oct | Open a PR with a handover and the review link                                                                                                         | Draft #1122 opened; handover added                                                       |

Josh's three answers on 31 October:

1. Keep **Open Ward Flow on** and **Text size**; drop **Theme follows the shift**.
2. Show the **review before every save**.
3. Show **Who can change what** on every desk with an Access tab.

These answer the mock-up's questions. They are not approval to build.

## The work, explained

Each item says what changed, why, and where it lives (`src/components/ward-redesign/settings/` unless
stated).

1. **Tabs, one job each.** Rules, Alerts, Display and profile, Help and data, Access. Today Help, the
   tour and Shortcuts sat under Display, and "Data and about" mixed rule files, developer switches,
   reference tables and About. Round 1's merge of Profile into Display (kept by Josh on 30 Oct) stays.
   _Where:_ `settings-tabs.ts`.
2. **Rules in four cards by job:** ED and placement, Form warnings, Deadlines and reply targets, Forecast
   alerts. Morning bed numbers joined the reply targets rather than sit alone in a one-row card (no
   near-empty panels). Safeguard wording ("Your defaults, not legal limits", "not clinical standards")
   is kept word for word. _Where:_ `settings-rules-pane.tsx`.
3. **Live impact on each rule.** Each rule says what it reaches on today's records, such as "5 people
   over now" or "2 forms in Early warning now", and "if saved" while it is being changed. The counts use
   the app's own checks, never a second calculation: `publishedThresholds` for the ED target,
   `clockState` on the recorded due time for form warnings (D-70: typed times only, nothing computed),
   and `decisionTargetReading` for the three reply targets. Pull time limit counts beds pulled now and
   says a change applies from the next pull, because each pull keeps the limit it was made with. Morning
   bed numbers and the forecast alerts show no count, because the app has no single check to read for
   them. _Where:_ `settings-rule-impact.ts`.
4. **Honest Surge.** Surge sets Wards asked at once to 3, which is already the default, so it really
   changes two rules. The card now says "Surge changes 2 rules" and names them, from the same values
   the switch writes. _Where:_ `settings-rule-catalogue.ts` (`surgeChanges`).
5. **Changed from default, and Show changed only.** A rule away from its default says "Default 24h"
   after its range; one switch hides every rule at its default and any card left empty. _Where:_
   `settings-rows.tsx` (`defaultValue`, `data-at-default`), `settings-redesign.module.css`.
6. **One line for history.** The five-row Recent changes card became one line at the top: the last
   save, who made it, what moved, and Full audit. Full audit left the save bar so it lives in one place.
7. **Review before saving.** Save opens a short review: each change before and after, where it shows,
   and its count after saving. A loaded rules file lands in the same review, so a file never changes a
   rule unseen. Download now writes the saved rules only. _Where:_ `settings-review-dialog.tsx`,
   `settings-screen.tsx`.
8. **Honest restore.** Lists all twelve rules and asks "Rules only" or "Rules and this browser", naming
   the seven browser settings that come back. A desk that cannot change rules restores its own browser
   only. _Where:_ `settings-restore-dialog.tsx`.
9. **Will alerts reach you here?** A card beside the Alerts switches counts how many of the four ways
   an alert reaches this browser are ready, gives one next step, and sends a real test notification. It
   repeats none of the switches (a first version did, and was folded in). _Where:_
   `settings-alerts-check.tsx`.
10. **Two new browser settings (agreed 31 Oct):** Open Ward Flow on (start page, from the desk's own
    pages) and Text size (Standard or Larger). They work in the preview only, are not saved, and need
    the app to read them before they can be built (D-72). _Where:_ `settings-display-pane.tsx`.
11. **Help and data.** Help and the tour first; then each data action on its own labelled row
    (Download, Load, Copy diagnostics, Clear this tab, Restore); About; the Reference tables at full
    width; the nine developer switches folded under For developers. _Where:_ `settings-help-data.tsx`,
    `settings-reference-card.tsx`.
12. **Find a setting** finds rows it could not before (each reply target and forecast alert, clinical
    values, Copy diagnostics, the alerts card, Access, Who can change what), and only on the tabs this
    desk has. _Where:_ `settings-tabs.ts`.
13. **Who can change what.** A read-only table under Access. Its rules row is read from the app's own
    permission table (`EVENT_ROLE`); the cover, roles, access log and browser rows are written text that
    matches today's Access screen and D-66, D-80 and D-86, so they would need updating by hand if those
    rules change. (An earlier note said the whole table "cannot drift"; that overstated it and was
    corrected on 31 Oct.) The third-edition HTML drawings' statutory switches are not taken (D5, D-70,
    D-71). _Where:_ `settings-who-can.tsx`.
14. **One component for every desk.** The nurse in charge and access admin views were separate
    1,500-line copies. They are now the one Settings component with `ROLE BRANCH (ward)` and
    `ROLE BRANCH (admin)` comments, as the other role views do, and an executive view was added
    (`as-executive-settings`). The real build becomes one file.
15. **Styling that survives the shareable copy.** Round 2 restyled Settings with `[class*="_x__"]`
    selectors, which the shareable bundle silently drops. Every element now carries this folder's own
    class. Text wraps instead of ending in "…" on a phone; the profile card's Appearance row went
    because it repeated the Display card beside it.

## Owner rules that shaped it

Restructure, not restyle, with a reason for each change (Josh, 30 Oct); do not strip too far (Home
lesson); one filled button per panel; counts name their noun; wrap, never "…"; no empty panels; no
48 px enlargements (invisible tap areas instead); surname first (D-83); D4 and D-72 (never show a
control nothing reads, so the two new settings are marked preview-only); D5 and D-70 (no computed legal
times); D-22 wording; design tokens only; D-74 and D-75 for mock-ups.

## Bugs found in today's real app (fix in the build, after approval)

- The Restore dialog says "all nine rules" but restores twelve (the three forecast alerts too), and
  resets only theme, glare, sidebar and buzz.
- Export writes the unsaved draft plus the theme and sidebar, but Import reads rules only.
- A coordinator who is not the statewide one sees "Save to apply" on the phone Rules sheet, though they
  cannot save.
- The settings search names two rows the wrong way round internally (`second-warning` is Early warning).

## Files

| Area                    | Files                                                                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Screen and tabs         | `settings-screen.tsx`, `settings-tabs.ts`                                                                                                                                                           |
| Rules                   | `settings-rules-pane.tsx`, `settings-rows.tsx`, `settings-rule-catalogue.ts`, `settings-rule-impact.ts`, `settings-save-bar.tsx`                                                                    |
| Dialogs                 | `settings-review-dialog.tsx`, `settings-restore-dialog.tsx`                                                                                                                                         |
| Other tabs              | `settings-alerts-check.tsx`, `settings-display-pane.tsx`, `settings-profile-card.tsx`, `settings-help-data.tsx`, `settings-reference-card.tsx`, `settings-who-can.tsx`                              |
| Styles                  | `settings-redesign.module.css`                                                                                                                                                                      |
| Role views              | `as-ward-settings/as-ward-settings-page.tsx`, `as-admin-home/as-admin-home-page.tsx`, `as-executive-settings/as-executive-settings-page.tsx` (new)                                                  |
| Retired                 | `as-ward-settings/settings-screen.tsx`, `as-ward-settings/settings-profile-card.tsx`, `as-admin-home/settings-screen.tsx`, `as-admin-home/settings-tabs.ts`, `settings/settings-targets-column.tsx` |
| Preview registry, notes | `src/app/mockups/ward-flow-redesign/_preview/{screens.ts,built-pages.ts,screen-components.tsx,build-notes.ts}`                                                                                      |
| Design notes            | this file, `SETTINGS-ROUND-3.md`, one pointer in `HANDOVER.md`                                                                                                                                      |

The rule list in `settings-rule-catalogue.ts` is the one source for each rule's name, wording, default
and readers; the review, restore, default marks and search all read it.

## How it was checked

- **Passed locally:** prettier; eslint with no warnings; typecheck; knip (no findings in Settings
  files); `check:mockups`; `check:ward-text-size`; `check:type-scale`; `docs:check-links`,
  `docs:check-inventory`, `docs:maintain:check`, `docs:facts`, `docs:freshness`; `ward:organise:check`;
  and the commit hook on every commit.
- **Looked at in a browser:** every Settings tab and dialog at 1440 px, 820 px and 390 px, light and
  dark; the three role views; no sideways scrolling; no page errors. The built shareable copy was
  checked to render Settings the same as the dev server.
- **Not done:** hosted CI was not watched. The full clickable shareable bundle (14 MB) was not published,
  because it could not be read in full first; the review page is screenshots instead. No unit tests were
  added (mock-up code).

## Open items

1. **Merge conflict, waiting on Josh's yes.** After this branch started, the design branch (b976c0f86)
   deleted `ScopeLine` from `settings/settings-rows.tsx` because nothing there used it. This branch uses
   it on the Display and Alerts tabs. Fix: merge the design branch in with a normal merge and keep
   `ScopeLine`. Ward Flow rule 5 needs a yes before resolving divergent history.
2. **Approval for building (D-74).** On approval: one real Settings file with role branches; replace the
   hand-written rule lists in `reset-baseline-modal.tsx`, `settings-search-index.ts` and `ruleDiffs`
   with the rule list; fix the bugs above; wire Open Ward Flow on (the front door) and Text size (the
   text scale) before showing them (D-72).
3. **Not built on purpose:** a count for Morning bed numbers and the forecast alerts (no single check
   exists to read); scheduled Surge (needs a new command).

## How to pick it up

1. Check out `claude/settings-mockup-improvements-9j8gcz` and confirm both `origin` URLs name
   `BigSimmo/Ward-Flow`. A cloud clone may be shallow; the push guard needs `git fetch --unshallow
origin` (network Git, needs Josh's yes).
2. Node 24: if `/opt/node24/bin` is missing, unpack v24 there; then `npm ci --include=dev`.
3. Post a claim on the pinned "Who is editing what" issue (#688) and write a `WARD_SIGNOUT_FILE` claim
   file. It needs an `## Active sign-outs` heading and lines shaped
   `- date | owner | branch | worktree | paths | repo=BigSimmo/Ward-Flow`, or the commit hook refuses.
4. `npm run ensure`, then open `/mockups/ward-flow-redesign/settings` (and `as-ward-settings`,
   `as-admin-home`, `as-executive-settings`). Settings tabs are radio buttons to Playwright, not tabs.
5. Before each commit: prettier and `eslint --max-warnings 0` on changed paths; knip before pushing.

## Lessons from this session

- A clean-up command that matches on its own text (`pkill -f "<text>"`) kills its own shell; find the
  process id first.
- The design branch kept moving while this work ran; check `git merge-tree` against it before opening a
  PR.
- The shareable bundle minifies class names, so check styling in the built copy, not only the dev
  server.

# Settings mock-up: handover for an independent review

_Updated 2026-10-31 - account of the Settings mock-up work for a separate review chat; Design owns._

This is an account of what one chat did on the Ward Flow Settings mock-up, written so Josh can take it
to another chat for review and assessment. It records what was done, why, how it was checked and what
is uncertain. It does not ask the reader to change anything. A copy-paste prompt is at the end.

The working handover for whoever continues the work is [SETTINGS-HANDOVER.md](SETTINGS-HANDOVER.md);
the short change list is [SETTINGS-ROUND-3.md](SETTINGS-ROUND-3.md).

## The work in one paragraph

Josh asked for suggestions to improve Ward Flow's Settings page, grounded in the repository and in
two earlier mock-up chats, then approved all of them. The chat built them as an interactive React
mock-up inside the existing mock-up viewer (`/mockups/ward-flow-redesign/settings` and three role
views), on its own branch, without changing the real app. It then applied Josh's answers to three
follow-up questions, opened a draft pull request into the design chat's branch, and wrote handovers.
Nothing has been built into the real `/ward-flow` screens; that needs Josh's explicit approval of the
mock-up (owner rule D-74).

## Where everything is

| What                      | Where                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Repository                | `BigSimmo/Ward-Flow` (synthetic-data prototype for psychiatric bed flow in Western Australia)                              |
| Branch                    | `claude/settings-mockup-improvements-9j8gcz`                                                                               |
| Branched from             | `claude/core-pages-design-review-f5vf4g` at `9da375a1`, which carries `main` at `b6aa5cd`                                  |
| Pull request              | Draft [#1122](https://github.com/BigSimmo/Ward-Flow/pull/1122), into the design branch (draft #1118), not `main`           |
| Code                      | `src/components/ward-redesign/settings/` and three role-view page files                                                    |
| Viewer registry, notes    | `src/app/mockups/ward-flow-redesign/_preview/` (`screens.ts`, `built-pages.ts`, `screen-components.tsx`, `build-notes.ts`) |
| Design notes              | `design/core-pages-review-2026-10/` (this file, `SETTINGS-HANDOVER.md`, `SETTINGS-ROUND-3.md`)                             |
| Review page (screenshots) | https://claude.ai/artifact/DYY3QFivR4pKS6LkPFNpL3, private to Josh unless he shares it                                     |
| Today's real Settings     | `src/components/ward-management/settings/` and `src/app/ward-flow/settings/page.tsx` (unchanged)                           |

## Timeline and decisions

| Date   | Josh                                                                                                                                                            | The chat                                                                                                        |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 30 Oct | Asked for suggestions to improve Settings (functionality, design, usability, logic, smart and general settings), grounded in the repo and the two mock-up chats | Read today's Settings, the round 1 and 2 Settings mock-ups, the design handover and owner rulings; wrote a plan |
| 30 Oct | "Go ahead with all recommendations"                                                                                                                             | Built round 3; pushed; published a screenshot review page                                                       |
| 31 Oct | "Yes to all recommendations" on three questions                                                                                                                 | Kept two new browser settings, dropped one; recorded the other two answers                                      |
| 31 Oct | Asked for a PR with a handover and the review link                                                                                                              | Opened draft #1122; wrote `SETTINGS-HANDOVER.md`                                                                |
| 31 Oct | Asked for this review handover                                                                                                                                  | Wrote this file; corrected one overstated claim (below)                                                         |

Josh's three answers (31 Oct): keep **Open Ward Flow on** and **Text size**, drop **Theme follows the
shift**; show the **review before every save**; show **Who can change what** on every desk with an
Access tab.

## What was built

1. **Tabs by job:** Rules, Alerts, Display and profile, Help and data, Access (was Rules, Alerts,
   Display, Profile and shift, Data and about, Access).
2. **Rules in four cards:** ED and placement; Form warnings; Deadlines and reply targets (Morning bed
   numbers joined here); Forecast alerts.
3. **Live counts on rules,** reusing the app's own functions: `publishedThresholds` (ED target),
   `clockState` with the recorded legal due time (form warnings), `decisionTargetReading` (three reply
   targets). Pull time limit shows beds pulled now, because a pull keeps the limit it was made with.
   Morning bed numbers and the forecast alerts show no count.
4. **Surge** says it changes 2 rules (its third value equals the default).
5. **Default marks** ("Default 24h") and a **Show changed only** switch.
6. **Last change** as one line instead of a five-row card.
7. **Review before saving,** also used for a loaded rules file; Download writes saved rules only.
8. **Restore** lists all 12 rules; choose "Rules only" or "Rules and this browser" (seven named settings).
9. **Alerts readiness card:** how many of four ways are ready, one next step, a real test notification.
10. **Two new browser settings** (Open Ward Flow on, Text size): preview-only, not saved, not read by
    the app.
11. **Help and data:** Help, tour and shortcuts; labelled data rows; About; Reference at full width;
    developer switches folded.
12. **Find a setting** gains rows and searches only the desk's own tabs.
13. **Who can change what** (read only) under Access.
14. **One component for all desks:** nurse in charge, access admin and a new executive view share the
    coordinator's Settings component with `ROLE BRANCH` comments; two 1,500-line copies were deleted.
15. **Styling:** own CSS classes replace `[class*="_x__"]` overrides that the shareable bundle dropped;
    text wraps on a phone.

## How it was checked, and what was not

- **Run locally, passed:** prettier; eslint with zero warnings; full typecheck; knip (no findings in the
  Settings files; other pages on the branch have older findings); `check:mockups`;
  `check:ward-text-size`; `check:type-scale`; `docs:check-links`, `docs:check-inventory`,
  `docs:maintain:check`, `docs:facts`, `docs:freshness`; `ward:organise:check`; the commit hook on each
  commit.
- **Looked at in a browser (Playwright screenshots):** every tab and both dialogs at 1440, 820 and
  390 px, light and dark; the three role views; no sideways scrolling; no page errors. The built
  shareable bundle was checked to render Settings the same as the dev server.
- **Not done:** hosted CI was not watched; no unit or DOM tests were added (mock-up code; today's
  Settings tests run against the real screen, not the mock-up); no accessibility audit beyond keeping
  the kit's components and labels; the full 14 MB clickable bundle was not published because it could
  not be read in full first; no real or production data was touched.

## Known limits, uncertainties and corrections

These are facts about the current state, recorded for the reviewer's judgement.

- **Corrected claim.** Earlier notes, the PR description and the review page said the Who can change
  what table was read from the app's permission table and "cannot drift". Only its rules row reads
  `EVENT_ROLE`; the cover, roles, access log and browser rows are written text matching today's Access
  screen and D-66, D-80 and D-86. Corrected on 31 Oct in the notes, the PR and the review page.
- **Merge conflict with the base branch.** After this branch started, the design branch (b976c0f86)
  deleted `ScopeLine` from `settings/settings-rows.tsx` as unused; this branch uses it. The PR shows a
  conflict in that one file. Resolving it is waiting on Josh's yes (Ward Flow rule 5).
- **Not merged with `claude/home-activity-mockup`.** That branch owns "one size per control" and a
  wording sweep; it conflicts with the design branch in four non-Settings files. Round 3 copied its
  size values by reading them, not by merging.
- **Overlapping ownership.** The design handover (30 Oct) gives the design chat every mock-up page
  except Home and Activity. This chat worked on a separate branch, claimed and released its files on
  the "Who is editing what" issue (#688), and did not push to the design branch.
- **The two agreed browser settings** are drawn but unwired (D-72 forbids shipping controls nothing
  reads). Text size only previews the effect on its own line.
- **Live counts** depend on the synthetic demo night (pinned at 10:42). The ED count names people; it is
  `publishedThresholds`' own figure. Form-warning counts compare recorded due times with the warning
  windows exactly as today's screens do; nothing computes a legal period.
- **The readiness card counts "On the Home Screen" as one of four ways.** Being installed is a
  precondition for phone alerts on some devices rather than an alert route of its own.
- **Copied code.** `settings-reference-card.tsx`, `settings-display-pane.tsx`, `settings-help-data.tsx`
  and the Alerts card copy parts of today's `settings-panes.tsx`, as the mock-up method requires (copy
  the real file, then change it). Every desk's Access tab uses the access admin's round 2 copy of the
  Access panel.
- **File size.** `settings-screen.tsx` is 1,319 lines (cap 1,500); the rest were split out.
- **Real-app bugs found, not fixed** (the real app is out of scope): the restore dialog says nine rules
  but restores twelve; Export writes things Import does not read; a non-statewide coordinator's phone
  Rules sheet says "Save to apply"; two search ids are named the wrong way round.
- **The review page is private.** A reviewer cannot open it unless Josh shares it; the same pictures
  can be regenerated from the branch with `npm run ensure`.

## Owner rules that applied

D-74 (no build without mock-up approval), D-75 (mock-ups made from the running app at a named commit),
the 5 October React mock-up rule (copy real components; no throwaway HTML), Josh's 30 October review
method (restructure, one place per piece of information, a reason for each change), round 2 style rules
(no 48 px enlargements, counts name their noun, wrap not "…", one filled button per panel, no empty
panels), D4 and D-72 (unconnected controls), D5 and D-70 (no computed legal times), D-22 wording,
D-83 (names), design tokens only, synthetic data only.

## Copy-paste prompt for the review chat

```text
I'm handing you an account of work another chat did on my Ward Flow prototype, so you can review and
assess it with fresh eyes. This is background, not a list of instructions; please don't change any files.

Project: BigSimmo/Ward-Flow, a synthetic-data prototype for psychiatric bed flow in Western Australia.
I'm a psychiatrist, not a software engineer, so please write to me in plain English.

What was done: the other chat redesigned the Settings page as an interactive React mock-up (round 3),
inside the existing mock-up viewer, without changing the real app. Nothing is built into the real app
until I approve the mock-up (owner rule D-74).

Where it is:
- Branch: claude/settings-mockup-improvements-9j8gcz
- Draft pull request: https://github.com/BigSimmo/Ward-Flow/pull/1122 (into
  claude/core-pages-design-review-f5vf4g, not main)
- Start with: design/core-pages-review-2026-10/SETTINGS-REVIEW-HANDOVER.md on that branch. It covers
  what was built, the timeline and my decisions, the checks run and not run, and the known limits and
  corrections. SETTINGS-HANDOVER.md and SETTINGS-ROUND-3.md in the same folder have more detail.
- Code: src/components/ward-redesign/settings/ and the role-view pages; today's real Settings is in
  src/components/ward-management/settings/ (unchanged).
- Mock-up pages: /mockups/ward-flow-redesign/settings, /as-ward-settings, /as-admin-home and
  /as-executive-settings on the local server (npm run ensure prints the address).
- Screenshot review page: https://claude.ai/artifact/DYY3QFivR4pKS6LkPFNpL3 (private to me unless I
  share it with you).

My decisions so far: I approved all of the other chat's recommendations (30 Oct). On 31 Oct I kept
"Open Ward Flow on" and "Text size", dropped "Theme follows the shift", agreed the review before every
save, and agreed "Who can change what" on every desk with an Access tab.

Open items: a one-file conflict with the base branch waits on my yes, and the mock-up itself waits on
my approval for building.

The project's rules are in AGENTS.md at the repository root; anything that touches GitHub, providers
or network Git needs my confirmation first.

I'd like your review and assessment of this work.
```

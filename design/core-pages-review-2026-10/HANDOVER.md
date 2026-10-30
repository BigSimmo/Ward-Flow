# Redesign mock-ups: handover and plan

_Updated 2026-10-30 - round 2 polish done on every page, popup, state and role view; ownership split with the Home and Activity chat; waiting on Josh's review; Design owns._

**Status: mock-ups for Josh's review. No real screen has changed (D-74).** Everything below lives on
branch `claude/core-pages-design-review-f5vf4g` of `BigSimmo/Ward-Flow`, shown in draft pull request #1118
(do not merge; Josh reviews page by page).

## Start here (new chat)

1. Read this file, then `design/core-pages-review-2026-10/HANDOVER-TOOLS.md` (the helper scripts, which
   lived in the old session's scratch folder and are gone).
2. Check out branch `claude/core-pages-design-review-f5vf4g`, confirm both `origin` URLs name
   `BigSimmo/Ward-Flow`. A cloud container may hold a shallow clone; the push guard then refuses until
   the full history is fetched (`git fetch --unshallow origin`, which needs Josh's yes as network Git).
   Node 24 is required: if `/opt/node24/bin` is missing, unpack the latest v24 from nodejs.org there,
   then run `npm ci --include=dev` with it on the `PATH`.
3. Recreate the sign-out claim file the commit hook needs (one line naming the paths under "Checks before
   each commit" below, with `repo=BigSimmo/Ward-Flow`), and pass it as `WARD_SIGNOUT_FILE` on each commit.
4. Run `npm run ensure` and open `/mockups/ward-flow-redesign` at the printed address.
5. Everything in "Remaining plan" and "Round 2" is done. Next is Josh's page-by-page review: apply his
   answers to the build notes' "Still open" and "Question for you" points, then refresh the private preview.
6. Check "Who owns what (30 October, evening)" below before editing any folder.

Josh's standing go-ahead: push to this branch only (draft PR #1118, not to be merged or marked ready), no change to the real `/ward-flow`
screens (D-74), and apply every recommendation without waiting for answers.

## What Josh asked for

1. Review every Ward Flow page on every device, and fix poor design (Capacity's bed forecast first).
2. Build "perfected" mock-ups of every page and popup **from the real app components**, so an approved
   design can go straight into the app (owner direction of 5 October in `docs/agents/building-ui.md`).
3. Go ahead with **every recommendation** in the 23-point list (29 October), without waiting for answers.
4. 30 October feedback: fix the overlaps, the poorly spaced New referral button and all broken styling;
   remove the Filter queue box from Referrals; keep this plan and a handover pushed in case of interruption.

## How the mock-ups are built

- **Address:** `/mockups/ward-flow-redesign` (the viewer) and `/mockups/ward-flow-redesign/<slug>` (one
  page). Blocked in production. `?theme=dark` and `?pop=<name>` work on any page.
- **Real app underneath:** the layout mounts the real `WardFlowProvider` (clock fixed at 10:42), toasts,
  overlays, the real rail and app bar. Links and router calls are mapped back to mock-up pages
  (`_preview/preview-shell.tsx`, `_preview/screens.ts`).
- **Each redesigned page is a copy ("fork") of today's screen** in `src/components/ward-redesign/<page>/`,
  with the design changes applied. Comparing the copy with the original shows exactly what changes, so an
  approved page is built by applying that difference to the real file.
- **Forking:** copy the screen file, change every relative import (`./x`, `../x`, `import("./x")`) to
  `@/components/...`, rename the export, then edit. New parts go in a sibling file.
- **Files over 1,500 lines:** the repository caps files at 1,500 lines. Until now big screens were either
  split into two fork files (Legal forms, Statistics helpers) or drawn as the real screen with a scoped
  redesign stylesheet (My ward, Patients, On-call). **Josh said on 30 October that raising the limit is
  fine.** Before using that, record it as an owner decision (`docs/agents/native-startup/recording-decisions.md`;
  recorded as D-89 in `docs/ward-flow/decisions.md`), then add the preview fork's path to
  `eslint-rules/max-lines-baseline.mjs` rather than trimming comments. The ratchet test
  (`tests/max-lines-baseline.test.ts`) must still pass.
- **Registering a page:** add the slug to `_preview/built-pages.ts`, the component to
  `_preview/screen-components.tsx`, and notes to `_preview/build-notes.ts`.
- **Shareable copy:** `node scripts/ward-flow/build-redesign-preview.mjs` bundles the same components into
  `output/redesign-preview/` (not committed) for publishing as an artifact.
- **Checks before each commit:** `npx prettier --write` and `npx eslint --max-warnings 0` on the changed
  paths (the push hook runs lint with no warnings allowed). The commit hook needs the sign-out claim file
  (`WARD_SIGNOUT_FILE`) to cover `src/components/ward-redesign/`, `src/app/mockups/ward-flow-redesign/`,
  `scripts/ward-flow/build-redesign-preview.mjs`, `scripts/ward-flow/redesign-preview/`,
  `mockups/README.md`, `docs/site-map.md` and `design/core-pages-review-2026-10/`. Never `--no-verify`.
- **Local server:** `npm run ensure` (never assume a port). Node 24 is at `/opt/node24/bin`.

## Done so far

| Page                 | How                   | Main changes                                                                          |
| -------------------- | --------------------- | ------------------------------------------------------------------------------------- |
| Capacity             | New, real derivations | Full-width forecast with 7-day chart, By ward switch, bed map cards, side column      |
| Home                 | Fork                  | Beds that fit table, Checking chip, oldest alert to place (keeps Josh's v7 rule)      |
| Movements            | Fork                  | Stage pipeline, Tier 1 in the side column, full names                                 |
| Waiting              | Fork                  | Daily check line, wait bands, site codes                                              |
| All EDs              | Fork                  | One-line title, cards only for EDs with someone waiting                               |
| Referrals            | Fork                  | Rows wrap, Offered to wards table, written history folded                             |
| New referral         | Fork of the slide-out | Calmer Catchment card                                                                 |
| Handover             | Fork                  | One-line since summary, sticky sign-off bar, Due by Show more                         |
| My ward              | Real screen + styles  | Full names on tiles, 3 actions plus More, busiest Ward flow list                      |
| Stays and discharges | Fork                  | Ward home hero, one figures line, one notice, five cards a row                        |
| ED board             | Fork                  | One table, Lists folded, form number only, links in the footer                        |
| Transport            | Fork                  | Surname first, jobs line beside the title, "from → to" routes, missing forms marked   |
| Patients             | Real screen + styles  | Cells wrap, chips wrap                                                                |
| Discharges           | Fork                  | "59 to work now of 207 open", person first, one action a row, blocker counts beside   |
| All wards            | Fork                  | Status, Cohort and Order as menus, key and count on one line, card text wraps         |
| Statistics           | Fork (split helpers)  | View switch with Open a unit, occupancy first, chart's first 7 rows                   |
| Alerts               | Fork of 4 files       | Checks as one chip, Owner menu, same-kind groups, one Release plus Hand back          |
| Legal forms          | Fork split in two     | Times as typed, no countdown (point 18); the due-soon colour and counts remain (open) |
| Out of area          | Fork                  | Surname first, quieter hero and checks, region beds open on choice                    |
| On-call              | Real screen + styles  | Compact two-line service strip that scrolls on smaller screens                        |
| Seclusion            | Fork                  | Table of every secure ward's room, header counts, ward record beside it               |
| Governance           | Fork + styles         | Pane opens on the newest event, cells wrap, list full height                          |
| Bed meeting TV       | Fork                  | One-line tiles, surname first, three tables (laptop); 1080p shows every panel         |
| Meeting agenda       | Fork                  | Header counts, four lists two by two, surname first, small + Action                   |
| Downtime pack        | Fork                  | One table at a time on screen with tabs; print keeps all four                         |
| Chronology           | Fork                  | Header patient search, demo night's patients, what a chronology holds                 |
| Places               | Fork                  | A directory with no bed figures (point 21), search first, opens on a place            |
| Community            | Fork                  | Live team count, full-width suburb lookup, page-scrolling A to Z                      |
| Community team       | Fork (3 files)        | One caseload table, surname first, row opens the record                               |
| Patient record       | Fork (2 files)        | Recorded-events timeline, surname first                                               |
| Statistics compare   | Fork (3 files)        | Open a unit from the tab row, first 8 rows, occupancy first                           |
| Statistics ward list | Fork                  | Chips on one row, first services and wards then Show more                             |
| Statistics one ward  | Fork (3 files)        | Compact shaded bed map, roster first 8 rows (the admissions table)                    |
| Statistics weekly    | Fork (2 files)        | Pilot measures in one table, Counted outside Ward Flow panel                          |
| Add a patient        | Fork                  | Duplicate check inside Identity, live Needed list, surname first                      |
| Ward answer          | Fork (D-89 cap)       | One-line All answered, census squares coloured by state with a key                    |
| Settings             | Fork (3 files)        | Sticky save bar, compact steppers, Display and profile tab (real data)                |
| Sign in              | Fork                  | Open as <role> button, no boxed role numbers                                          |

Popups: all 31 are built (the five page popups above plus 26 built on 30 October), and the six states.
The preview draws a popup or state from `_preview/popup-components.tsx` (keyed by its `pop` name), handed
the page it opens over; the five older ones are still opened by their page through `openOnLoad`. Each one's
build notes are in `_preview/build-notes.ts` under `pop-<name>`.

## The 23 points: what is being applied

Josh said on 30 October to go ahead with every recommendation. Points 20 to 22 had no recommendation in
the list, so the ones below are mine, applied in the mock-ups and flagged for Josh to confirm on review.

| #   | Point                                     | Action                                                                                       |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Text under 12 px                          | Real components carry the floor; new styles use `--wf-fs-12` and up. Run the text-size check |
| 2   | Phone buttons under 48 px                 | Every new control is 48 px on phone; check each page at 390 px                               |
| 3   | Not built from real components            | Done by this rebuild                                                                         |
| 4   | Buttons did not work                      | Real wiring in every fork                                                                    |
| 5   | "Jenkins, Sarah"                          | Real synthetic data now ("Jenkinwood, Sarah")                                                |
| 6   | Small overflows                           | Check every page at 1440, 1280, 820 and 390                                                  |
| 7   | New referral form                         | Done                                                                                         |
| 8   | Missing popups                            | To build (list below)                                                                        |
| 9   | Missing states                            | To build: loading, empty, error, offline, toast, "Not wired in this prototype."              |
| 10  | Statistics placeholders                   | To build: admissions table, Settings Profile tab, Teams list                                 |
| 11  | Phone and tablet not checked properly     | Look at every page at 820 and 390, light and dark                                            |
| 12  | Figures copied from screenshots           | Real data now; the Capacity 48-hour figure is the real forecast                              |
| 13  | 11 MB page                                | The bundle has no screenshots                                                                |
| 14  | Surname first                             | Apply everywhere (Transport done; My ward tiles, ED Lists, Notices, Out of area, TV, agenda) |
| 15  | One filled button per row or panel        | Apply on Alerts, bed record, agenda and any page with several equal buttons                  |
| 16  | No empty panels                           | Open on the first useful item, except where an owner rule says otherwise (below)             |
| 17  | Group repeats                             | Five identical alerts become one row with "Chase all"                                        |
| 18  | Legal times only as typed                 | Show "as typed" times; never work anything out from them                                     |
| 19  | Long lists show first rows then Show more | Apply to any list longer than about 8 rows                                                   |
| 20  | Discharges headline                       | My pick: the headline counts the rows listed, with "of N open" beside it. Check the counts   |
| 21  | Places, bed map and All wards overlap     | My pick: keep all three, one job each (below)                                                |
| 22  | "Not legally checked" notice              | My pick: keep it word for word (D-77 safeguard)                                              |
| 23  | Real components first?                    | Josh chose real components; this rebuild                                                     |

**Point 21, one job each:** Capacity's bed map shows where the free beds are now; All wards is the table to
compare wards; Places is the directory to find a place and open it, with no bed figures of its own.

**Where an owner rule beats point 16:** Home's Placement panel does not open on a patient (Josh's Home v7
rule, 22 October). Stays' bed record column stays on screen (ruling of 30 August); point 16 is met by
opening it on the first bed that needs a look instead of leaving it empty.

## How Josh wants pages reviewed (30 October)

Reviewing a page is restructuring, not restyling. For every part of the page ask what job it does,
whether that job is already done elsewhere (on this page or another), and whether it belongs here at all.
Then move, merge or remove so each piece of information lives in one right place. Question parts that
come from shared components too; "it sits in a shared file" is not a reason to keep it. Cut explanatory
sentences to short labels, and spend phone space on content. Example he gave: on the Home and Activity
mock-up (`claude/home-activity-mockup`), the ED access-target banner duplicated the new Planned tab, so it
became Planned's first row; the "since you looked" strip became one chip that opens Activity; notices got
their own Activity tab. Apply this to every popup and state, and when proposing changes give the reason
for each.

## Swarm plan for the popups and states

Josh asked for multiple agents in parallel. The pattern that worked for the last 15 pages:

1. **Coordinator first, alone:** add a way for the preview shell to open a shell overlay by `pop` name
   (`_preview/preview-shell.tsx`; the shell overlays are the real ones the app bar and rail open). Then
   register every popup in `MOCKUP_POPUPS` (`_preview/screens.ts`) and give each a placeholder in its own
   folder (`src/components/ward-redesign/pop-<name>/`), so no helper edits a shared file. Commit that.
2. **Five helpers in parallel** (one Agent call each, in the background), each limited to its own
   `pop-*` folders and working from the helper brief in `HANDOVER-TOOLS.md`:
   - A, shell overlays 1: Alerts drawer, Activity, Tools, Search, Help, Shortcuts.
   - B, shell overlays 2: Demo menu, phone Menu, Create, ward switcher, shift brief, Go to a desk, service
     picker, More pages, tour.
   - C, bed actions: Bed record, Confirm beds, Broadcast, Ward notices, Refer to a ward.
   - D, ED, transport and legal: ED actions, Log transport, officer job panel, Record a form, Record exam,
     Add the time.
   - E, states (point 9) as one "States" group: loading, empty, error, offline, toast, and a greyed control
     saying exactly "Not wired in this prototype." (D4).
     Each popup's review notes are in `_preview/review-notes.json` under `pop-<name>` where they exist.
3. **Coordinator, as each helper reports:** look at its work at 1440 and 390 px, keep files under the cap
   (move self-contained parts into sibling files; D-89 only when a split would break the match with the
   real file), add build notes with `add_notes.py`, commit, push.
4. **Watch-outs:** the shared dev server ran out of memory once with five helpers (restart with
   `npm run ensure`); a helper's half-saved file briefly breaks every mock-up page, so retry before
   diagnosing; the push guard lints the working tree, so a push can fail once while helpers are mid-edit.

## Role views (30 October, second session)

Josh asked for perfected screens for the other sign-in roles. A mock-up entry in `screens.ts` may name a
desk (`role`); the preview takes that desk first, as the Demo menu's See it as does, and mounts
`WardAccessScope` as the app's layout does, so the rail, app bar and data are the role's. Every other
mock-up returns to the statewide coordinator. 36 views, under the groups "As nurse in charge"
(Dabakarn), "As ED clinician" (Peel ED), "As community clinician" (Midland), "As transport officer",
"As site bed manager" (Royal Perth), "As executive" and "As access admin", each in
`src/components/ward-redesign/as-<role>-<page>/`.

**How they are built:** a copy of the coordinator's redesign (or of today's file) with every role
difference as a commented branch on the desk's role (`ROLE BRANCH (ward)` and the like), so it can be
merged into the one real component that serves every role. No override stylesheets. My ward, Patients
and On-call were converted the same way (they used to restyle the real screen from outside).

**Lessons:** the preview first drew role views on statewide data (fixed by mounting `WardAccessScope`);
`fork.py` rewrites code imports only, so a copied stylesheet's relative `composes` broke every page once;
loading all 74 pages in one bundle made every save rebuild everything (each page now loads on its own);
the first-visit tour, What's new and page hints are marked read in the preview; two dev servers do not fit
in this container's memory (each grows to 6 to 7 GB); the shareable copy had dropped every scoped
override selector (fixed in the bundle script).

## Josh's 30 October feedback

1. **Referrals, phone:** the highlight chips run off the edge ("0 Com…"). Make them wrap or fit.
2. **Referrals:** remove the Filter queue box on every device.
3. **New referral button:** the app bar's button sits hard against the right edge and is taller than its
   neighbours. Give it the bar's padding and the same height as the other bar controls.
4. **Overlaps:** check every page for content under the phone dock and its + button, and for panels
   overlapping on tablet.
5. **Broken styling:** a visual pass of every built page at every width, light and dark, fixing what looks
   wrong, before the remaining pages.

### Done on 30 October

- Referrals: Filter queue removed; phone chips wrap; the waiting chart takes the full band width below
  1360 px, so its 24h and 72h labels no longer print over each other.
- New referral button (preview shell override, `_preview/preview-shell.module.css`): even padding (it had
  14 px left, 5 px right) and a 16 px gap from the screen edge. Needs moving into `ward-bar.module.css`.
- Tablet pass on every built page: Capacity hero figures apart from its chips and Planned admissions'
  Book button; Home's checks chip and footer; Waiting's tablet list in three wait bands; Handover keeps one
  Sign off (the sticky bar) and its phone chips wrap; Stays and the ED access-risk card name people surname
  first; the ED board's On TV sits with the other hero actions.
- Still open from the pass: the horizontally scrolling ED strip on Home and the ED board cuts its last card
  at the screen edge by design (it scrolls). Consider a fade at the edge so it reads as scrollable.

## Remaining plan, in order

All 38 pages are built (table above); each page's build notes are in `_preview/build-notes.ts`. Josh asked
on 30 October for the pages first, then a pause for his review before the popups and states.

**How the last 15 pages were built (30 October):** five helper agents worked in parallel in the one
checkout, each limited to its own page folders, with every remaining slug registered first as a
placeholder so no helper touched the shared registry. The coordinator looked at each page, kept files
under the line cap by moving self-contained parts into sibling files, added build notes, and committed.
Lessons: the shared dev server ran out of memory once with five helpers compiling (restart with
`npm run ensure`), and a helper's half-saved file briefly breaks every mock-up page, because the viewer
imports them all; retry before diagnosing.

All done on 30 October (second session):

0. Done: Waiting and Home show legal times only as typed (no countdowns); Home's ED tiles count typed form
   times instead of due-soon bands; Pinned wards sits under the ward chart on Statistics compare.
1. Done: every popup, built by four helpers in parallel and checked at 1440 and 390 px. Bed record and Shift
   brief open over My ward, Broadcast over Alerts, Tour over Home (where each lives in the app).
2. Done: the States group (loading, empty, error, offline, toast, "Not wired in this prototype.").
3. Done: phone pass at 390 px, light and dark, on every page from Patients onwards. No sideways scroll, no
   content under the dock. Only finding: the kit's segmented tabs are 38 px tall on phones (Discharges,
   Statistics, Legal forms, Out of area, Downtime, Places, Settings, Sign in). Josh ruled on 30 October
   not to enlarge controls to 48 px; a larger invisible tap area is the agreed fix.
4. Done: text-size ratchet, mock-up check, organisation check, typecheck, full lint, knip (popup copies no
   longer export unused names), docs facts (route count 57), README rewritten for the React mock-ups,
   shareable bundle built and published to Josh's private preview
   (https://claude.ai/artifact/BL86wBgPv41hzMG2QWMwB3, which replaces the older GaVWBYM1Gkh8GdUtJvJapE).
5. Next: Josh's review, page by page.

## Round 2 polish (30 October, evening)

Josh asked for every page made "flawless, stylish, premium, polished, Apple inspired" without making the
style worse, and **not** to enlarge controls to 48 px. Eight helper groups worked from per-page audits
(the briefs were in the session scratch folder and are gone; the build notes record every change):
bed flow, coordinator pages, desks and reference, records, statistics, two role-view groups, and three
popup groups. Each page's `_preview/build-notes.ts` entry now has "Round 2" lines saying what changed
and why, and "Question for you" or "For the build" lines for what is left.

Common changes: 48 px enlargements put back to the kit's sizes (with invisible larger tap areas where
needed); every `[class*="_x__"]` override moved into a copied component; counts that name their noun;
one word per idea ("Current", "waiting in ED", "Past pull limit", "held up"); wrapping instead of "…";
empty panels and zero chips dropped when there is nothing to act on; safeguard wording kept word for
word; legal times still only as typed. The viewer has a Redesign / Today switch: the shareable copy shows
a picture of today's coordinator page beside each redesign (pictures in `output/redesign-preview/today/`,
not committed; role views have none).

### Who owns what (30 October, evening)

Josh approved a split with the Home and Activity chat (branch `claude/home-activity-mockup`):

- **That chat:** Home (one Home, from the Home and Activity design), Activity, the empty and loading
  states, `shell/`, Placement, the deep-review fixes to Waiting, Referrals, Capacity and Discharges
  (handed over at 719093ff7), and afterwards one size per control and a wording sweep across all pages,
  including the role copies.
- **This branch:** everything else, until it hands over. Recommended next: one chat owns all the mock-ups,
  to stop two writers clashing.

### Lessons from round 2

- **The shared dev server was the bottleneck,** not the number of helpers: with eight helpers a
  screenshot took up to 10 minutes, pages failed with ChunkLoadError, and the container restarted once.
  Next time, take review screenshots from the shareable copy (`node scripts/ward-flow/build-redesign-preview.mjs`
  then a static file server), which is plain files and costs almost nothing to serve.
- After a container restart, Node 24 is gone (reinstall to `/opt/node24`) but the checkout, uncommitted
  work and the scratch folder survive; stopped helpers can be resumed from their transcripts.
- A waiting loop that uses `pgrep -f "<text>"` matches its own command line and never ends.

### Questions for Josh from round 2

1. Alerts drawer legal-form rows show a running "10m Overdue" from the typed time (as the live app does).
   Recommend "Due 10:32 as typed · Not legally checked" with no running figure.
2. Waiting: keep "(as written)" or "as typed" next to any legal time. Recommend keeping it.
3. Printed shift brief: leave tentative diagnoses off paper. Recommend leaving them off (privacy).
4. Bed record: treat "Not recorded in Ward Flow. Check the ward's own observation chart." as safeguard
   wording, kept word for word. Recommend yes.
5. Bed manager Home: the rail's "Waiting 6" (every ED on the desk) sits beside the hero's "5 waiting in
   RPH ED". Recommend accepting, since the hero names its ED.

## Josh's answers (30 October, evening)

Josh agreed with **every recommendation**: all picks below stand, and the items marked "to do" are now
approved work. Still open only: one agreed meaning for the three Discharges totals, and "Chase all" for
grouped alerts (needs a new command, so it stays unbuilt).

## Open questions for Josh (all answered yes on 30 October; kept for the record)

- Point 20, Discharges: headline "59 to work now", with "of 207 open · 148 due in 2+ days" beside it.
- Point 21: keep Places, the Capacity bed map and All wards, one job each.
- Point 22: keep "Not legally checked" word for word.
- Alerts: a "Chase all" button for a group needs a new command; not built.
- Waiting and Home showed a countdown to recorded legal times; removed on 30 October (mock-ups only).
- Places: with no bed figures, the Most ready order is replaced by A to Z. My pick: keep A to Z.
- Statistics compare: Pinned wards moved under the ward chart on 30 October.
- Sign in: Open as <role> navigates to the role's home; four roles have no home of their own and open
  Home. Confirm the button should navigate at all.
- Settings: the review notes said not to mock the Profile tab's contents, but the plan asked for one; it is
  built from real app data only (role, desk, scope, service, shift, appearance). Keep or drop?
- Community team: wording for rows not accepted before the bed ("Referred during this stay", "Not
  arrived", "Not counted") is unseen on today's data.

## Things found while building (for the real app)

- **Shareable copy drops scoped styles (found 30 October).** `build-redesign-preview.mjs` minified CSS
  module class names, so every scoped override written as `[class*="_name__"]` (On-call, Governance,
  Patients, Referrals, Handover, Movements, All wards, Out of area, Settings) silently does nothing in the
  published copy. Fix: set `minifyWhitespace` and `minifySyntax` but `minifyIdentifiers: false`, and write
  selectors as `:is([class*="_name__"], [class$="_name"], [class*="_name "])` to match both the dev server
  and the bundle. Done on branch `claude/home-activity-mockup` for Home and Activity; apply here too and
  check pages in the built copy, not only the dev server.

- Surname first still needed in shared code the mock-ups cannot reach: the downtime pack rows
  (`use-take-downtime-pack.ts`), the community team record drawer, Add a patient's save toasts, and the
  chronology CSV's patient line.
- The docs facts check failed on this branch (route count 55 against 57); fixed on 30 October.
- Today's bed meeting TV does not fit a 1080p screen: the Brief is cut off at the foot (hidden overflow).
  The redesign shows every panel; only the footer line sits below.
- `?theme=dark` was not applying on any mock-up page (the rail re-applied the stored theme after mount);
  fixed in `_preview/preview-screen.tsx` on 30 October.

- Names written first name first on My ward's bed tiles and round list, its Notices, the ED board's Lists
  and access-risk card, Stays' Worth a look, Transport and Out of area (D-83 says surname first everywhere).
  The forks fix the last five; My ward's tiles need the real file.
- The referral slide-out names the patient first name first ("Tobias Wren") in its header and Before you
  send list: the shared drawer model (`ward-referral-drawer-model.ts`) uses `displayName`, not `formalName`.
  The New referral and Refer to a ward mock-ups reuse it, so they show it too until the real model changes.
- The New referral button in the app bar has 14 px padding on the left and 5 px on the right
  (`ward-bar.module.css` `.primary` and `.referralPrimary`); the preview overrides it.
- The dev server ran out of memory once after many pages compiled; `npm run ensure` restarts it.
- Discharges shows three totals (207, 63 and 59) that need one agreed meaning.
- Found in round 2 (fix in the build, after approval): the Planned admissions Book button stacks its icon
  over the word (`icon={CalendarPlus}`); Capacity's ward panel links are not checked against the desk's
  access; the statistics tab chips are cut off at the phone's right edge (shared `StatisticsNav`); the
  rail shows network figures on a site desk ("Capacity 26"), "Handover in 4h 18m" on the executive desk
  and "Statewide" on Midland's page; the side-panel Add the time form uses the browser's 12-hour time
  picker; date fields show mm/dd/yyyy in some browsers; the shared toast covers the foot of Home and
  touches the phone dock; referral alerts show a literal "Not recorded" as a legal chip; `wardLabel`
  writes "— open"; the Quick commands block in Search shows "+15m" twice.
- Bed 12 on the nurse in charge's My ward reads "Name not recorded": the client's workspace scoping keeps
  an out-of-scope `referralId`, and the resolver treats it as a broken link.

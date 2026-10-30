# Redesign mock-ups: handover and plan

_Updated 2026-10-30 - all 38 pages built; next are the popups, states, phone pass and final checks; Design owns._

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
5. Continue at "Remaining plan" step 1 (popups). Commit and push each piece as it is done.

Josh's standing go-ahead: push to this branch only, no pull request, no change to the real `/ward-flow`
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
  fine.** Before using that, record it as an owner decision (`docs/agents/native-startup/recording-decisions.md`:
  a `docs/decisions/` entry, with the reason in the change), then add the preview fork's path to
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

| Page                 | How                   | Main changes                                                                        |
| -------------------- | --------------------- | ----------------------------------------------------------------------------------- |
| Capacity             | New, real derivations | Full-width forecast with 7-day chart, By ward switch, bed map cards, side column    |
| Home                 | Fork                  | Beds that fit table, Checking chip, oldest alert to place (keeps Josh's v7 rule)    |
| Movements            | Fork                  | Stage pipeline, Tier 1 in the side column, full names                               |
| Waiting              | Fork                  | Daily check line, wait bands, site codes                                            |
| All EDs              | Fork                  | One-line title, cards only for EDs with someone waiting                             |
| Referrals            | Fork                  | Rows wrap, Offered to wards table, written history folded                           |
| New referral         | Fork of the slide-out | Calmer Catchment card                                                               |
| Handover             | Fork                  | One-line since summary, sticky sign-off bar, Due by Show more                       |
| My ward              | Real screen + styles  | Full names on tiles, 3 actions plus More, busiest Ward flow list                    |
| Stays and discharges | Fork                  | Ward home hero, one figures line, one notice, five cards a row                      |
| ED board             | Fork                  | One table, Lists folded, form number only, links in the footer                      |
| Transport            | Fork                  | Surname first, jobs line beside the title, "from → to" routes, missing forms marked |
| Patients             | Real screen + styles  | Cells wrap, chips wrap                                                              |
| Discharges           | Fork                  | "59 to work now of 207 open", person first, one action a row, blocker counts beside |
| All wards            | Fork                  | Status, Cohort and Order as menus, key and count on one line, card text wraps       |
| Statistics           | Fork (split helpers)  | View switch with Open a unit, occupancy first, chart's first 7 rows                 |
| Alerts               | Fork of 4 files       | Checks as one chip, Owner menu, same-kind groups, one Release plus Hand back        |
| Legal forms          | Fork split in two     | Times only as typed (point 18), 1A name shortened, Show more, header buttons        |
| Out of area          | Fork                  | Surname first, quieter hero and checks, region beds open on choice                  |
| On-call              | Real screen + styles  | Compact two-line service strip that scrolls on smaller screens                      |
| Seclusion            | Fork                  | Table of every secure ward's room, header counts, ward record beside it             |
| Governance           | Fork + styles         | Pane opens on the newest event, cells wrap, list full height                        |
| Bed meeting TV       | Fork                  | One-line tiles, surname first, three tables (laptop); 1080p shows every panel       |
| Meeting agenda       | Fork                  | Header counts, four lists two by two, surname first, small + Action                 |
| Downtime pack        | Fork                  | One table at a time on screen with tabs; print keeps all four                       |
| Chronology           | Fork                  | Header patient search, demo night's patients, what a chronology holds               |
| Places               | Fork                  | A directory with no bed figures (point 21), search first, opens on a place          |
| Community            | Fork                  | Live team count, full-width suburb lookup, page-scrolling A to Z                    |
| Community team       | Fork (3 files)        | One caseload table, surname first, row opens the record                             |
| Patient record       | Fork (2 files)        | Recorded-events timeline, surname first                                             |
| Statistics compare   | Fork (3 files)        | Open a unit from the tab row, first 8 rows, occupancy first                         |
| Statistics ward list | Fork                  | Chips on one row, first services and wards then Show more                           |
| Statistics one ward  | Fork (3 files)        | Compact shaded bed map, roster first 8 rows (the admissions table)                  |
| Statistics weekly    | Fork (2 files)        | Pilot measures in one table, Counted outside Ward Flow panel                        |
| Add a patient        | Fork                  | Duplicate check inside Identity, live Needed list, surname first                    |
| Ward answer          | Fork (D-89 cap)       | One-line All answered, census squares coloured by state with a key                  |
| Settings             | Fork (3 files)        | Sticky save bar, compact steppers, Display and profile tab (real data)              |
| Sign in              | Fork                  | Open as <role> button, no boxed role numbers                                        |

Popups working so far: bed meeting sheet, try a scenario, Capacity ward panel, phone bed forecast, and the
real movement drawer.

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

1. **Popups (point 8):** Alerts drawer, Activity, Tools, Search, Help, Shortcuts, Demo menu, phone Menu,
   Create, Bed record, Confirm beds, ED actions, Log transport, Broadcast, Record a form, Ward notices,
   officer job panel, ward switcher, shift brief, Record exam, Refer to a ward, Go to a desk, Add the time,
   service picker, More pages, tour. Register each in `MOCKUP_POPUPS` (`_preview/screens.ts`) with the
   page it opens over and its `pop` name, and have the page open it from `openOnLoad`.
2. **States (point 9)** as one "States" group: loading, empty, error, offline, toast, and a greyed control
   saying exactly "Not wired in this prototype." (D4).
3. **Phone pass** on every page built since the tablet pass (Patients onwards), at 390 px. The helpers
   checked their own pages at 390 px; this is a second look across them all, light and dark.
4. **Final pass:** `npm run check:ward-text-size`, lint, typecheck, `npm run check:mockups`,
   `npm run docs:update` (scripts index is stale), `npm run ward:organise:check`, knip (forks export
   things nothing imports; un-export them); update `README.md` here to describe the React mock-ups; build
   the shareable bundle (`node scripts/ward-flow/build-redesign-preview.mjs`); publish it to the existing
   artifact (https://claude.ai/artifact/GaVWBYM1Gkh8GdUtJvJapE, read it first); push.
5. **Report to Josh:** each recommendation and what he approves, page by page, plus the open questions
   below.

## Open questions for Josh (my picks applied, to confirm on review)

- Point 20, Discharges: headline "59 to work now", with "of 207 open · 148 due in 2+ days" beside it.
- Point 21: keep Places, the Capacity bed map and All wards, one job each.
- Point 22: keep "Not legally checked" word for word.
- Alerts: a "Chase all" button for a group needs a new command; not built.
- Waiting and Home still show a countdown to recorded legal times; point 18 removed them on Legal forms.
  Josh chose on 30 October to remove them there too (mock-ups only); not yet done in the Waiting and Home
  forks, so do it in the next session.
- Places: with no bed figures, the Most ready order is replaced by A to Z. My pick: keep A to Z.
- Statistics compare: with both charts cut to eight rows the ward card ends early at 1440 px. Move Pinned
  wards under the ward chart? My pick: yes, in the next pass.
- Sign in: Open as <role> navigates to the role's home; four roles have no home of their own and open
  Home. Confirm the button should navigate at all.
- Settings: the review notes said not to mock the Profile tab's contents, but the plan asked for one; it is
  built from real app data only (role, desk, scope, service, shift, appearance). Keep or drop?
- Community team: wording for rows not accepted before the bed ("Referred during this stay", "Not
  arrived", "Not counted") is unseen on today's data.

## Things found while building (for the real app)

- Surname first still needed in shared code the mock-ups cannot reach: the downtime pack rows
  (`use-take-downtime-pack.ts`), the community team record drawer, Add a patient's save toasts, and the
  chronology CSV's patient line.
- The docs facts check fails on this branch: the route count is 57 with the two mock-up routes, while
  `docs/ward-flow/STATUS.md` and the code-map pages say 55. `npm run docs:facts:write` in the final pass
  fixes it (those files need a claim update first).
- Today's bed meeting TV does not fit a 1080p screen: the Brief is cut off at the foot (hidden overflow).
  The redesign shows every panel; only the footer line sits below.
- `?theme=dark` was not applying on any mock-up page (the rail re-applied the stored theme after mount);
  fixed in `_preview/preview-screen.tsx` on 30 October.

- Names written first name first on My ward's bed tiles and round list, its Notices, the ED board's Lists
  and access-risk card, Stays' Worth a look, Transport and Out of area (D-83 says surname first everywhere).
  The forks fix the last five; My ward's tiles need the real file.
- The New referral button in the app bar has 14 px padding on the left and 5 px on the right
  (`ward-bar.module.css` `.primary` and `.referralPrimary`); the preview overrides it.
- The dev server ran out of memory once after many pages compiled; `npm run ensure` restarts it.
- Discharges shows three totals (207, 63 and 59) that need one agreed meaning.

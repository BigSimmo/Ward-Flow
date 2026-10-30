# Redesign mock-ups: handover and plan

_Updated 2026-10-30 - handover for the React redesign mock-ups, with the remaining plan; Design owns._

**Status: mock-ups for Josh's review. No real screen has changed (D-74).** Everything below lives on
branch `claude/core-pages-design-review-f5vf4g` of `BigSimmo/Ward-Flow`. No pull request is open.

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
- **Files over 1,500 lines cannot be copied whole** (the repository's line cap; adding new files to
  `eslint-rules/max-lines-baseline.mjs` is not allowed). For those (My ward), the mock-up draws the real
  screen with a scoped redesign stylesheet, and the build notes list the changes to make in the real file.
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
| Transport            | Fork (not committed)  | Surname first, jobs line beside the title, "from → to" routes, missing forms marked |

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

## Remaining plan, in order

1. Commit Transport (fix the "3 missing" label wrapping first).
2. Josh's 30 October feedback (above) on the pages already built, then point 11's check on those pages.
3. Stays: open the record column on the first bed that needs a look.
4. Work and reports: Patients, Discharges (point 20), All wards (point 21), Statistics.
5. Reference: Alerts (points 15 and 17), Legal forms (keep "Not legally checked", D-77; point 18), Out of
   area, On-call, Seclusion (full width, every secure ward), Governance (opens on the first item).
6. Bed meeting: TV (bare page), Agenda (full width, one Add action), Downtime pack, Chronology (opens on the
   first patient).
7. Places and records: Places (point 21), Community, Community team (one caseload table), Patient record,
   Add a patient, Ward answer, Settings (Profile tab), Sign in (bare page).
8. Statistics: Compare, Ward list, One ward (admissions table), Weekly.
9. Popups: Alerts drawer, Activity, Tools, Search, Help, Shortcuts, Demo menu, phone Menu, Create, Bed
   record, Confirm beds, ED actions, Log transport, Broadcast, Record a form, Ward notices, officer job
   panel, ward switcher, shift brief, Record exam, Refer to a ward, Go to a desk, Add the time, service
   picker, More pages, tour.
10. States (point 9), as one "States" group in the viewer.
11. Final pass: text-size check (`npm run check:ward-text-size`), lint, typecheck, `npm run check:mockups`,
    `npm run docs:update`, `npm run ward:organise:check`; update `README.md` here to describe the React
    mock-ups; build the shareable bundle; publish it to the existing artifact
    (https://claude.ai/artifact/GaVWBYM1Gkh8GdUtJvJapE, read it first); push.
12. Report to Josh: each recommendation and what he needs to approve, page by page.

## Things found while building (for the real app)

- Names written first name first on My ward's bed tiles, its Notices, the ED board's Lists and Transport
  (D-83 says surname first everywhere).
- Discharges shows three totals (207, 63 and 59) that need one agreed meaning.

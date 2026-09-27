# Task 7 Bed board implementation — revision 1

Date: 2026-09-13  
Worker: `statistics_inventory` / `gpt-5.6-sol` / medium  
Brief: `task-7-brief-r2.md`  
Plan SHA-256: `DEB1A10C336EB44856430D8C15D91B09EE5787B5762B3D55A0159DB0C772BAEB`  
App HEAD at dispatch: `1ef9ed3975078b789e9b5d70b3f000c64edc3809`

## Outcome

The Bed board now opts into the third-edition root marker and canonical shell token layer while retaining its existing ward token composition for the daily-sheet contract. Its screen presentation follows the served drawing's hierarchy: compact ward strip, current-fact band, condensed shift work, filterable and orderable bed board, three-tab flow panel, persistent selected-bed record, and folded print sheet.

The controller added `wardBoardHref(unitId)` under the revision-2 interface addendum. The board consumes that helper for a live-state Change ward disclosure and uses `unitHref` for Ward home; no route is typed locally.

## Changed paths and fingerprints

- `src/components/ward-management/board/ward-board.tsx` — input `4F9BAF3D33A68C9BFB07304CAE1F90D2B49C74B581A6AEDC64DF9EF7594D8B80`; output `4336198B5DE9B765B15F8169C914295F4E03A4806491D413D8225676814057B0`
- `src/components/ward-management/board/board.module.css` — input `DC946483191206BCBA3C97471E963D1CFC970E902BD1DC003A40B5FE2EB73CD7`; output `F68FE5F7429B8D364B926A9BEE909729DC0B25AA75103DEBC7916332240BBD2C`

No daily-sheet, shared shell, engine, derivation, fixture, provider, route, test, or other application file was edited by this worker.

## Presentation implemented

- The duplicated component-level screen title and prototype warning remain in the document and print, while the mounted shell owns their visible screen treatment. The ward strip keeps ward name, health service, site, designation, preparation warning, constraint, and the same-state timestamp visible.
- Ward home and Bed board form one local screen group. Change ward lists every current live unit, marks the current unit, and uses the controller-owned encoded board route helper.
- The band retains all six canonical `capacityBreakdown` facts and adds four already-rendered board counts: people away at an ED, pulled but not arrived, out-of-service beds, and stays over three months. `On leave` remains as the app-only tenth fact rather than being dropped to copy the drawing's nine-cell sample.
- Needs you this shift keeps the current derived digest, explicit quiet state, all non-zero items, warnings, and no invented bed identities.
- The bed board adds four truthful filters and three presentation orders. Every tile stays mounted when filtered; the `hidden` state is removed in print so printing cannot silently omit beds. A zero-result filter states that the view narrowed the board rather than implying the ward has no beds.
- Tiles retain all five states and their exact selection keys. Occupied tiles now surface the existing sex, home-region and stay-band facts; state, day count, past-date, ED-away and selected markers remain words rather than color-only signals.
- Going out, Coming in and Since yesterday are three keyboard-operated tabs. Arrow Left/Right, Home and End move and focus the active tab. All three panels stay mounted, their local state/actions remain intact, and the existing daily sheet remains the print representation of the full flow picture.
- The selected-bed record remains non-modal, permanently mounted, keyboard closable through the existing Escape handler, and sticky only where the content width supports the dock. It falls into document flow before the tabbed flow panel on narrower widths.
- The certified stylesheet contains no `--text-*` references and no literal HTML font size. Its smallest type is canonical `--t-0` (12px). Phone targets use the existing 48px tap token; forced-colors restores explicit boundaries and selection outlines.

## Retained behavior and clinical content

All five tile populations remain derived by the existing `buildTiles` path: occupied, waiting, blocked, held and empty. The original reducer action set is unchanged: `RECORD_LEAVING`, `RECORD_AWAY_AT_EMERGENCY_DEPARTMENT`, and `RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT`. Leave destination choice, selection identity, close/focus return, outgoing confirmed/expected basis, live capacity, pending-preparation refusal wording, designation constraints, triage warnings, incoming states, discharge blockers, destinations and missing-team statement, since-yesterday counts, diagnosis qualification, occupancy reconciliation, legend, provenance footnote, print-only full people list, and `WardDailySheet` all remain.

No bed number, location, locked/open tile assignment, person, clinical fact, action, statistic, route, or synthetic record was invented.

## Design deviations and reasons

- The drawing's “Preview: a quiet shift” tab is not implemented. It is a second fabricated scenario, while the brief forbids fake beds or statistics. The live shift panel already has a truthful empty state when its derived list is empty.
- The drawing groups tiles into named locked and open bays and offers “Locked beds first”. The engine records only ward-level locked/open counts and explicitly does not identify which tile is which. The board keeps the designation fact in the ward strip and offers Recorded order instead of assigning unsupported bed locations.
- The band has ten cells instead of the drawing's nine because the app's existing `On leave` fact is mandatory retained content. The additional four drawing-aligned cells repeat values already present elsewhere on the page; they introduce no second engine state.
- The Change ward disclosure lists all live units rather than the drawing's service-filtered sample count. Shell service selection remains explicitly unwired to page data; reducing the list would falsely imply filtering.
- The drawing's selected record uses a fully populated named example and exact times. The app retains whichever current synthetic record the user selects, including honest missing values and every current action, so its height and fields vary by state.
- The component's detailed governance, diagnosis, no-bed-identity, availability and provenance statements remain. They are more extensive than the drawing because removing them would erase app-only safety and model-limit content.

## Drawing evidence inspected

Both controller-provided HTTP-served captures were viewed at original resolution before visual edits:

- `board-drawing-1440-light.png` — SHA-256 `A5233C36284CA31EDB4C310FEC575EEE2ECC4F4520E8C84EE5C312B93ECB1F2A`
- `board-drawing-390-light.png` — SHA-256 `C5CAC9D6C9621A24CDAF31E740138E65B6B2903A13C052E550DB77FC02B89863`

The desktop capture established the full-width ward strip, main-column panel order, docked record, tile density and ruled surfaces. The phone capture established the real in-flow shared shell and full-width content start; it showed only the initial viewport, so it does not prove lower board regions.

## Source verification and pending evidence

Worker static checks only:

- `git diff --check -- <owned TSX> <owned CSS>` — no output.
- CSS token scan — `NO_LEGACY_TEXT_TOKENS`.
- CSS-module reachability scan — all 142 distinct `styles.*` uses have a declaration.
- Source-set comparison against `HEAD` — reducer action set unchanged; all five tile kinds unchanged; every pre-existing literal `data-testid` retained.
- Source inspection — three mounted tabpanels, filtered beds restored under print, canonical marker/composition present.
- Prettier wrote both owned files successfully.

No tests, application server, browser, computed-style inspection, screenshot capture, forced-colors emulation or print preview was run by this worker, per the controller-only execution boundary. Runtime visual acceptance, interaction verification, print evidence, independent review and human acceptance remain pending.

The focused heading test is presentation-stale against the authoritative drawing: it requires “Needs a look this shift” and requires all three flow headings to be simultaneously visible. The implementation uses “Needs you this shift” and one visible tabpanel while keeping all three mounted. The controller was asked to update that contract in its test lane.

# Fix plan — screens, copy and design parity (read-only Opus planner, 16 Sept 2026, base 65aa7c54a6)

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/plans/2026-09-17-build-plan-screens.md`.** Kept for history; do not follow. It was the source for that plan.

Start every task from the fix line tip at the time it starts. Controller alone edits the task ledger §7.3,
MANIFEST.json, CONTACT-SHEET.html, screen-verification.json and SCREEN-VERIFICATION.md.

## Key findings

- **All fourteen "do not build against" drawings are still the 15 Sept rewrites**, not the approved
  versions: each file's pre-883ecfdfb4 blob equals `1ef9ed3975`; 12 of 14 equal
  `reference/gemini-2026-09-15/`; settings was further rebuilt by Gemini (ae908cdd1b, 6ad62eb63c,
  f0e5ea88f9); movement was rewritten earlier by 7567c47720. SCREEN-VERIFICATION recorded "matches" on
  16 Sept for add-a-patient, patient-search and patient-now **against rewritten drawings** (invalid).
- WF-50: design standard §14 row 6 (WARD-FLOW-DESIGN-SYSTEM.md:1157,1205) says the Community teams
  screen is the coordinator's view, so "Bed coordinator" is correct; the real contradiction was the
  page dispatching as `community` (now Not wired by gemfix 938a05da4a).
- WF-27 Delays verified defect: pressing an owner card or cause leaves a chip showing pressed while it
  marks nothing (delays-screen.tsx:148-153, 358-359, 404, 470-471). Capacity sort box, demo reset untested.
- WF-28: "owner ruling D9" in the redirect-stub guard is Phase 6 **spec** D9; a 12 Sept closing ruling
  is cited only in a test comment (tests/ward-capacity-absorbed-morning-coverage.dom.test.tsx:18-21).
- Top bar: Record a decision / Contact a team / Export the figures only announce to screen readers;
  drawings show menus with a visible "Not wired in this prototype." Service chooser changes its label
  but filters nothing.
- Shortlist legal line uses raw minutes; keep the words "passed its deadline" (guard :2170).
- ED CMHT confirm and examination submit use native `disabled` against the file's own aria-disabled rule.

## Tasks

- **Lane A (ward-bar.tsx, serial):** T1 visible "Not wired" panel for the three primary actions (Q2);
  T2 service chooser options aria-disabled + D4 note, trigger stays "All services" (Q3).
- **Lane B:** T3 pin community routes' coordinator label as deliberate + no dispatching control (Q1).
- **Lane C:** T4 Delays one mark at a time (six failing tests incl. chip/owner/cause precedence, empty
  cause); T5 Capacity control-combination tests only (sort comparator pairwise, chip×sort×fold×selection,
  All reset, Highlight, demo reset clears selection, keyboard).
- **Lane D:** T6 re-point ui-ward-morning.spec.ts at Capacity, remove the PARKED exemption, reword "owner
  ruling D9" → "spec D9" (Q4).
- **Lane E:** T7 shortlist legal line via splitDuration.
- **Lane F:** T8 CMHT confirm + examination submit aria-disabled with described reasons (unless owner
  removes CMHT).
- **Lane G (drawings):** G1 restore the 13 approved drawings + movement from `1ef9ed3975` in one recorded
  commit (after H1/H2) · G2 calibrate checker on Command (EDGE_BAR_ALLOWED), per-file/per-rule count,
  flag R2 hits that are script values · G3 (Opus) checker rule R14 for D5 · G4 NEW-LOOK-SPEC.md · G5
  Discharges pilot (D1: owner compares before any other screen) · G6 Command shell + WF-44 "subset of the
  network" sentence computed from UNITS and restate the standard (Q5) · G7 shell to every drawing (solo) ·
  G8 waves of three screens per worktree, one Opus adversarial review per batch: A plan Tasks 6-9, B
  11-19 (settings waits H1), C 20-21 (waits H2), D the uncovered bodies (command/capacity/delays;
  ward/bed-board/emergency-department; community-team/search-hub/raise-a-referral;
  referrals/network/handover; seven statistics in two batches) · G9 D7 duplicate deletion only with
  explicit yes via Verifier · G10 records and owner's look at 390/820/1440 light and dark.

## Owner questions

Q1 Community team screen is the coordinator's view (keep label) [yes] · Q2 three top-bar buttons show a
"Not wired" panel [yes] · Q3 service chooser unselectable + Not wired now, real filtering queued? [yes]
· Q4 confirm 12 Sept ruling that Morning tests move to Capacity, no 08:00 view, no print sheet [confirm] ·
Q5 Command drawing: add computed "subset" sentence rather than extend to 23 wards [yes] · Q6 the five
extra drawings (settings-perfected, two sovereign, patient-search-console, patient-search-working) are
reference only [yes].

## Hand-backs to Ward Lead

H1 restoring approved Settings discards Gemini's "sovereign chrome" work — decide first. H2 the app now
has a real 48h horizon chart, so D4's premise for plan Tasks 20-21 has changed.

## Risks

Moving line; shared files (ward-bar.tsx, ed-screen.tsx, shortlist-panel.tsx, command drawing, shell
test, records); invalid "matches" verdicts; checker false positives before G2 count; T8 wasted if CMHT
removed; unconfirmed relayed Morning ruling.

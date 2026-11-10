// Line caps for the source files that were already over MAX_LINES_DEFAULT when this ratchet
// started (15 October 2026). Each cap is the file's largest size on main or an open PR branch at
// that date, plus about 150 lines of headroom. The ratchet stops these files growing much further
// and stops new oversized files appearing.
//
// When a file shrinks, lower its cap or delete its entry. Raise a cap only with a reason in the PR.
// Never make room by changing on-screen words: move code out or split the file instead (Josh,
// 26 October 2026; docs/ward-flow/HOW-WE-WORK.md section 6).
// tests/max-lines-baseline.test.ts fails once a cap is more than MAX_LINES_HEADROOM above its file,
// or once a file is back under MAX_LINES_DEFAULT, so the caps follow the files down.
// 18 October 2026 (review item 24): 20 files split under the default cap came off this list, and the
// caps for ward-screen, ward-model and ward-flow-events follow their partial splits down.
// 22 October 2026: the reducer's protected record path moved to ward-flow-protected-record-events.ts,
// so its cap follows it down. ward-flow-events keeps its cap: ReferralDraft moved out to give the
// event union room to grow.
// 26 October 2026 (F-17): the seeded referrals moved to ward-movements-referrals.ts, so the
// ward-movements cap follows it down.
// 30 October 2026 (D-89): the Ward answer redesign mock-up copies the real view (already listed), so
// it gets its own cap rather than a split that would break the line-by-line match with the real file.
// The My ward mock-up's copies of ward-screen and ward-home-tab (both listed) follow on the same basis.
// 30 October 2026 (D-89): likewise the Home and Activity mock-up's copy of the shortlist panel.
// 30 October 2026 (D-89): and the nurse in charge's and ED clinician's Waiting copies, which follow the coordinator's line by line.
// 9 Nov 2026 (PR #1583): main reached 2547 of the reducer's 2550 with PR #1563; the discharge and
// capacity features add six dispatch lines (their logic already lives in slices), so the cap is 2555.
// 10 Nov 2026 (PR #1583): PR #1578 took main to 2550, so with the same six lines the cap is 2560.
// 10 Nov 2026 (batch 3 items 21 and 23): two state fields, a guard import and one dispatch line take
// the reducer to 2565, and one union line takes ward-flow-events to 2751; the logic is a lazy slice.
// 10 Nov 2026 (PR #1598): main reached 2574 of ward-screen's 2575; the D-129 sign-off Undo adds three
// lines (its logic lives in ward-sign-off-undo.ts), so the cap is 2580.
export const MAX_LINES_DEFAULT = 1500;
export const MAX_LINES_HEADROOM = 300;

export const MAX_LINES_BASELINE = {
  "src/components/ward-management/ward-flow-reducer.ts": 2565,
  "src/components/ward-management/ward/ward-screen.tsx": 2580,
  "src/components/ward-management/ward-model.ts": 1900,
  "src/components/ward-management/ward-movements.ts": 2070,
  "src/components/ward-management/ward-flow-events.ts": 2751,
  "src/components/ward-management/coordinator/shortlist-panel.tsx": 2850,
  "src/components/ward-management/movements/movement-workspace-cockpit.tsx": 2150,
  "src/components/ward-management/ward/ward-home-tab.tsx": 2150,
  "src/components/ward-management/ward-patients-seed.ts": 1800,
  "src/components/ward-management/ward/ward-answer-view.tsx": 1750,
};

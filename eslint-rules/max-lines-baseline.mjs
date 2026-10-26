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
export const MAX_LINES_DEFAULT = 1500;
export const MAX_LINES_HEADROOM = 300;

export const MAX_LINES_BASELINE = {
  "src/components/ward-management/ward-flow-reducer.ts": 2550,
  "src/components/ward-management/ward/ward-screen.tsx": 2575,
  "src/components/ward-management/ward-model.ts": 1900,
  "src/components/ward-management/ward-movements.ts": 2070,
  "src/components/ward-management/ward-flow-events.ts": 2750,
  "src/components/ward-management/coordinator/shortlist-panel.tsx": 2850,
  "src/components/ward-management/movements/movement-workspace-cockpit.tsx": 2150,
  "src/components/ward-management/ward/ward-home-tab.tsx": 2150,
  "src/components/ward-management/ward-patients-seed.ts": 1800,
  "src/components/ward-management/ward/ward-answer-view.tsx": 1750,
};

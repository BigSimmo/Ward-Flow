// Line caps for the source files that were already over MAX_LINES_DEFAULT when this ratchet
// started (15 October 2026). Each cap is the file's largest size on main or an open PR branch at
// that date, plus about 150 lines of headroom. The ratchet stops these files growing much further
// and stops new oversized files appearing.
//
// When a file shrinks, lower its cap or delete its entry. Raise a cap only with a reason in the PR.
// tests/max-lines-baseline.test.ts fails once a cap is more than MAX_LINES_HEADROOM above its file,
// or once a file is back under MAX_LINES_DEFAULT, so the caps follow the files down.
export const MAX_LINES_DEFAULT = 1500;
export const MAX_LINES_HEADROOM = 300;

export const MAX_LINES_BASELINE = {
  "src/components/ward-management/ward-flow-reducer.ts": 2900,
  "src/components/ward-management/board/ward-board.tsx": 3700,
  "src/components/ward-management/ward/ward-screen.tsx": 3900,
  "src/components/ward-management/ward-model.ts": 3500,
  "src/components/ward-management/ward-movements.ts": 3400,
  "src/components/ward-management/ward-flow-events.ts": 3200,
  "src/components/ward-management/coordinator/shortlist-panel.tsx": 2850,
  "src/components/ward-management/governance-registers.tsx": 2700,
  "src/components/ward-management/movements/movements-screen.tsx": 2700,
  "src/components/ward-management/patients/patient-now-screen.tsx": 2700,
  "src/components/ward-management/ward-derivations.ts": 2600,
  "src/components/ward-management/shell/ward-bar.tsx": 2450,
  "src/components/ward-management/statistics/statistics-claims-register.ts": 2550,
  "src/components/ward-management/officer/officer-screen.tsx": 2500,
  "src/components/ward-management/capacity/capacity-screen.tsx": 2400,
  "src/components/ward-management/delays/delays-board.tsx": 2350,
  "src/components/ward-management/ward-flow-record-events.ts": 2300,
  "src/components/ward-management/alerts/alerts-screen.tsx": 2250,
  "src/components/ward-management/referrals/referral-board.tsx": 2200,
  "src/components/ward-management/movements/movement-workspace-cockpit.tsx": 2150,
  "src/components/ward-management/ward/ward-home-tab.tsx": 2150,
  "src/components/ward-management/search/patient-search.tsx": 1950,
  "src/components/ward-management/settings/settings-screen.tsx": 1850,
  "src/components/ward-management/handover/handover-page.tsx": 1800,
  "src/components/ward-management/ward-management-network.tsx": 1800,
  "src/components/ward-management/ward-patients-seed.ts": 1800,
  "src/components/ward-management/ward-referrals.ts": 1750,
  "src/components/ward-management/ward/ward-answer-view.tsx": 1750,
  "src/components/ward-management/hub/hub-screen.tsx": 1700,
  "src/components/ward-management/ward-global-search.tsx": 1700,
};

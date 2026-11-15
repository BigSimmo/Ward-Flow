/** Show me targets shared by the feature-crawl how-tos (`ward-help-howto-more*.ts`). */
import type { TourTarget } from "./ward-tour-steps";

export const CLINICAL_DESKS = ["coordinator", "ward", "ed", "community", "bed_manager", "officer"] as const;

export const button = (text: string): TourTarget => ({ sel: "button", text });
/** A control inside an open dialog, sheet or confirm box. */
export const inDialog = (text: string, tag = "button"): TourTarget => ({
  sel: `[role='dialog'] ${tag}, [role='alertdialog'] ${tag}`,
  text,
});
/** The Alerts bell; a phone has Alerts in its dock instead. */
export const ALERTS_DRAWER: TourTarget[] = [
  { sel: '[data-testid="ward-bar-tasks-trigger"]' },
  { sel: '[data-testid="ward-phone-menu-alerts"]' },
];
/** A ward on Capacity: the map on a computer, the wards to check on a phone. */
export const CAPACITY_WARD: TourTarget[] = [
  { sel: '[data-testid^="capacity-map-ward-"]' },
  { sel: '[data-testid^="capacity-check-ward-"]' },
];
export const CAPACITY_DRAWER: TourTarget = { sel: '[data-testid="ward-capacity-ward-drawer"]' };
export const MOVEMENT_ROW: TourTarget[] = [
  { sel: '#main-content a[href^="/ward-flow/movements/"]' },
  { sel: '[data-testid^="movements-group-toggle-"]' },
];
/** The name on a Movements row, which opens the movement's drawer beside the list. */
export const MOVEMENT_DRAWER_OPEN: TourTarget[] = [
  { sel: '#main-content button[aria-label^="What is recorded for"]' },
  { sel: '[data-testid^="movements-group-toggle-"]' },
];
export const WORKFLOW_CONTROLS: TourTarget = { sel: "summary, button", text: "Additional workflow controls" };
export const WORKFLOW_ACTIONS: TourTarget = { sel: '[aria-label="Movement workflow actions"]' };
export const ALERT_ROW: TourTarget = { sel: '[data-testid="ward-alerts-open"]' };
export const BROADCASTS_TAB: TourTarget = { sel: '[data-testid="ward-alerts-tabs"] button', text: "Broadcasts" };
export const LIVE_BROADCAST: TourTarget = { sel: '[data-testid="ward-alerts-live"]' };
/** The ED board's row: its More actions menu on a computer, the row (which opens the person) on a phone. */
export const ED_ACTIONS: TourTarget[] = [
  { sel: '[data-testid^="ward-ed-unfold-"]' },
  { sel: '[data-testid^="ward-ed-patient-"]' },
];
/** The person's name on the ED board, which opens their sheet with its cards. */
export const ED_PERSON: TourTarget[] = [
  { sel: '[data-testid^="ward-ed-row-name-"]' },
  { sel: '[data-testid^="ward-ed-patient-"]' },
];
export const ED_SHEET: TourTarget = { sel: '[data-testid^="ward-ed-phone-sheet-"]' };
/** A bed on the ward's bed board, or its card in the beds list. */
export const WARD_BED: TourTarget[] = [
  { sel: '[data-testid^="ward-board-bed-"]' },
  { sel: '[data-testid^="ward-bed-card-"]' },
  // The ward's own home: Every bed's tiles or list, and the phone's walk round.
  { sel: 'ul[aria-label^="Beds at "] button[aria-haspopup="dialog"]' },
  { sel: 'table[aria-label^="Beds at "] button[aria-haspopup="dialog"]' },
  { sel: '[data-testid="ward-walk-round"] button[aria-haspopup="dialog"]' },
  { sel: '[data-testid="ward-walk-round"]' },
];
export const BED_PANEL: TourTarget[] = [
  { sel: '[data-testid="bed-telemetry-drawer"]' },
  { sel: '[data-testid="ward-board-detail"]' },
];
export const REFERRAL_ROW: TourTarget[] = [
  { sel: '[data-testid^="ward-referral-board-select-"]' },
  { sel: '[data-testid^="ward-referral-board-card-select-"]' },
];
export const LEGAL_ROW: TourTarget[] = [
  { sel: '[data-testid="ward-legal-forms-groups"] [data-ward-primitive="record-row"] button' },
  { sel: '[data-testid^="ward-legal-phone-row-"]' },
];
export const DISCHARGE_ROW: TourTarget[] = [
  { sel: 'tbody[data-testid^="ward-discharge-group-"] tr[data-release-id] button[aria-pressed]' },
  { sel: '[data-testid^="ward-discharge-cards-"] button' },
  { sel: 'tbody[data-testid^="ward-discharge-group-"] tr[data-release-id]' },
];
export const PATIENT_CHANGE_CARD: TourTarget = { sel: '[data-testid="ward-patient-change-card"]' };

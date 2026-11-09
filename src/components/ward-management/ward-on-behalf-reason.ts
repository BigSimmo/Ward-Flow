/**
 * **WHY A COORDINATOR OPENS A WARD'S CLINICAL RECORD (D-80 item 17).** Before real data, a bed
 * coordinator opening a ward's clinical record (a stay's discharge and care record) gives an "on
 * behalf of the ward" reason. The reason is one choice from this closed list, never typed text, so
 * it can be saved in the record access log (the audit entry `OPEN_DISCHARGE_RECORD` writes) and on
 * the shared server like every other closed-list field.
 *
 * Kept in its own small file so the reducer, the stored-state check, the server's command schema and
 * the screens read one list without loading each other. The wording is a first draft for Josh.
 */
export const ON_BEHALF_REASONS = [
  { id: "ward-asked", label: "The ward asked for help" },
  { id: "ward-unreachable", label: "The ward could not be reached" },
  { id: "bed-flow", label: "Bed flow or discharge planning" },
  { id: "safety", label: "A safety concern" },
] as const;

export type OnBehalfReasonId = (typeof ON_BEHALF_REASONS)[number]["id"];

export const ON_BEHALF_REASON_IDS = ON_BEHALF_REASONS.map((option) => option.id) as [
  OnBehalfReasonId,
  ...OnBehalfReasonId[],
];

/** True for a reason on the closed list. */
export function isOnBehalfReason(value: unknown): value is OnBehalfReasonId {
  return typeof value === "string" && ON_BEHALF_REASONS.some((option) => option.id === value);
}

/** The on-screen words for a reason. */
export function onBehalfReasonLabel(reason: OnBehalfReasonId): string {
  return ON_BEHALF_REASONS.find((option) => option.id === reason)?.label ?? reason;
}

/** Said when a coordinator's opening comes without a reason from the list. */
export const ON_BEHALF_REASON_REFUSAL =
  "Choose why you are opening this ward's record on the ward's behalf. Nothing was opened.";

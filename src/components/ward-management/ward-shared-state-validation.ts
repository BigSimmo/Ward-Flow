import { isDischargeCriteriaRecord, isPatientSpecificItem } from "./ward-discharge-criteria";
import { isValidStoredWardFlowState } from "./ward-flow-storage-validation";
import { REPATRIATION_MODES, WARD_FLOW_ROLE_LABELS } from "./ward-flow-events";
import { TRANSPORT_LEGAL_STATUSES, TRANSPORT_PROVIDERS } from "./ward-model";
import type { WardFlowState } from "./ward-flow-reducer";
import { upgradeLegacyObservationRows } from "./ward-observation-legacy";
import {
  SUPPORT_NOTIFICATION_OCCASIONS,
  SUPPORT_NOTIFICATION_OUTCOMES,
  SUPPORT_NOTIFICATION_PARTIES,
  SUPPORT_NOTIFICATION_REASON_MAX_CHARACTERS,
  SUPPORT_NOTIFICATION_WHO_MAX_CHARACTERS,
} from "./ward-support-notifications";

/** Shared synthetic storage has an explicit repatriation and support-notification schema. The browser's D-18
 * persistence fence remains unchanged, including its prohibition on storing refusals. */
export function isValidSharedWardFlowState(value: unknown): value is WardFlowState {
  if (!value || typeof value !== "object") return false;
  const state = value as WardFlowState;
  if (!Array.isArray(state.repatriations) || !Array.isArray(state.admissions) || !Array.isArray(state.movements))
    return false;
  // Fix plan item 10: a shared workspace saved before observation levels holds `specialling` flags.
  // Every reader of a stored workspace (the server and the browser) comes through here first, so the
  // old rows are read as levels in place, on the freshly parsed copy, and nothing is written back.
  upgradeLegacyObservationRowsInPlace(state);
  const admissionIds = new Set<string>();
  for (const admission of state.admissions) {
    if (!admission || typeof admission !== "object" || typeof admission.id !== "string") return false;
    admissionIds.add(admission.id);
  }
  const movementIds = new Set<string>();
  for (const movement of state.movements) {
    if (!movement || typeof movement !== "object" || typeof movement.id !== "string") return false;
    movementIds.add(movement.id);
  }
  for (const row of state.repatriations) {
    if (
      !row ||
      typeof row !== "object" ||
      Object.getPrototypeOf(row) !== Object.prototype ||
      // A plan agreed after it was first logged also carries `agreedAt` and `agreedBy`.
      Object.keys(row).length !== (Object.hasOwn(row, "agreedAt") ? 12 : 10) ||
      (Object.hasOwn(row, "agreedAt") &&
        (!Number.isFinite(row.agreedAt) || !Object.hasOwn(WARD_FLOW_ROLE_LABELS, row.agreedBy as string))) ||
      typeof row.admissionId !== "string" ||
      !admissionIds.has(row.admissionId) ||
      !Number.isFinite(row.at) ||
      !Number.isFinite(row.estimatedAt) ||
      !Object.hasOwn(WARD_FLOW_ROLE_LABELS, row.by) ||
      typeof row.homeHospital !== "string" ||
      typeof row.cadNumber !== "string" ||
      row.cadNumber.length > 200 ||
      typeof row.receivingWardAgreed !== "boolean" ||
      !REPATRIATION_MODES.includes(row.mode) ||
      !TRANSPORT_PROVIDERS.includes(row.provider) ||
      !TRANSPORT_LEGAL_STATUSES.includes(row.transportLegalStatus)
    )
      return false;
  }
  if (state.supportNotifications !== undefined) {
    if (!Array.isArray(state.supportNotifications)) return false;
    const seenIds = new Set<string>();
    for (const row of state.supportNotifications) {
      if (
        !row ||
        typeof row !== "object" ||
        Object.getPrototypeOf(row) !== Object.prototype ||
        typeof row.id !== "string" ||
        row.id.trim().length === 0 ||
        seenIds.has(row.id) ||
        !SUPPORT_NOTIFICATION_OCCASIONS.includes(row.occasion) ||
        typeof row.subjectId !== "string" ||
        !(row.occasion === "discharge" ? admissionIds.has(row.subjectId) : movementIds.has(row.subjectId)) ||
        !SUPPORT_NOTIFICATION_PARTIES.includes(row.party) ||
        !SUPPORT_NOTIFICATION_OUTCOMES.includes(row.outcome) ||
        !Number.isFinite(row.at) ||
        !Object.hasOwn(WARD_FLOW_ROLE_LABELS, row.by)
      )
        return false;
      if (row.outcome === "told") {
        if (
          Object.keys(row).length !== 9 ||
          typeof row.who !== "string" ||
          row.who.trim().length === 0 ||
          row.who.length > SUPPORT_NOTIFICATION_WHO_MAX_CHARACTERS ||
          !Number.isFinite(row.contactedAt) ||
          (row.contactedAt as number) > row.at ||
          row.reason !== undefined
        )
          return false;
      } else {
        if (
          Object.keys(row).length !== 8 ||
          typeof row.reason !== "string" ||
          row.reason.trim().length === 0 ||
          row.reason.length > SUPPORT_NOTIFICATION_REASON_MAX_CHARACTERS ||
          row.who !== undefined ||
          row.contactedAt !== undefined
        )
          return false;
      }
      seenIds.add(row.id);
    }
  }
  // Shared storage may hold typed patient specific criteria (D-65). Check each record here, then
  // hand the browser schema the fixed-list criteria only.
  const admissions = [];
  for (const admission of state.admissions) {
    const record: unknown = admission.dischargeCriteria;
    if (record === undefined || record === null) {
      admissions.push(admission);
      continue;
    }
    if (!isDischargeCriteriaRecord(record)) return false;
    admissions.push({
      ...admission,
      dischargeCriteria: { ...record, items: record.items.filter((item) => !isPatientSpecificItem(item)) },
    });
  }
  return isValidStoredWardFlowState({
    ...state,
    admissions,
    repatriations: [],
    ...(state.supportNotifications === undefined ? {} : { supportNotifications: [] }),
  });
}

/** `upgradeLegacyObservationRows`, applied to the given parsed state's own arrays. */
function upgradeLegacyObservationRowsInPlace(state: WardFlowState): void {
  const upgraded = upgradeLegacyObservationRows(state);
  if (upgraded === state) return;
  state.movements = upgraded.movements;
  state.admissions = upgraded.admissions;
}

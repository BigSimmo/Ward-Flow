import { isValidStoredWardFlowState } from "./ward-flow-storage-validation";
import { REPATRIATION_MODES, WARD_FLOW_ROLE_LABELS } from "./ward-flow-events";
import { TRANSPORT_LEGAL_STATUSES, TRANSPORT_PROVIDERS } from "./ward-model";
import type { WardFlowState } from "./ward-flow-reducer";

/** Shared synthetic storage has an explicit repatriation schema. The browser's D-18
 * persistence fence remains unchanged, including its prohibition on storing refusals. */
export function isValidSharedWardFlowState(value: unknown): value is WardFlowState {
  if (!value || typeof value !== "object") return false;
  const state = value as WardFlowState;
  if (!Array.isArray(state.repatriations) || !Array.isArray(state.admissions)) return false;
  const admissionIds = new Set<string>();
  for (const admission of state.admissions) {
    if (!admission || typeof admission !== "object" || typeof admission.id !== "string") return false;
    admissionIds.add(admission.id);
  }
  for (const row of state.repatriations) {
    if (
      !row ||
      typeof row !== "object" ||
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
  return isValidStoredWardFlowState({ ...state, repatriations: [] });
}

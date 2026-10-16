/**
 * The few access rules the shell on every screen needs (role access plan, later pass), kept apart
 * from `ward-access-admin.ts` so the shell does not load every admin rule. That module re-exports
 * these, so the server reads them from the same place as the rest.
 */
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import type { WardAccess, WardAccessRole, WardAccessScope } from "@/components/ward-management/ward-role-access";

/** Granting access or breaking glass needs a sign-in this recent (synthetic). */
export const STEP_UP_MINUTES = CLINICAL_VALUES.stepUpWindow.value;

/**
 * Who hears phone alerts by role (feature 10): a coordinator, a site bed manager, a nurse in
 * charge or an ED clinician, each for the act-now rows inside their own place only. An executive
 * sees counts, an access admin no patients, so neither is sent alerts.
 */
export const PUSH_ROLES: readonly WardAccessRole[] = ["coordinator", "bed_manager", "ward", "ed"];

/**
 * A nurse in charge working with cover of more wards: the covered wards join its own, so night
 * cover of two wards is one desk. An ED desk works one ED at a time, so ED cover is its own choice
 * of who to work as, never merged.
 */
export function withCover(access: WardAccess, covers: readonly WardAccessScope[]): WardAccess {
  if (access.role !== "ward" || access.scope.kind !== "ward") return access;
  const unitIds = [...access.scope.unitIds];
  for (const cover of covers)
    if (cover.kind === "ward") for (const id of cover.unitIds) if (!unitIds.includes(id)) unitIds.push(id);
  return unitIds.length === access.scope.unitIds.length ? access : { role: "ward", scope: { kind: "ward", unitIds } };
}

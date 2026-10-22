import { GENERAL_OBSERVATION, observationAt } from "@/components/ward-management/ward-observation";

// Kept apart from `ward-observation.ts` so it loads only with the save and shared-state checks that
// call it, not with the engine every page loads.

/**
 * READING SAVES MADE BEFORE OBSERVATION LEVELS. A movement or admission saved before fix plan item
 * 10 carries `specialling: boolean` and no `observation`. This reads it as the level that flag meant
 * for the ward's staffing: `true` as Constant within sight (one staff, the old one-to-one count) and
 * `false` as General. Nothing else is changed. Rows already holding an `observation` are left as
 * they are, and a state with no old rows comes back as the same object, so a current save is never
 * copied. Used by every restore path (browser saves and scenario files through
 * `migrateStoredWardFlowState`, the shared workspace through `isValidSharedWardFlowState`).
 */
export function upgradeLegacyObservationRows<T>(state: T): T {
  if (typeof state !== "object" || state === null) return state;
  const record = state as Record<string, unknown>;
  let changed = false;
  const upgraded: Record<string, unknown> = {};
  for (const key of ["movements", "admissions"] as const) {
    const rows = record[key];
    if (!Array.isArray(rows)) continue;
    let rowsChanged = false;
    const next = rows.map((row: unknown) => {
      if (typeof row !== "object" || row === null) return row;
      const fields = row as Record<string, unknown>;
      if ("observation" in fields || typeof fields.specialling !== "boolean") return row;
      rowsChanged = true;
      const { specialling, ...rest } = fields;
      return { ...rest, observation: specialling ? observationAt("within_sight") : { ...GENERAL_OBSERVATION } };
    });
    if (rowsChanged) {
      changed = true;
      upgraded[key] = next;
    }
  }
  return changed ? ({ ...record, ...upgraded } as T) : state;
}

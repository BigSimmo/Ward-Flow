import type { DeclineReason } from "@/components/ward-management/ward-model";

// Kept apart, like `ward-observation-legacy.ts`: the save checks and the `DECLINE` case read retired
// values through it, and nothing else needs it.

/** The retired ward values and the merged reason each one now reads as (D-78). */
export const LEGACY_DECLINE_REASONS: Readonly<Record<string, DeclineReason>> = {
  no_bed: "no_suitable_bed",
  sex_mix: "sex_designation_unavailable",
  out_of_catchment: "belongs_to_another_service",
};

/**
 * READING SAVES MADE BEFORE THE ONE DECLINE LIST (D-78). A movement saved before then can hold a
 * retired ward value (`no_bed`, `sex_mix`, `out_of_catchment`) in a decline and in the stage change
 * that decline wrote. This reads each one as the merged reason it maps to. Nothing else is changed,
 * and a state with no retired values comes back as the same object, so a current save is never
 * copied. Every restore path reads through it: browser saves and scenario files in
 * `withInboxStreamADefaults`, the shared workspace in `isValidSharedWardFlowState`.
 */
export function upgradeLegacyDeclineReasons<T>(state: T): T {
  if (typeof state !== "object" || state === null) return state;
  const record = state as Record<string, unknown>;
  if (!Array.isArray(record.movements)) return state;
  let changed = false;
  const movements = record.movements.map((row: unknown) => {
    if (typeof row !== "object" || row === null) return row;
    const fields = row as Record<string, unknown>;
    const declines = upgradeReasons(fields.declines);
    const stageChanges = upgradeReasons(fields.stageChanges);
    if (declines === fields.declines && stageChanges === fields.stageChanges) return row;
    changed = true;
    return { ...fields, declines, stageChanges };
  });
  return changed ? ({ ...record, movements } as T) : state;
}

function upgradeReasons(rows: unknown): unknown {
  if (!Array.isArray(rows)) return rows;
  let changed = false;
  const next = rows.map((row: unknown) => {
    if (typeof row !== "object" || row === null) return row;
    const reason = (row as { reason?: unknown }).reason;
    if (typeof reason !== "string" || !Object.hasOwn(LEGACY_DECLINE_REASONS, reason)) return row;
    changed = true;
    return { ...row, reason: LEGACY_DECLINE_REASONS[reason] };
  });
  return changed ? next : rows;
}

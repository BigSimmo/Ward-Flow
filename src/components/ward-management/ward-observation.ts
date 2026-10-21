import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import { CLINICAL_VALUES, OBSERVATION_LEVEL_NAMES } from "@/components/ward-management/ward-clinical-values";

/**
 * OBSERVATION LEVELS — fix plan item 10 (Josh, 21 Oct 2026), replacing the yes/no `specialling` flag.
 *
 * A level is recorded by a person, at intake and afterwards by `RECORD_OBSERVATION_LEVEL`. It is a
 * fact about how the ward is staffing the bed, the same narrow claim the old flag made. Nothing
 * scores, suggests or places from it (D-71): its only use beyond display is the staff count the
 * existing capacity check already refused on.
 *
 * Staffing (Josh's decision): the two one-to-one levels count one staff each and two staff constant
 * counts two, against the ward's authored `Unit.speciallingCapacity`, which is now a count of staff
 * the ward can commit to constant observation. General and Intermittent count none.
 *
 * The names a person reads come from `OBSERVATION_LEVEL_NAMES` in the clinical values file, because
 * they vary by health service. Stored records keep the code below, never the name.
 */
export const OBSERVATION_LEVELS = ["general", "intermittent", "within_sight", "arms_length", "two_staff"] as const;
export type ObservationLevel = (typeof OBSERVATION_LEVELS)[number];

/** The intervals a person can choose for Intermittent observation, shortest first. */
export const INTERMITTENT_INTERVAL_MINUTES: readonly number[] = [
  CLINICAL_VALUES.observationIntermittentShort.value,
  CLINICAL_VALUES.observationIntermittentLong.value,
];

export type Observation = {
  level: ObservationLevel;
  /** Intermittent only: minutes between checks, one of `INTERMITTENT_INTERVAL_MINUTES`. `null` for every other level. */
  intervalMinutes: number | null;
  /** The typed next review time. `null` when nobody recorded one; never calculated. */
  reviewAt: Instant | null;
};

/** One entry per change after intake, oldest first. Written only by `RECORD_OBSERVATION_LEVEL`. */
export type ObservationChange = { at: Instant; from: Observation; to: Observation };

/** The ordinary state: General, with no review time recorded. */
export const GENERAL_OBSERVATION: Observation = Object.freeze({
  level: "general",
  intervalMinutes: null,
  reviewAt: null,
});

/** Shorthand for seeds and tests: a level with no interval or review time beyond what it needs. */
export function observationAt(level: ObservationLevel, reviewAt: Instant | null = null): Observation {
  return {
    level,
    intervalMinutes: level === "intermittent" ? CLINICAL_VALUES.observationIntermittentShort.value : null,
    reviewAt,
  };
}

/** How many staff this level counts against the ward's observation capacity. */
export function observationStaff(level: ObservationLevel): number {
  return level === "two_staff" ? 2 : level === "within_sight" || level === "arms_length" ? 1 : 0;
}

/** Staff this ward is committing to constant observation for the people in its beds now. */
export function observationStaffOnWard(unitId: string, admissions: readonly Admission[]): number {
  return admissions
    .filter((admission) => admission.unitId === unitId && admission.state === "occupied")
    .reduce((total, admission) => total + observationStaff(admission.observation.level), 0);
}

/** True for the constant levels, the ones that take staff from the ward's observation capacity. */
export function isConstantObservation(observation: Pick<Observation, "level"> | undefined): boolean {
  return observation !== undefined && observationStaff(observation.level) > 0;
}

/** The ratio a constant level is staffed at, as nurses write it, or `null` for General and Intermittent. */
export function observationRatio(level: ObservationLevel): string | null {
  const staff = observationStaff(level);
  return staff > 0 ? `${staff}:1` : null;
}

export function observationLevelName(level: ObservationLevel): string {
  return OBSERVATION_LEVEL_NAMES[level];
}

/**
 * The level as one line: "General, hourly", "Intermittent, every 15 minutes",
 * "Constant within sight (1:1)". The review time is not included; see `observationReviewText`.
 */
export function observationSummary(observation: Observation): string {
  const name = observationLevelName(observation.level);
  if (observation.level === "general") return `${name}, hourly`;
  if (observation.level === "intermittent") {
    return observation.intervalMinutes === null ? name : `${name}, every ${observation.intervalMinutes} minutes`;
  }
  return `${name} (${observationRatio(observation.level)})`;
}

/** Membership and shape check for anything read back from storage or sent in an event. */
export function isObservation(value: unknown): value is Observation {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  // Exactly these three keys: an extra one could carry typed text past the storage fence.
  if (Object.keys(record).sort().join() !== "intervalMinutes,level,reviewAt") return false;
  if (!OBSERVATION_LEVELS.includes(record.level as ObservationLevel)) return false;
  const interval = record.intervalMinutes;
  if (record.level === "intermittent") {
    if (typeof interval !== "number" || !INTERMITTENT_INTERVAL_MINUTES.includes(interval)) return false;
  } else if (interval !== null) {
    return false;
  }
  const reviewAt = record.reviewAt;
  return reviewAt === null || (typeof reviewAt === "number" && Number.isFinite(reviewAt));
}

/** Two records say the same thing. */
export function sameObservation(a: Observation, b: Observation): boolean {
  return a.level === b.level && a.intervalMinutes === b.intervalMinutes && a.reviewAt === b.reviewAt;
}

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

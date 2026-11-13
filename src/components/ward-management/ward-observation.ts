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

/**
 * NOT RECORDED (root-cause fix 3.5, approved by Josh 13 Nov 2026). Where the app makes a stay itself
 * (a planned arrival turned into a stay, a save from before observation levels, a stay hidden from a
 * desk) nobody chose a level, so the record says so rather than holding General. It reads "Not
 * recorded", is never counted as General, and is not one of the choices in `OBSERVATION_LEVELS`: a
 * person records a level, they do not pick "not recorded". It counts no staff, as the absent level
 * did before; how an unrecorded level should be treated clinically is Josh's call (none proposed).
 */
export const OBSERVATION_NOT_RECORDED = "not_recorded";
/** A level a person can record. */
type RecordedObservationLevel = (typeof OBSERVATION_LEVELS)[number];
export type ObservationLevel = RecordedObservationLevel | typeof OBSERVATION_NOT_RECORDED;

/** The intervals a person can choose for Intermittent observation, shortest first. */
export const INTERMITTENT_INTERVAL_MINUTES: readonly number[] = [
  CLINICAL_VALUES.observationIntermittentShort.value,
  CLINICAL_VALUES.observationIntermittentLong.value,
];
/**
 * D-187 item 19 (Q44): the inline error when Intermittent is recorded with no interval chosen. No
 * interval starts chosen on any form; each form refuses Intermittent without one, in these words.
 */
export const NO_INTERVAL_ERROR = `Choose how often to check: ${INTERMITTENT_INTERVAL_MINUTES.join(" or ")} minutes.`;

export type Observation = {
  level: ObservationLevel;
  /** Intermittent only: minutes between checks, one of `INTERMITTENT_INTERVAL_MINUTES`. `null` for every other level. */
  intervalMinutes: number | null;
  /** The typed next review time. `null` when nobody recorded one; never calculated. */
  reviewAt: Instant | null;
};

/** Recorded observation edits and arrival reconciliations after intake, oldest first. */
export type ObservationChange = {
  at: Instant;
  from: Observation;
  to: Observation;
  /** Accepted reducer order, shared across journeys and stays. Absent in older saves. */
  sequence?: number;
};

/** New accepted changes follow legacy history even when the caller's minute has not advanced.
 * Without sequence metadata the historical timestamp rule remains the compatibility fallback;
 * an exact old tie has no recoverable actor order and keeps the journey's value. */
export function journeyObservationWins(
  journey: readonly ObservationChange[] | undefined,
  stay: readonly ObservationChange[] | undefined,
): boolean {
  const lastJourney = journey?.at(-1);
  const lastStay = stay?.at(-1);
  if (lastJourney?.sequence !== undefined || lastStay?.sequence !== undefined) {
    return (lastJourney?.sequence ?? -1) >= (lastStay?.sequence ?? -1);
  }
  return (lastJourney?.at ?? Number.NEGATIVE_INFINITY) >= (lastStay?.at ?? Number.NEGATIVE_INFINITY);
}

/** The ordinary state: General, with no review time recorded. */
export const GENERAL_OBSERVATION: Observation = Object.freeze({
  level: "general",
  intervalMinutes: null,
  reviewAt: null,
});

/** No level recorded: nobody chose one. Never shown or counted as General. */
export const NOT_RECORDED_OBSERVATION: Observation = Object.freeze({
  level: OBSERVATION_NOT_RECORDED,
  intervalMinutes: null,
  reviewAt: null,
});

/** True when a person recorded a level (anything but "not recorded"). */
export function observationIsRecorded(observation: Pick<Observation, "level"> | undefined): boolean {
  return observation !== undefined && observation.level !== OBSERVATION_NOT_RECORDED;
}

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
  return level === OBSERVATION_NOT_RECORDED ? "Not recorded" : OBSERVATION_LEVEL_NAMES[level];
}

/**
 * The level as one line: "General, hourly", "Intermittent, every 15 minutes",
 * "Constant within sight (1:1)". The review time is not included; see `observationReviewText`.
 */
export function observationSummary(observation: Observation): string {
  const name = observationLevelName(observation.level);
  if (observation.level === OBSERVATION_NOT_RECORDED) return name;
  if (observation.level === "general") {
    const hours = CLINICAL_VALUES.observationGeneral.value;
    return hours === 1 ? `${name}, hourly` : `${name}, every ${hours} hours`;
  }
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
  if (
    record.level !== OBSERVATION_NOT_RECORDED &&
    !OBSERVATION_LEVELS.includes(record.level as RecordedObservationLevel)
  )
    return false;
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

import {
  ED_ACCESS_TARGET_MINUTES,
  ED_ACCESS_TARGET_RANGE_MINUTES,
  MORNING_ROLLUP_TIME_MINUTES,
  MORNING_ROLLUP_TIME_RANGE_MINUTES,
  PARALLEL_REFERRAL_CAP,
  PARALLEL_REFERRAL_CAP_RANGE,
  PULL_HOLD_MINUTES,
  PULL_HOLD_RANGE_MINUTES,
} from "@/components/ward-management/ward-model";
import {
  DECISION_TARGET_RANGE_MINUTES,
  DUE_SOON_MINUTES,
  DUE_SOON_RANGE_MINUTES,
  DUE_SOON_URGENT_MINUTES,
  DUE_SOON_URGENT_RANGE_MINUTES,
  PLACEMENT_DECISION_TARGET_MINUTES,
  TRANSFER_ACCEPTANCE_TARGET_MINUTES,
  TRANSPORT_BOOKED_TARGET_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";

/**
 * The four coordinator-tunable figures wired to an engine read site (Task 2 of the
 * audit-wiring plan, 2026-09-16, extended with morningRollupDeadlineMinutes). No numeric
 * literal appears in this file: every default and every bound is read from `ward-model.ts`,
 * which is where each figure's provenance is recorded.
 */
export type WardConfiguration = {
  /** Minutes; departmental ED access target counted up from `Movement.openedAt`. See
   *  `ED_ACCESS_TARGET_MINUTES`'s own doc comment for what it is and is not. */
  edAccessTargetMinutes: number;
  /** Count of units; how many wards ONE referral may be sent to in ONE act. See
   *  `PARALLEL_REFERRAL_CAP`'s own doc comment. */
  parallelReferralCap: number;
  /** Minutes; how long a `PULL_PATIENT` hold on an accepting unit's bed lasts before it expires.
   *  See `PULL_HOLD_MINUTES`'s own doc comment — the figure itself is unsourced. */
  pullHoldMinutes: number;
  /** Minutes from midnight; the morning discharge and census rollup deadline. */
  morningRollupDeadlineMinutes: number;
  /** Minutes before a recorded legal due time when it shows as due within the hour (Josh's
   *  default, not a legal limit; changeable in Settings, 26 Sept 2026). */
  dueSoonUrgentMinutes: number;
  /** Minutes before a recorded legal due time when it first shows as due soon. Always later than
   *  `dueSoonUrgentMinutes`. */
  dueSoonMinutes: number;
  /** Minutes from referral to a ward's answer before the referral decision shows overdue. A
   *  labelled default set in Settings, not a service standard (stream A, 9 Oct 2026). */
  referralDecisionTargetMinutes: number;
  /** Minutes from acceptance in principle to the bed being pulled. Default, set in Settings. */
  transferAcceptanceTargetMinutes: number;
  /** Minutes from the bed being pulled to transport being booked. Default, set in Settings. */
  transportBookedTargetMinutes: number;
};

/** The keys `WardConfiguration` carries, and no others — the same list `validateConfiguration`
 *  checks a payload against. */
const CONFIGURATION_KEYS = [
  "edAccessTargetMinutes",
  "parallelReferralCap",
  "pullHoldMinutes",
  "morningRollupDeadlineMinutes",
  "dueSoonUrgentMinutes",
  "dueSoonMinutes",
  "referralDecisionTargetMinutes",
  "transferAcceptanceTargetMinutes",
  "transportBookedTargetMinutes",
] as const;

/** Keys a stored or older payload may leave out; each takes its default when missing. */
const OPTIONAL_KEYS: readonly (keyof WardConfiguration)[] = [
  "morningRollupDeadlineMinutes",
  "dueSoonUrgentMinutes",
  "dueSoonMinutes",
  "referralDecisionTargetMinutes",
  "transferAcceptanceTargetMinutes",
  "transportBookedTargetMinutes",
];

const OPTIONAL_DEFAULTS: Pick<
  WardConfiguration,
  | "morningRollupDeadlineMinutes"
  | "dueSoonUrgentMinutes"
  | "dueSoonMinutes"
  | "referralDecisionTargetMinutes"
  | "transferAcceptanceTargetMinutes"
  | "transportBookedTargetMinutes"
> = {
  morningRollupDeadlineMinutes: MORNING_ROLLUP_TIME_MINUTES,
  dueSoonUrgentMinutes: DUE_SOON_URGENT_MINUTES,
  dueSoonMinutes: DUE_SOON_MINUTES,
  referralDecisionTargetMinutes: PLACEMENT_DECISION_TARGET_MINUTES,
  transferAcceptanceTargetMinutes: TRANSFER_ACCEPTANCE_TARGET_MINUTES,
  transportBookedTargetMinutes: TRANSPORT_BOOKED_TARGET_MINUTES,
};

/** Seeds `WardFlowState.configuration` and is what `RESET_SCENARIO`/`SET_SCENARIO` reseed to. */
export function defaultWardConfiguration(): WardConfiguration {
  return {
    edAccessTargetMinutes: ED_ACCESS_TARGET_MINUTES,
    parallelReferralCap: PARALLEL_REFERRAL_CAP,
    pullHoldMinutes: PULL_HOLD_MINUTES,
    morningRollupDeadlineMinutes: MORNING_ROLLUP_TIME_MINUTES,
    dueSoonUrgentMinutes: DUE_SOON_URGENT_MINUTES,
    dueSoonMinutes: DUE_SOON_MINUTES,
    referralDecisionTargetMinutes: PLACEMENT_DECISION_TARGET_MINUTES,
    transferAcceptanceTargetMinutes: TRANSFER_ACCEPTANCE_TARGET_MINUTES,
    transportBookedTargetMinutes: TRANSPORT_BOOKED_TARGET_MINUTES,
  };
}

type Bounds = { min: number; max: number; step: number };

const BOUNDS: Record<keyof WardConfiguration, Bounds> = {
  edAccessTargetMinutes: ED_ACCESS_TARGET_RANGE_MINUTES,
  parallelReferralCap: PARALLEL_REFERRAL_CAP_RANGE,
  pullHoldMinutes: PULL_HOLD_RANGE_MINUTES,
  morningRollupDeadlineMinutes: MORNING_ROLLUP_TIME_RANGE_MINUTES,
  dueSoonUrgentMinutes: DUE_SOON_URGENT_RANGE_MINUTES,
  dueSoonMinutes: DUE_SOON_RANGE_MINUTES,
  referralDecisionTargetMinutes: DECISION_TARGET_RANGE_MINUTES,
  transferAcceptanceTargetMinutes: DECISION_TARGET_RANGE_MINUTES,
  transportBookedTargetMinutes: DECISION_TARGET_RANGE_MINUTES,
};

function isOnStep(value: number, bounds: Bounds): boolean {
  // Floating-point-safe: work in step units rather than dividing and comparing to an integer.
  const steps = (value - bounds.min) / bounds.step;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
}

function isValidField(key: keyof WardConfiguration, value: unknown): value is number {
  if (typeof value !== "number" || !Number.isInteger(value)) return false;
  const bounds = BOUNDS[key];
  return value >= bounds.min && value <= bounds.max && isOnStep(value, bounds);
}

/**
 * Refuses anything that is not in-range, on-step integers matching the configuration keys.
 * Supports legacy 3-key payloads (without `morningRollupDeadlineMinutes`), defaulting it.
 * Returns `null` on any failure rather than throwing or coercing, so the reducer can refuse a
 * `SET_CONFIGURATION` payload the same way it refuses any other invalid event — never partially
 * apply one field while rejecting another.
 */
export function validateConfiguration(payload: unknown): WardConfiguration | null {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const keys = Object.keys(record);

  const expectedKeys = CONFIGURATION_KEYS.filter((key) => keys.includes(key) || !OPTIONAL_KEYS.includes(key));

  if (keys.length !== expectedKeys.length) return null;
  if (!expectedKeys.every((key) => keys.includes(key))) return null;

  for (const key of expectedKeys) {
    if (!isValidField(key, record[key])) return null;
  }

  const read = (key: keyof typeof OPTIONAL_DEFAULTS): number =>
    keys.includes(key) ? (record[key] as number) : OPTIONAL_DEFAULTS[key];
  const configuration: WardConfiguration = {
    edAccessTargetMinutes: record.edAccessTargetMinutes as number,
    parallelReferralCap: record.parallelReferralCap as number,
    pullHoldMinutes: record.pullHoldMinutes as number,
    morningRollupDeadlineMinutes: read("morningRollupDeadlineMinutes"),
    dueSoonUrgentMinutes: read("dueSoonUrgentMinutes"),
    dueSoonMinutes: read("dueSoonMinutes"),
    referralDecisionTargetMinutes: read("referralDecisionTargetMinutes"),
    transferAcceptanceTargetMinutes: read("transferAcceptanceTargetMinutes"),
    transportBookedTargetMinutes: read("transportBookedTargetMinutes"),
  };
  // The first warning must come before the second, or "due within the hour" would never show.
  if (configuration.dueSoonUrgentMinutes >= configuration.dueSoonMinutes) return null;
  return configuration;
}

/**
 * Names the reason `validateConfiguration` returned `null`, for `SET_CONFIGURATION`'s rejection
 * message (Task 3 of the audit-wiring plan). `validateConfiguration` itself stays a pure
 * accept/refuse boundary — this is a diagnostic read of the same payload, never a second source
 * of the validation rule.
 */
export function describeInvalidConfiguration(payload: unknown): string {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return `configuration payload must be an object with exactly ${CONFIGURATION_KEYS.join(", ")}`;
  }
  const record = payload as Record<string, unknown>;
  const keys = Object.keys(record);

  const expectedKeys = CONFIGURATION_KEYS.filter((key) => keys.includes(key) || !OPTIONAL_KEYS.includes(key));

  const missing = expectedKeys.filter((key) => !keys.includes(key));
  if (missing.length > 0) return `configuration payload is missing ${missing.join(", ")}`;
  const extra = keys.filter((key) => !(CONFIGURATION_KEYS as readonly string[]).includes(key));
  if (extra.length > 0) return `configuration payload has unexpected key(s) ${extra.join(", ")}`;
  for (const key of expectedKeys) {
    if (!isValidField(key, record[key])) {
      const bounds = BOUNDS[key];
      return `${key} must be an integer between ${bounds.min} and ${bounds.max} in steps of ${bounds.step}`;
    }
  }
  const urgent = keys.includes("dueSoonUrgentMinutes") ? record.dueSoonUrgentMinutes : DUE_SOON_URGENT_MINUTES;
  const soon = keys.includes("dueSoonMinutes") ? record.dueSoonMinutes : DUE_SOON_MINUTES;
  if (typeof urgent === "number" && typeof soon === "number" && urgent >= soon) {
    return "dueSoonUrgentMinutes must be less than dueSoonMinutes";
  }
  return "invalid configuration payload";
}

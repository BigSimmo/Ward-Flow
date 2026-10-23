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
  WARD_ANSWER_TARGET_MINUTES,
  TRANSFER_ACCEPTANCE_TARGET_MINUTES,
  TRANSPORT_BOOKED_TARGET_MINUTES,
  FORECAST_ED_RISK_LEAD_MINUTES,
  FORECAST_ED_RISK_LEAD_RANGE_MINUTES,
  FORECAST_SHORT_ALERT_BEDS,
  FORECAST_SHORT_ALERT_RANGE_BEDS,
  FORECAST_WORSE_ALERT_BEDS,
  FORECAST_WORSE_ALERT_RANGE_BEDS,
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
  /** Beds; a bed type likely this many short tomorrow raises a Forecast alert (23 Oct 2026). */
  forecastShortBeds: number;
  /** Minutes; alert when someone in ED will pass the access target within this time. */
  forecastEdLeadMinutes: number;
  /** Beds; alert when tomorrow's likely figure has dropped this much since the last look. */
  forecastWorseBeds: number;
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
  "forecastShortBeds",
  "forecastEdLeadMinutes",
  "forecastWorseBeds",
] as const;

const OPTIONAL_DEFAULTS: Pick<
  WardConfiguration,
  | "morningRollupDeadlineMinutes"
  | "dueSoonUrgentMinutes"
  | "dueSoonMinutes"
  | "referralDecisionTargetMinutes"
  | "transferAcceptanceTargetMinutes"
  | "transportBookedTargetMinutes"
  | "forecastShortBeds"
  | "forecastEdLeadMinutes"
  | "forecastWorseBeds"
> = {
  morningRollupDeadlineMinutes: MORNING_ROLLUP_TIME_MINUTES,
  dueSoonUrgentMinutes: DUE_SOON_URGENT_MINUTES,
  dueSoonMinutes: DUE_SOON_MINUTES,
  referralDecisionTargetMinutes: WARD_ANSWER_TARGET_MINUTES,
  transferAcceptanceTargetMinutes: TRANSFER_ACCEPTANCE_TARGET_MINUTES,
  transportBookedTargetMinutes: TRANSPORT_BOOKED_TARGET_MINUTES,
  forecastShortBeds: FORECAST_SHORT_ALERT_BEDS,
  forecastEdLeadMinutes: FORECAST_ED_RISK_LEAD_MINUTES,
  forecastWorseBeds: FORECAST_WORSE_ALERT_BEDS,
};

/** Keys a stored or older payload may leave out; each takes its default when missing. */
const OPTIONAL_KEYS = Object.keys(OPTIONAL_DEFAULTS) as readonly (keyof WardConfiguration)[];

/** Seeds `WardFlowState.configuration` and is what `RESET_SCENARIO`/`SET_SCENARIO` reseed to. */
export function defaultWardConfiguration(): WardConfiguration {
  return {
    edAccessTargetMinutes: ED_ACCESS_TARGET_MINUTES,
    parallelReferralCap: PARALLEL_REFERRAL_CAP,
    pullHoldMinutes: PULL_HOLD_MINUTES,
    ...OPTIONAL_DEFAULTS,
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
  forecastShortBeds: FORECAST_SHORT_ALERT_RANGE_BEDS,
  forecastEdLeadMinutes: FORECAST_ED_RISK_LEAD_RANGE_MINUTES,
  forecastWorseBeds: FORECAST_WORSE_ALERT_RANGE_BEDS,
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

/** The keys a payload with these keys must carry: every required key, plus the optional ones it has. */
function expectedKeysOf(keys: string[]) {
  return CONFIGURATION_KEYS.filter((key) => keys.includes(key) || !OPTIONAL_KEYS.includes(key));
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

  const expectedKeys = expectedKeysOf(keys);

  if (keys.length !== expectedKeys.length) return null;
  if (!expectedKeys.every((key) => keys.includes(key))) return null;

  for (const key of expectedKeys) {
    if (!isValidField(key, record[key])) return null;
  }

  // Every key is checked above; a missing optional one takes its default. Built in key order.
  const configuration = Object.fromEntries(
    CONFIGURATION_KEYS.map((key) => [
      key,
      keys.includes(key) ? record[key] : OPTIONAL_DEFAULTS[key as keyof typeof OPTIONAL_DEFAULTS],
    ]),
  ) as WardConfiguration;
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

  const expectedKeys = expectedKeysOf(keys);

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
  const { dueSoonUrgentMinutes: urgent, dueSoonMinutes: soon } = { ...OPTIONAL_DEFAULTS, ...record };
  if (typeof urgent === "number" && typeof soon === "number" && urgent >= soon) {
    return "dueSoonUrgentMinutes must be less than dueSoonMinutes";
  }
  return "invalid configuration payload";
}

/**
 * Three-way atomic merge: only the draft's edited fields replace current values. `replaceAll`
 * (Restore defaults) treats every field as edited, so another desk's later change is refused.
 */
export function mergeConfiguration(
  current: WardConfiguration,
  requested: unknown,
  base: unknown,
  replaceAll = false,
):
  | { status: "merged"; configuration: WardConfiguration }
  | { status: "conflict"; fields: (keyof WardConfiguration)[] }
  | { status: "invalid" } {
  const draft = validateConfiguration(requested);
  const original = validateConfiguration(base);
  if (!draft || !original) return { status: "invalid" };
  const configuration = { ...current };
  const fields: (keyof WardConfiguration)[] = [];
  for (const key of CONFIGURATION_KEYS) {
    if (!replaceAll && draft[key] === original[key]) continue;
    if (current[key] !== original[key] && current[key] !== draft[key]) fields.push(key);
    configuration[key] = draft[key];
  }
  if (fields.length) return { status: "conflict", fields };
  return validateConfiguration(configuration) ? { status: "merged", configuration } : { status: "invalid" };
}

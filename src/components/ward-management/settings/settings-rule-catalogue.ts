// Settings round 3 (mock-up, 30 Oct 2026): one list of the twelve rules, read by the review before
// saving, the restore dialog, the "changed from default" marks and Find a setting, so a rule's name,
// words and readers live in one place instead of four.
import { defaultWardConfiguration, type WardConfiguration } from "@/components/ward-management/ward-configuration";
import {
  clock24,
  fullRules,
  shortDuration,
  wardsText,
} from "@/components/ward-management/settings/settings-screen-model";
import { ED_ACCESS_TARGET_RANGE_MINUTES, PARALLEL_REFERRAL_CAP_RANGE } from "@/components/ward-management/ward-model";

export type RuleKey = keyof ReturnType<typeof fullRules>;

function bedsText(beds: number): string {
  return `${beds} ${beds === 1 ? "bed" : "beds"}`;
}

export type RuleEntry = {
  readonly key: RuleKey;
  /** The rule row's Find a setting target (`data-setting`). */
  readonly setting: string;
  readonly label: string;
  readonly group: string;
  readonly shownOn: string;
  readonly display: (value: number) => string;
};

/** Page order: the order the Rules tab draws them in. */
export const RULES: readonly RuleEntry[] = [
  {
    key: "ed",
    setting: "ed-target",
    label: "ED wait target",
    group: "ED and placement",
    shownOn: "Home, ED, Movements",
    display: (v) => `${v / 60}h`,
  },
  {
    key: "cap",
    setting: "wards-asked",
    label: "Wards asked at once",
    group: "ED and placement",
    shownOn: "Home, Referrals, Placement",
    display: wardsText,
  },
  {
    key: "hold",
    setting: "pull-hold",
    label: "Pull time limit",
    group: "ED and placement",
    shownOn: "Home, ED, Referrals",
    display: shortDuration,
  },
  {
    key: "soon",
    setting: "second-warning",
    label: "Early warning",
    group: "Form warnings",
    shownOn: "Home, every legal due time",
    display: shortDuration,
  },
  {
    key: "urgent",
    setting: "first-warning",
    label: "Final warning",
    group: "Form warnings",
    shownOn: "Home, every legal due time",
    display: shortDuration,
  },
  {
    key: "morning",
    setting: "morning-count",
    label: "Morning bed numbers due",
    group: "Deadlines and reply targets",
    shownOn: "Wards, Ward alerts",
    display: clock24,
  },
  {
    key: "referralTarget",
    setting: "target-referral_decision",
    label: "Referral decision",
    group: "Deadlines and reply targets",
    shownOn: "Alerts, Tasks",
    display: shortDuration,
  },
  {
    key: "transferTarget",
    setting: "target-transfer_acceptance",
    label: "Transfer acceptance",
    group: "Deadlines and reply targets",
    shownOn: "Alerts, Tasks",
    display: shortDuration,
  },
  {
    key: "transportTarget",
    setting: "target-transport_booked",
    label: "Transport booked",
    group: "Deadlines and reply targets",
    shownOn: "Alerts, Tasks",
    display: shortDuration,
  },
  {
    key: "forecastShort",
    setting: "forecast-short",
    label: "Bed type short tomorrow",
    group: "Forecast alerts",
    shownOn: "Alerts",
    display: bedsText,
  },
  {
    key: "forecastEdLead",
    setting: "forecast-ed-lead",
    label: "Access target forecast",
    group: "Forecast alerts",
    shownOn: "Alerts",
    display: shortDuration,
  },
  {
    key: "forecastWorse",
    setting: "forecast-worse",
    label: "Forecast got worse",
    group: "Forecast alerts",
    shownOn: "Alerts",
    display: bedsText,
  },
];

export const DEFAULT_RULES = fullRules(defaultWardConfiguration());

export type RuleChange = { readonly entry: RuleEntry; readonly before: number; readonly after: number };

/** Every rule that differs between two configurations, in page order. */
export function ruleChanges(before: WardConfiguration, after: WardConfiguration): RuleChange[] {
  const a = fullRules(before);
  const b = fullRules(after);
  return RULES.filter((entry) => a[entry.key] !== b[entry.key]).map((entry) => ({
    entry,
    before: a[entry.key],
    after: b[entry.key],
  }));
}

/** How many rules sit away from their defaults right now (the "Show changed only" count). */
export function rulesAwayFromDefault(value: WardConfiguration): number {
  const rules = fullRules(value);
  return RULES.filter((entry) => rules[entry.key] !== DEFAULT_RULES[entry.key]).length;
}

/** The values the Surge choice writes, as the screen's handler writes them. */
export function surgeConfiguration(value: WardConfiguration): WardConfiguration {
  return {
    ...value,
    parallelReferralCap: PARALLEL_REFERRAL_CAP_RANGE.max,
    edAccessTargetMinutes: ED_ACCESS_TARGET_RANGE_MINUTES.min,
    pullHoldMinutes: 120,
  };
}

/**
 * What Surge changes against the defaults, in words. Surge sets the wards-asked limit to its
 * maximum, which is also its default, so only two rules really move; the choice says so.
 */
export function surgeChanges(): RuleChange[] {
  const defaults = defaultWardConfiguration();
  return ruleChanges(defaults, surgeConfiguration(defaults));
}

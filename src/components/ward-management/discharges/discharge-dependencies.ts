import type { Instant } from "@/components/ward-management/ward-clock";
import type { LeavingDestination } from "@/components/ward-management/ward-admissions";

/**
 * Closing-the-loop package B (24 Oct 2026): the practical things a discharge waits on, recorded as
 * a short list on the bed release instead of one blocker line.
 *
 * ⚠️ **LOGISTICS ONLY.** Every item says who arranges something and whether it is done. None of it
 * is a clinical decision, and nothing here marks a person ready, confirms a release or frees a bed.
 * The ward still confirms and records the departure itself. Items are independent: pharmacy,
 * transport and the rest can all be worked on at once, and the list keeps the order they were
 * recorded in.
 *
 * Chosen from fixed lists, never typed, so the record carries no free text (D-72).
 */
export const DISCHARGE_DEPENDENCY_KINDS = [
  "pharmacy",
  "transport",
  "destination",
  "community_follow_up",
  "other",
] as const;
export type DischargeDependencyKind = (typeof DISCHARGE_DEPENDENCY_KINDS)[number];

export const DISCHARGE_DEPENDENCY_KIND_LABELS: Record<DischargeDependencyKind, string> = {
  pharmacy: "Discharge medicines",
  transport: "Transport",
  destination: "Destination or accommodation confirmed",
  community_follow_up: "Community follow-up booked",
  other: "Other arrangement",
};

/** The team or service that owns an item. `ward` is the ward team, open around the clock. */
export const DISCHARGE_DEPENDENCY_OWNERS = [
  "ward",
  "pharmacy",
  "patient_transport",
  "social_work",
  "community_team",
] as const;
export type DischargeDependencyOwner = (typeof DISCHARGE_DEPENDENCY_OWNERS)[number];

export const DISCHARGE_DEPENDENCY_OWNER_LABELS: Record<DischargeDependencyOwner, string> = {
  ward: "Ward team",
  pharmacy: "Pharmacy",
  patient_transport: "Patient transport",
  social_work: "Social work",
  community_team: "Community mental health team",
};

/** The owner offered first for each kind. The person recording can choose another. */
export const DEFAULT_DEPENDENCY_OWNER: Record<DischargeDependencyKind, DischargeDependencyOwner> = {
  pharmacy: "pharmacy",
  transport: "patient_transport",
  destination: "social_work",
  community_follow_up: "community_team",
  other: "ward",
};

export const DISCHARGE_DEPENDENCY_STATES = ["outstanding", "done", "not_needed"] as const;
export type DischargeDependencyState = (typeof DISCHARGE_DEPENDENCY_STATES)[number];

export const DISCHARGE_DEPENDENCY_STATE_LABELS: Record<DischargeDependencyState, string> = {
  outstanding: "Outstanding",
  done: "Done",
  not_needed: "Not needed",
};

/** One item, as last recorded. `by` is a role or ward label, never a person's name. */
export type DischargeDependency = {
  readonly kind: DischargeDependencyKind;
  readonly owner: DischargeDependencyOwner;
  readonly state: DischargeDependencyState;
  readonly at: Instant;
  readonly by: string;
};

/** Where the ward has recorded the person is planned to go. Chosen from `LEAVING_DESTINATIONS`. */
export type PlannedDischargeDestination = {
  readonly leavingDestination: LeavingDestination;
  readonly at: Instant;
  readonly by: string;
};

/**
 * A change to a fact an earlier confirmation relied on, oldest first. Kept so a screen can say
 * exactly what changed (old to new, when, by whom). Appended, never edited.
 */
export type DischargePlanChange =
  | {
      readonly fact: "expected_date";
      readonly previousExpectedAt: Instant;
      readonly expectedAt: Instant;
      readonly at: Instant;
      readonly by: string;
    }
  | {
      readonly fact: "destination";
      readonly previousLeavingDestination: LeavingDestination;
      readonly leavingDestination: LeavingDestination;
      readonly at: Instant;
      readonly by: string;
    };
type DischargePlanFact = DischargePlanChange["fact"];

/**
 * Which facts each kind of confirmation relied on. A change to one of these after the item was
 * marked done means the item needs checking again. "Other" names nothing, because we cannot know
 * what it relied on.
 */
const FACTS_RELIED_ON: Record<DischargeDependencyKind, readonly DischargePlanFact[]> = {
  pharmacy: ["expected_date"],
  transport: ["expected_date", "destination"],
  destination: ["destination"],
  community_follow_up: ["expected_date", "destination"],
  other: [],
};

/** The release fields this file reads. A structural type, so `BedRelease` fits without an import. */
export type DischargeLogisticsRecord = {
  readonly blocker: string | null;
  readonly dependencies?: ReadonlyArray<DischargeDependency>;
  readonly plannedDestination?: PlannedDischargeDestination;
  readonly planChanges?: ReadonlyArray<DischargePlanChange>;
};

/**
 * The changes recorded after an item was marked done that touch a fact it relied on. Empty when
 * the item is not done, or nothing it relied on has changed since. Reconfirming the item (recording
 * it as done again) moves its time past the change, so the flag clears. Nothing is cancelled.
 */
export function changesSinceConfirmed(
  record: DischargeLogisticsRecord,
  dependency: DischargeDependency,
): DischargePlanChange[] {
  if (dependency.state !== "done") return [];
  const relied = FACTS_RELIED_ON[dependency.kind];
  return (record.planChanges ?? []).filter((change) => change.at > dependency.at && relied.includes(change.fact));
}

export type DependencySummary = {
  readonly outstanding: number;
  readonly done: number;
  readonly notNeeded: number;
  readonly needsChecking: number;
};

/** Counts over the recorded items. The single `blocker` is not counted here: it is shown beside them. */
export function dependencySummary(record: DischargeLogisticsRecord): DependencySummary {
  const list = record.dependencies ?? [];
  return {
    outstanding: list.filter((item) => item.state === "outstanding").length,
    done: list.filter((item) => item.state === "done").length,
    notNeeded: list.filter((item) => item.state === "not_needed").length,
    needsChecking: list.filter((item) => changesSinceConfirmed(record, item).length > 0).length,
  };
}

/** The recorded items still outstanding, in recorded order. */
export function outstandingDependencies(record: DischargeLogisticsRecord): DischargeDependency[] {
  return (record.dependencies ?? []).filter((item) => item.state === "outstanding");
}

/** The optional discharge logistics fields on a `BedRelease` (closing-the-loop package B). */
export type DischargeLogisticsFields = {
  /** Practical items this discharge waits on, recorded order. Logistics only; gates nothing. */
  dependencies?: ReadonlyArray<DischargeDependency>;
  /** Where the ward has recorded the person is planned to go. Absent until recorded. */
  plannedDestination?: PlannedDischargeDestination;
  /** Changes to the expected time or destination, oldest first, for "needs checking again". */
  planChanges?: ReadonlyArray<DischargePlanChange>;
};

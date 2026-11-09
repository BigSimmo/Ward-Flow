import type { Instant } from "./ward-clock";
import { WARD_FLOW_ROLE_LABELS, type WardFlowRole } from "./ward-flow-roles";
import type { DischargeDependency } from "./discharges/discharge-dependencies";

/**
 * The discharge checklist (feature 37, 9 Nov 2026) and the community team's reply to a follow-up
 * request (feature 13). Both are chosen, never typed.
 *
 * ⚠️ **ADVISORY ONLY.** Nothing here blocks a discharge. Recording a departure with items still
 * outstanding shows a warning that lists them and records the departure anyway. Criteria led
 * discharge (`ward-discharge-criteria.ts`) is separate and unchanged.
 */
export const DISCHARGE_CHECK_ITEMS = ["community_follow_up", "medicines", "carer_told", "gp_letter"] as const;
export type DischargeCheckItem = (typeof DISCHARGE_CHECK_ITEMS)[number];

export const DISCHARGE_CHECK_LABELS: Record<DischargeCheckItem, string> = {
  community_follow_up: "Community follow-up booked",
  medicines: "Discharge medicines supplied",
  carer_told: "Carer or family told",
  gp_letter: "GP letter sent",
};

export const DISCHARGE_CHECK_STATES = ["done", "not_needed", "outstanding"] as const;
export type DischargeCheckState = (typeof DISCHARGE_CHECK_STATES)[number];

export const DISCHARGE_CHECK_STATE_LABELS: Record<DischargeCheckState, string> = {
  done: "Done",
  not_needed: "Not needed",
  outstanding: "Outstanding",
};

/** One ticked item: its state, when, and the role that ticked it (never a name). */
export type DischargeCheckRecord = {
  readonly state: DischargeCheckState;
  readonly at: Instant;
  readonly by: WardFlowRole;
};
export type DischargeChecks = Partial<Record<DischargeCheckItem, DischargeCheckRecord>>;

export const FOLLOW_UP_REPLIES = ["awaiting", "accepted", "declined"] as const;
export type FollowUpReplyState = (typeof FOLLOW_UP_REPLIES)[number];
export const FOLLOW_UP_REPLY_LABELS: Record<FollowUpReplyState, string> = {
  awaiting: "Awaiting reply",
  accepted: "Accepted",
  declined: "Declined",
};

export const FOLLOW_UP_DECLINE_REASONS = [
  "Outside catchment",
  "Referred to another service",
  "GP follow-up instead",
  "Patient declined",
] as const;
export type FollowUpDeclineReason = (typeof FOLLOW_UP_DECLINE_REASONS)[number];

/**
 * The community team's answer to following this person up after discharge. Recorded by the team
 * (`RECORD_FOLLOW_UP_REPLY`), never by the ward, and never inferred from anything else.
 */
export type FollowUpReply = {
  readonly state: FollowUpReplyState;
  /** Only with `declined`, from `FOLLOW_UP_DECLINE_REASONS`. */
  readonly reason?: FollowUpDeclineReason;
  readonly at: Instant;
  readonly by: WardFlowRole;
};

const member = (list: readonly string[], value: unknown) => typeof value === "string" && list.includes(value);
const keysWithin = (value: object, keys: readonly string[]) => Object.keys(value).every((key) => keys.includes(key));
const isRole = (value: unknown) => typeof value === "string" && Object.hasOwn(WARD_FLOW_ROLE_LABELS, value);

export function isDischargeCheckItem(value: unknown): value is DischargeCheckItem {
  return member(DISCHARGE_CHECK_ITEMS, value);
}
export function isDischargeCheckState(value: unknown): value is DischargeCheckState {
  return member(DISCHARGE_CHECK_STATES, value);
}
export function isFollowUpReplyState(value: unknown): value is FollowUpReplyState {
  return member(FOLLOW_UP_REPLIES, value);
}
export function isFollowUpDeclineReason(value: unknown): value is FollowUpDeclineReason {
  return member(FOLLOW_UP_DECLINE_REASONS, value);
}

/** A stored checklist is listed items, each a listed state, a finite time and a known role. */
export function isDischargeChecks(value: unknown): value is DischargeChecks {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([item, record]) =>
      isDischargeCheckItem(item) &&
      !!record &&
      typeof record === "object" &&
      !Array.isArray(record) &&
      keysWithin(record, ["state", "at", "by"]) &&
      isDischargeCheckState((record as DischargeCheckRecord).state) &&
      Number.isFinite((record as DischargeCheckRecord).at) &&
      isRole((record as DischargeCheckRecord).by),
  );
}

/** A stored reply is a listed state, a listed reason only when declined, a finite time and a known role. */
export function isFollowUpReply(value: unknown): value is FollowUpReply {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const reply = value as Partial<FollowUpReply>;
  return (
    keysWithin(value, ["state", "reason", "at", "by"]) &&
    isFollowUpReplyState(reply.state) &&
    (reply.state === "declined" ? isFollowUpDeclineReason(reply.reason) : reply.reason === undefined) &&
    Number.isFinite(reply.at) &&
    isRole(reply.by)
  );
}

/** The reply in words: "Accepted", "Declined: Outside catchment", "Awaiting reply". */
export function followUpReplyWords(reply: FollowUpReply | undefined): string | null {
  if (!reply) return null;
  return reply.state === "declined" && reply.reason
    ? `${FOLLOW_UP_REPLY_LABELS.declined}: ${reply.reason}`
    : FOLLOW_UP_REPLY_LABELS[reply.state];
}

export type DischargeChecklistRow = {
  readonly item: DischargeCheckItem;
  readonly label: string;
  readonly state: DischargeCheckState;
  /** Where the state came from: ticked on this checklist, or read from another record. */
  readonly source: "ticked" | "discharge_list" | "follow_up" | "none";
  /** One short line: who said so, or the community team's reply on the follow-up item. */
  readonly detail: string;
};

/** The fields this checklist reads. Structural, so an `Admission` or a `DischargeRecord` fits. */
export type DischargeChecklistInput = {
  readonly dischargeChecks?: DischargeChecks;
  readonly followUp?: { readonly state: "arranged" | "not_arranged" } | null;
  readonly followUpReply?: FollowUpReply;
  /** The bed release's discharge dependencies, where the release is known. */
  readonly dependencies?: readonly DischargeDependency[];
};

/** Which discharge dependency an item overlaps, so a fact recorded there is not asked twice. */
const DEPENDENCY_FOR: Partial<Record<DischargeCheckItem, DischargeDependency["kind"]>> = {
  community_follow_up: "community_follow_up",
  medicines: "pharmacy",
};

/**
 * The four items, each with its state. A ticked item wins. Otherwise the follow-up and medicines
 * items show what the discharge dependency list or the follow-up record already says, so the ward
 * is not asked twice; anything else is outstanding.
 */
export function dischargeChecklist(input: DischargeChecklistInput): DischargeChecklistRow[] {
  const reply = followUpReplyWords(input.followUpReply);
  return DISCHARGE_CHECK_ITEMS.map((item) => {
    const label = DISCHARGE_CHECK_LABELS[item];
    const replyLine = item === "community_follow_up" && reply ? `Team reply: ${reply}` : null;
    const ticked = input.dischargeChecks?.[item];
    if (ticked) {
      const who = `${DISCHARGE_CHECK_STATE_LABELS[ticked.state]} · ${WARD_FLOW_ROLE_LABELS[ticked.by]}`;
      return { item, label, state: ticked.state, source: "ticked", detail: replyLine ?? who };
    }
    const kind = DEPENDENCY_FOR[item];
    const dependency = kind ? input.dependencies?.find((candidate) => candidate.kind === kind) : undefined;
    if (dependency && dependency.state !== "outstanding") {
      return {
        item,
        label,
        state: dependency.state,
        source: "discharge_list",
        detail: replyLine ?? `${DISCHARGE_CHECK_STATE_LABELS[dependency.state]} on the discharge list`,
      };
    }
    if (item === "community_follow_up" && input.followUp?.state === "arranged") {
      return { item, label, state: "done", source: "follow_up", detail: replyLine ?? "Follow-up arranged" };
    }
    return { item, label, state: "outstanding", source: "none", detail: replyLine ?? "Not recorded" };
  });
}

/** Settled items (done or not needed) out of the four, for the "2 of 4" tag. */
export function dischargeChecklistTally(rows: readonly DischargeChecklistRow[]): { settled: number; total: number } {
  return { settled: rows.filter((row) => row.state !== "outstanding").length, total: rows.length };
}

/** The items still outstanding, in words, for the warning at discharge. Empty when all settled. */
export function outstandingDischargeChecks(rows: readonly DischargeChecklistRow[]): string[] {
  return rows.filter((row) => row.state === "outstanding").map((row) => row.label);
}

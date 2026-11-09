/**
 * SHIFT DIGEST (feature 15, Josh, 9 Nov 2026). A short read at shift change: what changed this
 * shift, what is still pending and which ward promises fall due by handover. It reads the same
 * figures the Handover hero shows (one source of truth), so the two never disagree:
 *
 * - What changed: the hero's "Since 07:00" items, plus escalations made in the window read from
 *   recorded times (`changesSinceInstant`, the same reading Home uses before a first look).
 * - Still pending: the hero's counts, its bed line, its longest wait and its "ward replies due"
 *   strip (`openPromiseCounts`, network-wide as the strip is).
 * - Promises due by handover: open ward promises or callbacks due by the handover cutoff, earliest
 *   chase first (`promiseChaseTimes`, the card's own order), at most five.
 *
 * Privacy: the digest holds no patient names or record numbers. Lines carry ward names, counts and
 * times, plus record ids only for in-app links; `handoverDigestText` drops the ids, so the copied
 * text is safe to paste into a message.
 */
import { changesSinceInstant } from "@/components/ward-management/coordinator/since-last-look";
import { commitmentsDueBy } from "@/components/ward-management/referrals/referral-commitments-model";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import { openStaffRequests, type StaffRequestRecord } from "@/components/ward-management/staffing/staff-requests";
import { durMinutes } from "@/components/wf/format";

import { openPromiseCounts, promiseChaseTimes } from "./handover-open-promises";
import type { HandoverPill } from "./handover-model";

/** Where a digest line takes the reader. Ids stay in the app; the copied text never carries them. */
export type HandoverDigestAction =
  { kind: "pill"; pill: HandoverPill } | { kind: "replies" } | { kind: "patient"; movementId: string };

export type HandoverDigestLine = {
  id: string;
  /** The figure shown in mono; null for a line whose figure is in its text (a wait, a time). */
  value: number | null;
  text: string;
  detail?: string;
  tone?: "danger" | "warning" | "neutral";
  action?: HandoverDigestAction;
};

type HandoverDigestPromise = {
  id: string;
  /** "09:00", or the promised time when overdue. */
  when: string;
  overdue: boolean;
  /** Ward name and what it said, no patient. */
  what: string;
  /** For the in-app link only; never copied. */
  referralId: string;
};

export type HandoverDigest = {
  shiftLabel: string;
  shiftClock: string;
  scopeLabel: string;
  sinceClock: string;
  dueClock: string;
  changed: HandoverDigestLine[];
  pending: HandoverDigestLine[];
  promises: HandoverDigestPromise[];
  /** Promises past the shown five. */
  promisesMore: number;
  /** Open staff requests for the scope's wards (feature 10); no line when none is open. */
  staffRequests?: number;
};

/** The hero's since items, as the page builds them (`sinceItems` in `handover-page.tsx`). */
type DigestSinceItem = { id: string; value: number; word: string; detail?: unknown };

export type HandoverDigestInput = {
  now: Instant;
  shiftLabel: string;
  shiftAt: Instant;
  /** The "Due by" cutoff the hero uses. */
  cutoff: Instant;
  sinceAt: Instant;
  scopeLabel: string;
  sinceItems: readonly DigestSinceItem[];
  /** In-scope open movements (the hero's rows), for escalations made this shift. */
  scopedMovements: readonly Movement[];
  /** The hero's counts. */
  counts: { act: number; urg: number; due: number; bed: number };
  /** The hero's bed line; null where the hero shows none (a ward or ED desk). */
  beds: { ready: number; needed: number } | null;
  /** The hero's longest wait row. */
  longest: { movementId: string; openedAt: Instant; place: string } | null;
  referrals: readonly Referral[];
  units: readonly Unit[];
  admissions?: readonly Admission[];
  /** Staff requests on record (feature 10), counted while open for `wardIds` (the hero's wards). */
  staffRequestRecords?: readonly StaffRequestRecord[];
  wardIds?: readonly string[];
  /** A precomputed count, used when no records are passed. */
  staffRequests?: number;
};

const PROMISES_SHOWN = 5;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function buildHandoverDigest(input: HandoverDigestInput): HandoverDigest {
  const { now } = input;
  const at = (instant: Instant) => formatInstantWithDay(instant, now);
  const wardName = (unitId: string) => input.units.find((unit) => unit.id === unitId)?.name ?? "Ward not recorded";

  /* What changed: the hero's since items, never their record-number detail. */
  const changed: HandoverDigestLine[] = [];
  for (const item of input.sinceItems) {
    if (item.value <= 0) continue;
    const wardDetail =
      (item.id === "admitted" || item.id === "discharged") && typeof item.detail === "string" ? item.detail : undefined;
    const action: HandoverDigestAction | undefined =
      item.id === "opened"
        ? { kind: "pill", pill: "new" }
        : item.id === "act"
          ? { kind: "pill", pill: "act" }
          : undefined;
    changed.push({
      id: item.id,
      value: item.value,
      text: item.word,
      detail: wardDetail,
      tone: item.id === "act" ? "danger" : undefined,
      action,
    });
  }
  const escalations = changesSinceInstant(
    { referrals: [], movements: input.scopedMovements, admissions: input.admissions },
    input.sinceAt,
    now,
  ).newEscalationIds.length;
  if (escalations > 0)
    changed.push({ id: "escalated", value: escalations, text: plural(escalations, "escalation", "escalations") });

  /* Still pending: the hero's figures. */
  const pending: HandoverDigestLine[] = [];
  const { counts } = input;
  if (counts.act > 0)
    pending.push({
      id: "act",
      value: counts.act,
      text: "act now",
      tone: "danger",
      action: { kind: "pill", pill: "act" },
    });
  if (counts.urg > 0)
    pending.push({
      id: "urg",
      value: counts.urg,
      text: "flagged urgent",
      tone: "danger",
      action: { kind: "pill", pill: "urg" },
    });
  if (counts.due > 0)
    pending.push({
      id: "due",
      value: counts.due,
      text: `due by ${at(input.cutoff)}`,
      tone: "warning",
      action: { kind: "pill", pill: "due" },
    });
  if (counts.bed > 0)
    pending.push({
      id: "bed",
      value: counts.bed,
      text: "finding a ward",
      detail: input.beds ? `${input.beds.ready} ${plural(input.beds.ready, "bed", "beds")} ready` : undefined,
      action: { kind: "pill", pill: "bed" },
    });
  const staffRequests = input.staffRequestRecords
    ? openStaffRequests({ staffRequests: input.staffRequestRecords }, now).filter(
        (record) => input.wardIds === undefined || input.wardIds.includes(record.unitId),
      ).length
    : input.staffRequests;
  const replies = openPromiseCounts(input.referrals, now);
  if (replies.total > 0)
    pending.push({
      id: "replies",
      value: replies.total,
      text: `ward ${plural(replies.total, "reply", "replies")} due`,
      detail: replies.overdue > 0 ? `${replies.overdue} overdue` : undefined,
      tone: replies.overdue > 0 ? "danger" : undefined,
      action: { kind: "replies" },
    });
  if (staffRequests !== undefined && staffRequests > 0)
    pending.push({
      id: "staff",
      value: staffRequests,
      text: `staff ${plural(staffRequests, "request", "requests")} open`,
    });
  if (input.longest)
    pending.push({
      id: "longest",
      value: null,
      text: `Longest wait ${durMinutes(now - input.longest.openedAt)}`,
      detail: input.longest.place,
      action: { kind: "patient", movementId: input.longest.movementId },
    });

  /* Promises due by handover, earliest chase first. */
  const due = commitmentsDueBy(input.referrals, input.cutoff)
    .map((item) => {
      const status = item.status;
      const { overdue, promised, sortAt, shownAt } = promiseChaseTimes(status, now);
      const ward = wardName(item.unitId);
      const what =
        promised !== undefined
          ? `${ward} promised an answer by ${at(promised)}`
          : status.step?.step === "acknowledged"
            ? `${ward} acknowledged, no time promised`
            : `Waiting for ${ward} to respond`;
      return {
        id: `${item.referral.id}-${item.unitId}`,
        when: at(shownAt),
        overdue,
        what,
        sortAt,
        referralId: item.referral.id,
      };
    })
    .sort((left, right) => left.sortAt - right.sortAt);

  return {
    shiftLabel: input.shiftLabel,
    shiftClock: at(input.shiftAt),
    scopeLabel: input.scopeLabel,
    sinceClock: at(input.sinceAt),
    dueClock: at(input.cutoff),
    changed,
    pending,
    promises: due
      .slice(0, PROMISES_SHOWN)
      .map(({ id, when, overdue, what, referralId }) => ({ id, when, overdue, what, referralId })),
    promisesMore: Math.max(0, due.length - PROMISES_SHOWN),
    staffRequests,
  };
}

function lineText(line: HandoverDigestLine): string {
  const head = line.value === null ? line.text : `${line.value} ${line.text}`;
  return line.detail ? `${head} (${line.detail})` : head;
}

/**
 * The digest as plain text to paste into a message: counts, ward names and times only. No patient
 * names, record numbers or record ids (the longest wait names its place, not the person).
 */
export function handoverDigestText(digest: HandoverDigest): string {
  const list = (lines: readonly string[]) => (lines.length ? lines.map((line) => `- ${line}`) : ["- None"]);
  return [
    `Shift digest: ${digest.shiftLabel}, ${digest.shiftClock} (${digest.scopeLabel})`,
    "Synthetic demonstration · Not approved for clinical use",
    "",
    `What changed since ${digest.sinceClock}`,
    ...list(digest.changed.map(lineText)),
    "",
    "Still pending",
    ...list(digest.pending.map(lineText)),
    "",
    `Promises due by ${digest.dueClock}`,
    ...list([
      ...digest.promises.map((promise) =>
        promise.overdue ? `Overdue: ${promise.what}` : `${promise.when}: ${promise.what}`,
      ),
      ...(digest.promisesMore > 0 ? [`and ${digest.promisesMore} more`] : []),
    ]),
  ].join("\n");
}

import type { Instant } from "../ward-clock";
import type { WardFlowRole } from "../ward-flow-roles";

/**
 * BED MEETING ACTION LOG (smart features idea 5, 19 Oct 2026). The chair records what the meeting
 * agreed against a person already on the board: an action chosen from this list, the role that owns
 * it and when it is due. The next meeting opens with what was done and what is overdue.
 *
 * Actions are tasks for people, never automatic changes: recording or completing one moves nothing
 * else, and an overdue action is shown, never escalated. Nothing typed is stored with an action.
 *
 * The reducer reads this file, so it must not import the derivations.
 */
export const BED_MEETING_ACTION_KINDS = [
  { id: "chase_ndis", label: "Chase NDIS" },
  { id: "call_guardianship", label: "Call guardianship" },
  { id: "book_transport", label: "Book transport" },
  { id: "review_step_down", label: "Review for step-down" },
] as const;

export type BedMeetingActionKind = (typeof BED_MEETING_ACTION_KINDS)[number]["id"];

export const BED_MEETING_ACTION_KIND_IDS: readonly string[] = BED_MEETING_ACTION_KINDS.map((kind) => kind.id);

/** Who can be named as owner. A ward owner also names the ward. */
export const BED_MEETING_ACTION_OWNERS = [
  "coordinator",
  "ward",
  "ed",
  "community",
] as const satisfies readonly WardFlowRole[];

export type BedMeetingActionOwner = (typeof BED_MEETING_ACTION_OWNERS)[number];

/** The agenda page. Not in the access table, so it opens for the coordinator only. */
export const BED_MEETING_AGENDA_HREF = "/ward-flow/bed-meeting/agenda";

/** Due choices, in hours from the meeting. */
export const BED_MEETING_ACTION_DUE_HOURS = [2, 4, 8, 24] as const;

/** One agreed action, kept on the bed request (`Movement`) or the stay (`Admission`) it is about. */
export type BedMeetingAction = {
  kind: BedMeetingActionKind;
  owner: BedMeetingActionOwner;
  /** The owning ward when `owner` is `ward`. */
  ownerUnitId?: string;
  dueAt: Instant;
  recordedAt: Instant;
  doneAt?: Instant;
  /** The role label of whoever marked it done. */
  doneBy?: string;
};

export type BedMeetingSubject = { kind: "movement" | "admission"; id: string };

export function bedMeetingActionLabel(kind: BedMeetingActionKind): string {
  return BED_MEETING_ACTION_KINDS.find((entry) => entry.id === kind)?.label ?? kind;
}

/** The open action of this kind, if one is still to do. One open action per kind per person. */
export function openMeetingAction(
  actions: readonly BedMeetingAction[] | undefined,
  kind: BedMeetingActionKind,
): BedMeetingAction | undefined {
  return actions?.find((action) => action.kind === kind && action.doneAt === undefined);
}

/**
 * THE OWNER'S "NEEDS YOU" ROW FOR AN OPEN ACTION (overall review, 20 Oct 2026). One row per open
 * action, `meeting-action-<kind>-<movement|admission>-<record id>`, so the reducer can tell which
 * action a snooze or "take" names without reading the derivations. Kind ids hold no hyphen.
 */
export const BED_MEETING_ACTION_INBOX_PREFIX = "meeting-action-";

export function meetingActionInboxId(subject: BedMeetingSubject, kind: BedMeetingActionKind): string {
  return `${BED_MEETING_ACTION_INBOX_PREFIX}${kind}-${subject.kind}-${subject.id}`;
}

/** The subject and kind a row id names, or `undefined` when it is not a well-formed action row id. */
export function meetingActionOfInboxId(
  inboxItemId: string,
): { subject: BedMeetingSubject; kind: BedMeetingActionKind } | undefined {
  if (!inboxItemId.startsWith(BED_MEETING_ACTION_INBOX_PREFIX)) return undefined;
  const match = /^([a-z_]+)-(movement|admission)-(.+)$/.exec(inboxItemId.slice(BED_MEETING_ACTION_INBOX_PREFIX.length));
  if (!match || !BED_MEETING_ACTION_KIND_IDS.includes(match[1]!)) return undefined;
  return {
    kind: match[1] as BedMeetingActionKind,
    subject: { kind: match[2] as BedMeetingSubject["kind"], id: match[3]! },
  };
}

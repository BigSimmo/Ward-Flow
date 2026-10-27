/**
 * ACT-NOW ITEMS AND TASKS — the one definition of "a row on the coordinator's active list".
 *
 * Pure: no React, no browser API. The open-tab notifier (`shell/ward-act-now-notifier.tsx`) and the
 * shared backend's phone push (`backend/ward-flow/engine.ts`) both read this, so a phone is never
 * told about a different set of alerts than the screen shows. Snoozed rows are off the active
 * list; one that returns after its snooze counts as new.
 *
 * L1 (site review, 12 Oct 2026): the header's Tasks badge counted 11, Alerts "Now" 8 (it dropped
 * the arrival and discharge notification rows) and Home Exceptions counted snoozed rows and missed
 * the decision targets. Every one of those now reads `taskItems` / `activeTaskItems` from here, and
 * act now is the red subset of the same active list, so the figures cannot drift apart again.
 * `tests/ward-shared-figures.test.ts` pins that they agree on the seed.
 */
import { CircleAlert, ClipboardList } from "lucide-react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import {
  BED_MEETING_AGENDA_HREF,
  bedMeetingActionLabel,
  meetingActionInboxId,
  type BedMeetingAction,
  type BedMeetingSubject,
} from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { referralBoardHref } from "@/components/ward-management/ed/ed-bed-search-step";
import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import { absenceInboxItems } from "@/components/ward-management/ward-absence-tasks";
import { decisionTargetInboxItems } from "@/components/ward-management/ward-decision-targets";
import { duplicateBedRequests } from "@/components/ward-management/ward-duplicate-bed-requests";
import {
  buildActionInbox,
  isOpen,
  type ActionInboxRecords,
  type InboxItem,
} from "@/components/ward-management/ward-derivations";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { INBOX_CATEGORIES } from "@/components/ward-management/ward-inbox-reducer";
import { partitionSnoozed } from "@/components/ward-management/ward-inbox-snooze";
import { rememberLastCall } from "@/components/ward-management/ward-last-call";

/**
 * What the task list reads. The records (admissions, patients, referrals, notifications, planned
 * admissions) are optional so a caller holding only the core state still gets the movement rows;
 * pass them to get the notification and planned-arrival rows too.
 */
export type TaskSource = Pick<WardFlowState, "movements" | "units" | "configuration" | "inboxSnoozes"> &
  Omit<ActionInboxRecords, "movements"> & {
    /** Audit A3-1: leave beds, for the act-now row when a person on an order is absent. */
    leaveBeds?: readonly WardFlowState["leaveBeds"][number][];
  };

/**
 * Every task row at `now`, snoozed ones included: the inbox rows plus the decision targets.
 *
 * The header badge, the phone menu, the act-now notifier and Home each build this list, so the last
 * answer is shared until a record or the clock minute changes (`ward-last-call.ts`). Callers must
 * not change the returned list in place. They pass different optional records (the notifier leaves
 * out the warning-only ones), so four answers are kept: one per caller shape, not one shared slot
 * that each caller evicts in turn (production audit PERF-02).
 */
export const taskItems = rememberLastCall(
  deriveTaskItems,
  (source: TaskSource, now: Instant) => [
    source.movements,
    source.units,
    source.configuration,
    source.admissions,
    source.patients,
    source.referrals,
    source.supportNotifications,
    source.plannedAdmissions,
    source.leaveBeds,
    source.stuckHandoverMinutes,
    now,
  ],
  4,
);

function deriveTaskItems(source: TaskSource, now: Instant): InboxItem[] {
  const open = source.movements.filter(isOpen);
  return [
    // Audit A3-1: absent without leave on an order sits first; it is the most urgent row there is.
    ...absenceInboxItems(source, now),
    ...buildActionInbox(open, now, source.units, {
      movements: source.movements,
      admissions: source.admissions,
      patients: source.patients,
      referrals: source.referrals,
      supportNotifications: source.supportNotifications,
      plannedAdmissions: source.plannedAdmissions,
      stuckHandoverMinutes: source.stuckHandoverMinutes,
    }),
    ...decisionTargetInboxItems(open, now, source.configuration),
    ...duplicateBedRequestInboxItems(source),
    ...bedMeetingActionInboxItems(source, now),
  ];
}

/**
 * One bed request's record, as the facade's `movementHref` writes it. Written here because the
 * facade imports this file (the same reason `ward-patient-href.ts` exists).
 */
function duplicateMovementHref(movementId: string): string {
  return `/ward-flow/movements/${encodeURIComponent(encodeRecordAddress(movementId))}`;
}

/** The bed coordinator's own owner words: `inboxOwnerRoles` places them on the coordinator alone. */
const DUPLICATE_OWNER = "Bed coordinator";

/**
 * Audit F-19: one amber row per person with more than one active bed request
 * (`ward-duplicate-bed-requests.ts`). Coordinator only: the coordinator may see every referral
 * (FD-23), so naming the requests here tells them nothing a ward screen could not already.
 */
export function duplicateBedRequestInboxItems(
  source: Pick<TaskSource, "movements" | "referrals" | "patients">,
): InboxItem[] {
  const records = { movements: source.movements, referrals: source.referrals ?? [], patients: source.patients ?? [] };
  return duplicateBedRequests(records).map(({ personId, requests, since }) => {
    const ids = requests.map((request) => request.id);
    const named = ids.length === 2 ? ids.join(" and ") : `${ids.slice(0, -1).join(", ")} and ${ids.at(-1)}`;
    // A bed request may already hold a bed, so the wording says "open", never "waiting for an answer".
    const open = ids.length === 2 ? "are both still open" : "are all still open";
    const oldest = requests[0]!;
    return {
      id: `${INBOX_CATEGORIES.duplicate_bed_request.idPrefix}${personId}`,
      kind: INBOX_CATEGORIES.duplicate_bed_request.kind,
      tone: "warning",
      icon: CircleAlert,
      title: "More than one active bed request",
      detail: `${named} ${open}. Check each is still needed.`,
      owner: DUPLICATE_OWNER,
      movementId: "",
      personId,
      // Every list opens the oldest request itself: its bed request, or the referral on the Referrals
      // board. A bed request with no referral is not on that board. Alerts links the person too.
      href: oldest.kind === "movement" ? duplicateMovementHref(oldest.id) : referralBoardHref(oldest.id),
      since,
    };
  });
}

/** The owner words for each bed meeting owner, read back to roles by `inboxOwnerRoles`. */
const MEETING_OWNER_WORDS = {
  coordinator: "Bed coordinator",
  ed: "ED team",
  community: "Community team",
} as const;

/**
 * BED MEETING ACTIONS IN THE OWNER'S NEEDS YOU (overall review, 20 Oct 2026; smart features idea
 * 5): one amber row per action the meeting agreed and nobody has marked done yet, owned by the role
 * the chair named (a ward action by that ward's name). Overdue is said, never escalated: the row
 * stays amber and is never an act-now alert. The chair's rows open the agenda, where it is marked
 * done; everyone else's open the record it is about. Listed by due time, as the agenda lists them.
 */
export function bedMeetingActionInboxItems(
  source: Pick<TaskSource, "movements" | "units" | "admissions" | "patients" | "referrals">,
  now: Instant,
): InboxItem[] {
  const lookup = { patients: source.patients ?? [], referrals: source.referrals ?? [], movements: source.movements };
  const unitName = (unitId: string | undefined) => source.units.find((unit) => unit.id === unitId)?.name;
  const rows: { subject: BedMeetingSubject; action: BedMeetingAction; personId?: string }[] = [
    ...source.movements.flatMap((movement) =>
      (movement.meetingActions ?? []).map((action) => ({
        subject: { kind: "movement" as const, id: movement.id },
        action,
      })),
    ),
    ...(source.admissions ?? []).flatMap((admission) => {
      const actions = admission.meetingActions ?? [];
      // The person through the one resolver, only for a stay that has an action.
      const personId = actions.length > 0 ? resolveSubjectPatient(admission, lookup).patient?.id : undefined;
      return actions.map((action) => ({
        subject: { kind: "admission" as const, id: admission.id },
        action,
        ...(personId ? { personId } : {}),
      }));
    }),
  ];
  return rows
    .filter(({ action }) => action.doneAt === undefined)
    .sort((a, b) => a.action.dueAt - b.action.dueAt)
    .map(({ subject, action, personId }) => {
      const owner =
        action.owner === "ward" ? (unitName(action.ownerUnitId) ?? "Ward") : MEETING_OWNER_WORDS[action.owner];
      const due = formatInstantWithDay(action.dueAt, now);
      const href =
        action.owner === "coordinator"
          ? BED_MEETING_AGENDA_HREF
          : subject.kind === "movement"
            ? duplicateMovementHref(subject.id)
            : personId
              ? patientHref(personId)
              : undefined;
      return {
        id: meetingActionInboxId(subject, action.kind),
        kind: INBOX_CATEGORIES.bed_meeting_action.kind,
        tone: "warning" as const,
        icon: ClipboardList,
        title: `Bed meeting action: ${bedMeetingActionLabel(action.kind)}`,
        detail:
          action.dueAt < now ? `Agreed at the bed meeting. Was due ${due}.` : `Agreed at the bed meeting. Due ${due}.`,
        owner,
        movementId: subject.kind === "movement" ? subject.id : "",
        ...(personId ? { personId } : {}),
        ...(href ? { href } : {}),
        dueAt: action.dueAt,
        since: action.recordedAt,
      };
    });
}

/** The active (not snoozed) task rows at `now`: the header's Tasks badge and Home's Exceptions. */
export function activeTaskItems(source: TaskSource, now: Instant): InboxItem[] {
  return partitionSnoozed(taskItems(source, now), source.inboxSnoozes, now).active;
}

/** The active (not snoozed) act-now rows at `now`: the red subset of `activeTaskItems`. */
export function activeActNowItems(source: TaskSource, now: Instant): InboxItem[] {
  return activeTaskItems(source, now).filter((item) => item.tone === "danger");
}

/** Act-now rows in `current` that were not on the active list last time. */
export function newActNowItems(previousIds: ReadonlySet<string>, current: readonly InboxItem[]): InboxItem[] {
  return current.filter((item) => item.tone === "danger" && !previousIds.has(item.id));
}

/**
 * NEEDS YOU FOR THE SIGNED IN ROLE (Top 25 item 6). A task row's
 * `owner` is the words a person reads ("Sending team", "Nurse in charge", a ward's name), so this
 * names the roles those words mean. An owner it cannot place belongs to the coordinator only,
 * never guessed onto another role. "ED or ward" belongs to both.
 */
export function inboxOwnerRoles(owner: string, wardNames: readonly string[] = []): WardChromeRole[] {
  const roles = new Set<WardChromeRole>();
  if (/coordinator/i.test(owner)) roles.add("coordinator");
  // D-80: a "Bed manager" row is the site bed manager's own, which it can now act on.
  if (/bed manager/i.test(owner)) roles.add("bed_manager");
  if (/\bED\b|emergency|sending team/i.test(owner)) roles.add("ed");
  if (/ward|nurse in charge/i.test(owner) || wardNames.includes(owner)) roles.add("ward");
  if (/transport/i.test(owner)) roles.add("officer");
  if (/community/i.test(owner)) roles.add("community");
  return [...roles];
}

/** The task rows the role owns. The coordinator sees every row; the bed manager desk every row but duplicate bed requests. */
export function inboxItemsForRole(
  items: readonly InboxItem[],
  role: WardChromeRole,
  wardNames: readonly string[] = [],
): InboxItem[] {
  if (role === "coordinator") return [...items];
  // Audit F-19: duplicate bed request rows name other referrals, so they stay with the coordinator.
  if (role === "bed_manager")
    return items.filter((item) => !item.id.startsWith(INBOX_CATEGORIES.duplicate_bed_request.idPrefix));
  return items.filter((item) => inboxOwnerRoles(item.owner, wardNames).includes(role));
}

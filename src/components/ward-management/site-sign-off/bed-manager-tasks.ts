import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { unitInScope, type PlaceLookup, type WardAccess } from "@/components/ward-management/ward-role-access";

import {
  bedFigureUnconfirmed,
  siteBlockersNotReviewedToday,
  siteMeetingActionsOpenToday,
  siteUnansweredBedCalls,
  siteWards,
  type SiteMeetingAction,
} from "./site-handover-sign-off";

/**
 * THE SITE BED MANAGER'S OWN TASKS (Josh, 31 Oct 2026 14:08 UTC, question 61; D-80 "its own tasks").
 *
 * Its own site only, and each task carries the one action that does it, an action the bed manager
 * already holds in `EVENT_ROLE` (no new permission). Referral answers, placement and discharge stay
 * with the ward, so no task offers them. A pure function of the workspace and the desk's access: the
 * shared server already sends a site bed manager only its own site's records, and this keeps to the
 * site again, so a whole workspace passed in still yields only that site's tasks.
 */
export type BedManagerTaskKind =
  | "confirm_bed_numbers"
  | "reply_bed_call"
  | "review_discharge_blocker"
  | "bed_meeting_action"
  | "bed_release_ready"
  | "seclusion_room_status";

/** The one action each kind of task sends. Every one is a bed manager action in `EVENT_ROLE`. */
export const BED_MANAGER_TASK_ACTIONS = {
  confirm_bed_numbers: "CONFIRM_CAPACITY",
  reply_bed_call: "REPLY_BROADCAST_ALERT",
  // A review records the blocker again (or the screen clears it with CLEAR_STAY_DISCHARGE_BLOCKER).
  review_discharge_blocker: "RECORD_STAY_DISCHARGE_BLOCKER",
  bed_meeting_action: "COMPLETE_BED_MEETING_ACTION",
  bed_release_ready: "SET_BED_PREPARATION",
  seclusion_room_status: "SET_SECLUSION_ROOM_STATUS",
} as const satisfies Record<BedManagerTaskKind, WardFlowEvent["type"]>;

/** "Due now" (bed figures and the coordinator's bed calls) or "Today", as the mock-up groups them. */
type BedManagerTaskGroup = "due_now" | "today";

export type BedManagerTask = {
  /** Stable for the row: kind plus the record it is about. */
  id: string;
  kind: BedManagerTaskKind;
  action: (typeof BED_MANAGER_TASK_ACTIONS)[BedManagerTaskKind];
  group: BedManagerTaskGroup;
  /** The site ward the task is at; the action acts as this ward (`actingUnitId`). */
  unitId: string;
  /** When it is due, where the record says: a bed figure's stale time or an action's due time. */
  dueAt?: Instant;
  /** reply_bed_call: the bed call. */
  alertId?: string;
  /** review_discharge_blocker: the stay (the screen names the patient, surname first). */
  admissionId?: string;
  /** bed_meeting_action: the record and the action kind COMPLETE_BED_MEETING_ACTION names. */
  meetingAction?: Pick<SiteMeetingAction, "subject" | "kind">;
  /** bed_release_ready: the release whose bed is being made ready. */
  releaseId?: string;
};

const BED_MANAGER_ACTIONS: readonly string[] = Object.values(BED_MANAGER_TASK_ACTIONS);

/** Whether the site bed manager holds this action (`EVENT_ROLE`), checked for every task offered. */
export function bedManagerHoldsAction(action: string): boolean {
  return (
    (EVENT_ROLE[action as WardFlowEvent["type"]] as readonly string[] | undefined)?.includes("bed_manager") === true
  );
}

const GROUP_ORDER: Record<BedManagerTaskGroup, number> = { due_now: 0, today: 1 };

/**
 * The site bed manager's open tasks at its own site, "Due now" first, then by due time. Any other
 * login, or a bed manager not scoped to one site, gets none.
 */
export function bedManagerTasks(
  state: Pick<WardFlowState, "admissions" | "bedReleases" | "broadcastAlerts" | "movements" | "units">,
  access: WardAccess,
  places: PlaceLookup,
  now: Instant,
): BedManagerTask[] {
  if (access.role !== "bed_manager" || access.scope.kind !== "site") return [];
  const siteCode = access.scope.siteCode;
  const own = (unitId: string) => unitInScope(access.scope, unitId, places);
  const wards = siteWards(state.units, siteCode).filter((unit) => own(unit.id));
  const tasks: BedManagerTask[] = [];

  for (const unit of wards)
    if (bedFigureUnconfirmed(unit, now))
      tasks.push({
        id: `confirm-beds-${unit.id}`,
        kind: "confirm_bed_numbers",
        action: BED_MANAGER_TASK_ACTIONS.confirm_bed_numbers,
        group: "due_now",
        unitId: unit.id,
        dueAt: unit.allocatable.confirmedAt + unit.allocatable.staleAfterMinutes,
      });

  // One task per ward asked, because the reply is the ward's answer (REPLY_BROADCAST_ALERT names it).
  for (const call of siteUnansweredBedCalls(state, siteCode, now))
    for (const unitId of call.unitIds.filter(own))
      tasks.push({
        id: `bed-call-${call.alertId}-${unitId}`,
        kind: "reply_bed_call",
        action: BED_MANAGER_TASK_ACTIONS.reply_bed_call,
        group: "due_now",
        unitId,
        alertId: call.alertId,
      });

  for (const row of siteBlockersNotReviewedToday(state, siteCode, now))
    if (own(row.unitId))
      tasks.push({
        id: `blocker-${row.admissionId}`,
        kind: "review_discharge_blocker",
        action: BED_MANAGER_TASK_ACTIONS.review_discharge_blocker,
        group: "today",
        unitId: row.unitId,
        admissionId: row.admissionId,
      });

  // Only a site ward's own action: the bed manager completes it acting as that ward (D-80), and an
  // action owned by the coordinator, an ED or a team is theirs to mark done.
  for (const action of siteMeetingActionsOpenToday(state, siteCode, now))
    if (action.owner === "ward" && action.ownerUnitId !== undefined && own(action.ownerUnitId))
      tasks.push({
        id: `meeting-action-${action.subject.kind}-${action.subject.id}-${action.kind}`,
        kind: "bed_meeting_action",
        action: BED_MANAGER_TASK_ACTIONS.bed_meeting_action,
        group: "today",
        unitId: action.ownerUnitId,
        dueAt: action.dueAt,
        meetingAction: { subject: action.subject, kind: action.kind },
      });

  for (const release of state.bedReleases)
    if (release.preparing && own(release.unitId) && wards.some((unit) => unit.id === release.unitId))
      tasks.push({
        id: `bed-release-${release.id}`,
        kind: "bed_release_ready",
        action: BED_MANAGER_TASK_ACTIONS.bed_release_ready,
        group: "today",
        unitId: release.unitId,
        releaseId: release.id,
      });

  for (const unit of wards)
    if (unit.restrictivePractice?.seclusionRoom?.status === "out_of_service")
      tasks.push({
        id: `seclusion-room-${unit.id}`,
        kind: "seclusion_room_status",
        action: BED_MANAGER_TASK_ACTIONS.seclusion_room_status,
        group: "today",
        unitId: unit.id,
      });

  return tasks
    .filter((task) => BED_MANAGER_ACTIONS.includes(task.action) && bedManagerHoldsAction(task.action))
    .sort(
      (a, b) =>
        GROUP_ORDER[a.group] - GROUP_ORDER[b.group] ||
        (a.dueAt ?? Number.POSITIVE_INFINITY) - (b.dueAt ?? Number.POSITIVE_INFINITY),
    );
}

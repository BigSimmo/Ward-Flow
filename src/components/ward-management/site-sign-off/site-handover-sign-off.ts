import { MINUTES_PER_DAY, minuteOfDay, type Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { Unit } from "@/components/ward-management/ward-model";
import { SHIFT_PATTERN } from "@/components/ward-management/ward-operational-defaults";
import { broadcastKind, isAlertActive, latestReplies } from "@/components/ward-management/alerts/ward-broadcast-model";
import { wardsInBroadcastScope } from "@/components/ward-management/alerts/global-alert-view";

/**
 * SITE HANDOVER SIGN-OFF (Josh, 31 Oct 2026 14:08 UTC, questions 61 to 63; D-80 "handover sign-off").
 *
 * The site bed manager signs off its own site's shift handover. It never signs for a ward: each
 * ward's own sign-off (`handoverSignOffs`, decision 41) is read here and never written.
 *
 * - Q62: the site may sign while a ward is still unsigned. The record names the wards unsigned at
 *   that moment, and each stays flagged outstanding until it signs its own sheet.
 * - Q63: the four open checks are information, not a block. An unanswered coordinator bed call is
 *   named in the record and stays open on the coordinator's board until a ward or the bed manager
 *   answers it; signing never answers, closes or changes a bed call.
 *
 * The record holds a site code, the handover it belongs to, the time, the signing role and the
 * named ward and bed call ids, never a person or typed text. The reducer works out the named lists
 * from the whole workspace when it accepts the sign-off, so a browser cannot leave a ward out.
 *
 * The reducer slice (`site-handover-sign-off-reducer.ts`) reads this file, so it imports no screen code.
 */

/** One site handover sign-off. Role, time, site and the named ids only: no person, no note. */
export type SiteHandoverSignOffRecord = {
  at: Instant;
  by: WardFlowRole;
  /** The site signed for, as `Unit.siteCode`. */
  siteCode: string;
  /** The handover this sign-off is for: the start of the shift it hands over to. */
  shiftAt: Instant;
  /** Q62: the site's wards with no sign-off of their own for this handover when the site signed. */
  unsignedUnitIds: string[];
  /** Q63: the coordinator's live bed calls a site ward had not answered when the site signed. */
  unansweredBedCallIds: string[];
};

/** The two events: the sign-off and its Undo (the Undo is a step undo, `ward-undo.ts`). */
export type SiteHandoverSignOffEvent =
  | {
      /** Q61: the site bed manager signs off its own site's handover. Never a ward's. */
      type: "RECORD_SITE_HANDOVER_SIGN_OFF";
      role: WardFlowRole;
      now: Instant;
      /** The site signed for. The shared server refuses any site but the caller's own. */
      siteCode: string;
      /** The handover signed for: the start of a shift, no more than one shift after `now`. */
      shiftAt: Instant;
    }
  | {
      /** Takes back this site's newest sign-off, within the usual Undo window. */
      type: "UNDO_SITE_HANDOVER_SIGN_OFF";
      role: WardFlowRole;
      now: Instant;
      siteCode: string;
      /** The record number of the step this Undo is for; a newer step on the same site refuses it. */
      recordSeq?: number;
    };

/**
 * How long before a handover its sign-off window opens: the shift before it, one shift of the
 * pattern (eight hours). The same window as
 * `handoverSignedBefore` in `handover/handover-model.ts` (tested against it), kept here so the
 * reducer does not load the handover sheet's model.
 */
const SIGN_OFF_WINDOW_MINUTES = SHIFT_PATTERN[0].endMinute - SHIFT_PATTERN[0].startMinute;

const SHIFT_START_MINUTES: readonly number[] = SHIFT_PATTERN.map((shift) => shift.startMinute);

/** Whether `at` falls in the sign-off window of the handover at `shiftAt`. */
export function inSignOffWindow(at: Instant, shiftAt: Instant): boolean {
  return at >= shiftAt - SIGN_OFF_WINDOW_MINUTES && at < shiftAt;
}

/** Why `shiftAt` cannot be signed at `now`, or null: it must be a shift start still to come within one shift. */
export function siteShiftRefusal(shiftAt: unknown, now: Instant): string | null {
  if (typeof shiftAt !== "number" || !Number.isFinite(shiftAt) || !Number.isInteger(shiftAt))
    return "A site sign-off names the handover it is for";
  if (!SHIFT_START_MINUTES.includes(minuteOfDay(shiftAt))) return "A site sign-off is for a handover at a shift start";
  if (!inSignOffWindow(now, shiftAt)) return "Only the next handover can be signed off";
  return null;
}

/** The site's wards, in the workspace's own order. */
export function siteWards(units: readonly Unit[], siteCode: string): Unit[] {
  return units.filter((unit) => unit.siteCode === siteCode);
}

type WardSignOff = { at: Instant; by: WardFlowRole; unitId?: string };

/** One ward's own sign-off for this handover, read only: the latest in the window naming the ward. */
export type SiteWardSignOff = {
  unitId: string;
  signedAt: Instant | null;
  signedBy: WardFlowRole | null;
};

/** Each site ward's own sign-off for the handover at `shiftAt`. A sign-off naming no ward counts for none. */
export function siteWardSignOffs(
  units: readonly Unit[],
  signOffs: readonly WardSignOff[] | undefined,
  siteCode: string,
  shiftAt: Instant,
): SiteWardSignOff[] {
  return siteWards(units, siteCode).map((unit) => {
    let latest: WardSignOff | null = null;
    for (const record of signOffs ?? []) {
      if (record.unitId !== unit.id || !inSignOffWindow(record.at, shiftAt)) continue;
      if (latest === null || record.at >= latest.at) latest = record;
    }
    return { unitId: unit.id, signedAt: latest?.at ?? null, signedBy: latest?.by ?? null };
  });
}

/** The wards asked by a bed call: its named wards, or the wards its target covers. */
function bedCallWards(alert: WardFlowState["broadcastAlerts"][number], units: readonly Unit[]): string[] {
  return alert.targetUnitIds ?? wardsInBroadcastScope(units, alert.targetScope);
}

/** A live coordinator bed call, with the site wards it asked that have not answered. */
export type OpenBedCall = { alertId: string; unitIds: string[] };

/** Q63: the coordinator's live bed calls that one of the site's wards has not answered yet. */
export function siteUnansweredBedCalls(
  state: Pick<WardFlowState, "broadcastAlerts" | "units">,
  siteCode: string,
  now: Instant,
): OpenBedCall[] {
  const site = new Set(siteWards(state.units, siteCode).map((unit) => unit.id));
  const open: OpenBedCall[] = [];
  for (const alert of state.broadcastAlerts ?? []) {
    if (broadcastKind(alert) !== "bed_call" || alert.dispatchedByRole !== "coordinator") continue;
    if (!isAlertActive(alert, now)) continue;
    const answered = latestReplies(alert);
    const unitIds = bedCallWards(alert, state.units).filter((id) => site.has(id) && !answered.has(id));
    if (unitIds.length > 0) open.push({ alertId: alert.id, unitIds });
  }
  return open;
}

/** The start of the clock day holding `now`. */
function startOfDay(now: Instant): Instant {
  return now - minuteOfDay(now);
}

/** A bed figure is unconfirmed once it is older than its own stale limit (the handover sheet's rule). */
export function bedFigureUnconfirmed(unit: Unit, now: Instant): boolean {
  return now - unit.allocatable.confirmedAt > unit.allocatable.staleAfterMinutes;
}

/**
 * The stays on the site's wards whose discharge blocker nobody has reviewed today. A review is the
 * blocker recorded again (`RECORD_STAY_DISCHARGE_BLOCKER` or `BLOCK_BED_RELEASE`), which stamps the
 * bed release's `blockerRecordedAt`. Not `confirmedAt`: a stage report or bed preparation change
 * restates that without anyone looking at the blocker. A stay with no bed release, or a release
 * with no recorded review time, stays listed until its blocker is recorded again or cleared.
 */
export function siteBlockersNotReviewedToday(
  state: Pick<WardFlowState, "admissions" | "bedReleases" | "units">,
  siteCode: string,
  now: Instant,
): { admissionId: string; unitId: string }[] {
  const site = new Set(siteWards(state.units, siteCode).map((unit) => unit.id));
  const dayStart = startOfDay(now);
  return state.admissions
    .filter((admission) => site.has(admission.unitId) && admission.state === "occupied" && admission.blockReason)
    .filter(
      (admission) =>
        !state.bedReleases.some(
          (release) =>
            release.admissionId === admission.id &&
            release.state !== "discharged" &&
            release.blocker !== null &&
            release.blockerRecordedAt !== undefined &&
            release.blockerRecordedAt >= dayStart,
        ),
    )
    .map((admission) => ({ admissionId: admission.id, unitId: admission.unitId }));
}

/** An open bed meeting action due by the end of today, owned by a site ward or on a site ward's stay. */
type SiteMeetingAction = {
  subject: { kind: "movement" | "admission"; id: string };
  kind: NonNullable<WardFlowState["admissions"][number]["meetingActions"]>[number]["kind"];
  owner: NonNullable<WardFlowState["admissions"][number]["meetingActions"]>[number]["owner"];
  ownerUnitId?: string;
  dueAt: Instant;
};

function siteMeetingActionsOpenToday(
  state: Pick<WardFlowState, "admissions" | "movements" | "units">,
  siteCode: string,
  now: Instant,
): SiteMeetingAction[] {
  const site = new Set(siteWards(state.units, siteCode).map((unit) => unit.id));
  const dayEnd = startOfDay(now) + MINUTES_PER_DAY;
  const open: SiteMeetingAction[] = [];
  const collect = (
    subject: SiteMeetingAction["subject"],
    actions: NonNullable<WardFlowState["admissions"][number]["meetingActions"]> | undefined,
    stayUnitId: string | undefined,
  ) => {
    for (const action of actions ?? []) {
      if (action.doneAt !== undefined || action.dueAt >= dayEnd) continue;
      const ownWard = action.owner === "ward" && action.ownerUnitId !== undefined && site.has(action.ownerUnitId);
      if (!ownWard && !(stayUnitId !== undefined && site.has(stayUnitId))) continue;
      open.push({
        subject,
        kind: action.kind,
        owner: action.owner,
        ...(action.ownerUnitId === undefined ? {} : { ownerUnitId: action.ownerUnitId }),
        dueAt: action.dueAt,
      });
    }
  };
  for (const admission of state.admissions)
    collect({ kind: "admission", id: admission.id }, admission.meetingActions, admission.unitId);
  for (const movement of state.movements)
    collect({ kind: "movement", id: movement.id }, movement.meetingActions, undefined);
  return open.sort((a, b) => a.dueAt - b.dueAt);
}

/** Q63: the four checks before a site signs off. Information only: none of them blocks the sign-off. */
type SiteSignOffCheckId = "bed_numbers" | "discharge_blockers" | "bed_meeting_actions" | "bed_calls";

export type SiteSignOffCheck = {
  id: SiteSignOffCheckId;
  /** How many are still open. Zero means the check is done. */
  open: number;
  /** The open items' ids: ward ids, stay ids, `<subject kind>:<subject id>:<action kind>`, or bed call ids. */
  ids: string[];
  /** Bed numbers only: how many of the site's wards there are, for "2 of 3 wards". */
  of?: number;
};

export function siteSignOffChecks(
  state: Pick<WardFlowState, "admissions" | "bedReleases" | "broadcastAlerts" | "movements" | "units">,
  siteCode: string,
  now: Instant,
): SiteSignOffCheck[] {
  const wards = siteWards(state.units, siteCode);
  const unconfirmed = wards.filter((unit) => bedFigureUnconfirmed(unit, now)).map((unit) => unit.id);
  const blockers = siteBlockersNotReviewedToday(state, siteCode, now).map((row) => row.admissionId);
  const actions = siteMeetingActionsOpenToday(state, siteCode, now).map(
    (action) => `${action.subject.kind}:${action.subject.id}:${action.kind}`,
  );
  const calls = siteUnansweredBedCalls(state, siteCode, now).map((call) => call.alertId);
  return [
    { id: "bed_numbers", open: unconfirmed.length, ids: unconfirmed, of: wards.length },
    { id: "discharge_blockers", open: blockers.length, ids: blockers },
    { id: "bed_meeting_actions", open: actions.length, ids: actions },
    { id: "bed_calls", open: calls.length, ids: calls },
  ];
}

/** This site's sign-off for the handover at `shiftAt`, or null: the latest one, as Undo takes back the latest. */
export function siteSignOffFor(
  records: readonly SiteHandoverSignOffRecord[] | undefined,
  siteCode: string,
  shiftAt: Instant,
): SiteHandoverSignOffRecord | null {
  let latest: SiteHandoverSignOffRecord | null = null;
  for (const record of records ?? [])
    if (record.siteCode === siteCode && record.shiftAt === shiftAt && (latest === null || record.at >= latest.at))
      latest = record;
  return latest;
}

/**
 * Q62: the wards a site sign-off named as unsigned that still have no sign-off of their own for that
 * handover. Each stays flagged outstanding until it signs; once its handover has started a ward can
 * no longer sign that sheet, so it stays outstanding on that handover's record.
 */
export function outstandingWardSignOffs(
  record: SiteHandoverSignOffRecord,
  signOffs: readonly WardSignOff[] | undefined,
): string[] {
  return record.unsignedUnitIds.filter(
    (unitId) =>
      !(signOffs ?? []).some((signOff) => signOff.unitId === unitId && inSignOffWindow(signOff.at, record.shiftAt)),
  );
}

/** Q63: the bed calls a site sign-off named that a named site ward has still not answered. */
export function stillUnansweredBedCalls(
  record: SiteHandoverSignOffRecord,
  state: Pick<WardFlowState, "broadcastAlerts" | "units">,
  now: Instant,
): string[] {
  const open = new Set(siteUnansweredBedCalls(state, record.siteCode, now).map((call) => call.alertId));
  return record.unansweredBedCallIds.filter((id) => open.has(id));
}

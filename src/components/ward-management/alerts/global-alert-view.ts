/**
 * GLOBAL ALERTS, WHAT EACH DESK SEES (Josh picked option A, 10 Oct 2026).
 *
 * Pure reads over `broadcastAlerts`, so the banner, the Alerts page and the tests agree. Nothing
 * here is stored: overdue, live and the reply board are all derived from the alert and the movement.
 */
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, edById, siteByCode } from "@/components/ward-management/ward-sites";
import {
  alertAsksDesk,
  broadcastKind,
  deskHasAnswered,
  isAlertActive,
  isPullNowOverdue,
  latestReplies,
  pullNowStillWaiting,
  type BroadcastAlert,
  type BroadcastReply,
  type BroadcastTargetScope,
} from "./ward-broadcast-model";

const METRO_SERVICES = ["East Metro", "North Metro", "South Metro"];

/**
 * The wards a broadcast's chosen target covers. ED liaison names no ward, so it covers none. A bed
 * call asks these wards; a directive counts its acknowledgements against them.
 */
export function wardsInBroadcastScope(units: readonly Unit[], scope: BroadcastTargetScope): string[] {
  return units
    .filter((unit) => {
      const service = siteByCode(unit.siteCode)?.service ?? "";
      if (scope === "all") return true;
      if (scope === "metro_adult") return unit.cohort === "Adult" && METRO_SERVICES.includes(service);
      if (scope === "forensic") return unit.forensic;
      if (scope === "adolescent") return unit.cohort === "Youth";
      if (scope === "older_adult") return unit.cohort === "Older adult";
      if (scope === "regional_wachs") return service === "WACHS";
      return false;
    })
    .map((unit) => unit.id);
}

/**
 * The desks a directive asks to acknowledge (ops-11, 13 Oct 2026): the wards its target covers,
 * plus every ED desk when the target is every unit or ED liaison. The coordinator desk sends
 * directives and is never counted.
 */
export function directiveDesks(
  alert: Pick<BroadcastAlert, "targetScope" | "targetUnitIds">,
  units: readonly Unit[],
): string[] {
  // Alerts redesign (1 Nov 2026): a directive sent to chosen desks asks only those.
  if (alert.targetUnitIds !== undefined) return [...alert.targetUnitIds];
  const { wards, eds } = desksInBroadcastScope(units, alert.targetScope);
  return [...wards, ...eds];
}

/** The ward and ED desks a target covers: every ED desk for every unit or ED liaison. */
function desksInBroadcastScope(
  units: readonly Unit[],
  scope: BroadcastTargetScope,
): { wards: string[]; eds: string[] } {
  const eds = scope === "all" || scope === "ed_liaison" ? allEmergencyDepartments().map((ed) => ed.id) : [];
  return { wards: wardsInBroadcastScope(units, scope), eds };
}

/**
 * A directive's acknowledgements against the desks it asked, so nine wards read "of 9". A scoped desk
 * passes `inScope` and counts against its own desks only.
 */
export function directiveAcknowledgements(
  alert: BroadcastAlert,
  units: readonly Unit[],
  inScope: (deskId: string) => boolean = () => true,
): { acknowledged: number; of: number } {
  const asked = new Set(directiveDesks(alert, units).filter(inScope));
  return { acknowledged: alert.acknowledgedUnits.filter((id) => asked.has(id)).length, of: asked.size };
}

export type AlertDesk = { role: string; id: string | null };

/** Active, and for a Pull now, the patient is still waiting for the bed. */
export function isAlertLive(alert: BroadcastAlert, movements: readonly Movement[], now: Instant): boolean {
  if (!isAlertActive(alert, now)) return false;
  if (broadcastKind(alert) !== "pull_now") return true;
  return pullNowStillWaiting(
    alert,
    movements.find((candidate) => candidate.id === alert.movementId),
  );
}

/** `act_now` is the only red: a Pull now waiting on this desk, or one nobody answered in time. */
export type BannerTone = "act_now" | "critical" | "warning" | "advisory" | "waiting";

export type BannerEntry = { alert: BroadcastAlert; tone: BannerTone; needsAnswer: boolean };

const TONE_RANK: Record<BannerTone, number> = { act_now: 0, critical: 1, warning: 2, advisory: 3, waiting: 4 };

/**
 * Every live alert this desk should see, most urgent first. Wards see only Pull nows that ask them;
 * ED, team and officer desks never see a Pull now. The coordinator sees every one, red only once
 * it is overdue.
 */
export function bannerEntriesForDesk(
  alerts: readonly BroadcastAlert[],
  movements: readonly Movement[],
  desk: AlertDesk,
  now: Instant,
  units?: readonly Unit[],
): BannerEntry[] {
  const entries: BannerEntry[] = [];
  for (const alert of alerts) {
    if (!isAlertLive(alert, movements, now)) continue;
    // A directive asks only the desks its target covers, the same desks its "x of N" counts.
    const asks =
      alertAsksDesk(alert, desk) &&
      (broadcastKind(alert) !== "directive" ||
        desk.role === "coordinator" ||
        units === undefined ||
        (desk.id !== null && directiveDesks(alert, units).includes(desk.id)));
    const needsAnswer = asks && desk.id !== null && !deskHasAnswered(alert, desk.id);
    if (broadcastKind(alert) === "pull_now") {
      if (desk.role === "coordinator") {
        entries.push({ alert, tone: isPullNowOverdue(alert, now) ? "act_now" : "waiting", needsAnswer: false });
      } else if (asks) {
        entries.push({ alert, tone: needsAnswer ? "act_now" : "waiting", needsAnswer });
      }
      continue;
    }
    entries.push({ alert, tone: alert.severity, needsAnswer });
  }
  return entries.sort(
    (a, b) =>
      Number(b.tone === "act_now") - Number(a.tone === "act_now") ||
      Number(b.needsAnswer) - Number(a.needsAnswer) ||
      TONE_RANK[a.tone] - TONE_RANK[b.tone] ||
      b.alert.dispatchedAt - a.alert.dispatchedAt,
  );
}

type ReplyRow = { unitId: string; name: string; reply?: BroadcastReply };

export type ReplyBoard = {
  rows: ReplyRow[];
  answered: number;
  /** Beds offered on a bed call, from `can_take` answers only. */
  bedsOffered: number;
};

/**
 * Who was asked and what each said. A Pull now asked its named wards; a bed call asked every ward.
 * Unanswered rows sort first, so the coordinator sees who to chase.
 */
export function replyBoard(alert: BroadcastAlert, units: readonly { id: string; name: string }[]): ReplyBoard {
  const kind = broadcastKind(alert);
  const askedIds =
    kind === "pull_now"
      ? (alert.targetUnitIds ?? [])
      : kind === "bed_call"
        ? (alert.targetUnitIds ?? units.map((u) => u.id))
        : [];
  const latest = latestReplies(alert);
  const rows = askedIds.map((unitId) => ({
    unitId,
    name: deskName(unitId, units),
    reply: latest.get(unitId),
  }));
  rows.sort((a, b) => Number(Boolean(a.reply)) - Number(Boolean(b.reply)) || a.name.localeCompare(b.name));
  const answered = rows.filter((row) => row.reply).length;
  const bedsOffered = rows.reduce(
    (sum, row) => sum + (row.reply?.answer === "can_take" ? (row.reply.beds ?? 0) : 0),
    0,
  );
  return { rows, answered, bedsOffered };
}

export function deskName(unitId: string, units: readonly { id: string; name: string }[]): string {
  return units.find((unit) => unit.id === unitId)?.name ?? edById(unitId)?.name ?? unitId;
}

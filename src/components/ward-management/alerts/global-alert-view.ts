/**
 * GLOBAL ALERTS, WHAT EACH DESK SEES (Josh picked option A, 10 Oct 2026).
 *
 * Pure reads over `broadcastAlerts`, so the banner, the Alerts page and the tests agree. Nothing
 * here is stored: overdue, live and the reply board are all derived from the alert and the movement.
 */
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { edById } from "@/components/ward-management/ward-sites";
import {
  alertAsksDesk,
  broadcastKind,
  deskHasAnswered,
  isAlertActive,
  isPullNowOverdue,
  latestReplies,
  type BroadcastAlert,
  type BroadcastReply,
} from "./ward-broadcast-model";

export type AlertDesk = { role: string; id: string | null };

/** The stages a Pull now still means something in. Once pulled, the alert has done its job. */
const PULL_NOW_LIVE_STAGES: readonly Movement["stage"][] = [
  "placement_requested",
  "destination_review",
  "accepted_awaiting_bed",
];

/** Active, and for a Pull now, the patient is still waiting for the bed. */
export function isAlertLive(alert: BroadcastAlert, movements: readonly Movement[], now: Instant): boolean {
  if (!isAlertActive(alert, now)) return false;
  if (broadcastKind(alert) !== "pull_now") return true;
  const movement = movements.find((candidate) => candidate.id === alert.movementId);
  return Boolean(movement && !movement.closure && PULL_NOW_LIVE_STAGES.includes(movement.stage));
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
): BannerEntry[] {
  const entries: BannerEntry[] = [];
  for (const alert of alerts) {
    if (!isAlertLive(alert, movements, now)) continue;
    const asks = alertAsksDesk(alert, desk);
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

export type ReplyRow = { unitId: string; name: string; reply?: BroadcastReply };

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
    kind === "pull_now" || kind === "bed_call" ? (alert.targetUnitIds ?? units.map((u) => u.id)) : [];
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

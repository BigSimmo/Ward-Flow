import type { Instant } from "./ward-clock";
import type { WardFlowState } from "./ward-flow-reducer";

/**
 * PHONE ALERTS FOR THE OFFICER AND COMMUNITY DESKS (role access plan v2, D-80). Neither desk owns
 * act-now rows, so each hears the changes its own work turns on instead: an officer a job that is
 * new or whose booking changed, a community team a referral it sent being answered and a client
 * being admitted or leaving a ward.
 *
 * The push service announces ids that were not there at the last evaluation, so each alert is an
 * id that holds while its condition does. A changed booking is a new id. A community update holds
 * for `ROLE_ALERT_WINDOW_MINUTES` after it happened, long enough for a delivery to be retried, and then
 * leaves. Ids carry record ids and fixed words only, never typed text.
 */
export const ROLE_ALERT_WINDOW_MINUTES = 12 * 60;

export type RoleAlertKind = "job" | "community";

export type RoleAlert = { readonly id: string; readonly kind: RoleAlertKind; readonly movementId?: string };

/** FNV-1a, so a booking's typed CAD number shapes the id without ever appearing in it. */
function fingerprint(parts: readonly (string | number | boolean | undefined)[]): string {
  let hash = 0x811c9dc5;
  for (const char of parts.map((part) => String(part ?? "")).join("\u0000")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/** One id per open transport job, new whenever what the crew must know changes. */
export function jobAlerts(state: Pick<WardFlowState, "movements">): RoleAlert[] {
  return state.movements.flatMap((movement) => {
    const job = movement.transport;
    if (job === undefined || job.arrivedAt !== undefined || movement.closure !== undefined) return [];
    const booking = fingerprint([
      job.id,
      job.provider,
      job.escortRequired,
      job.estimatedAt,
      job.transportLegalStatus,
      job.formRequired,
      job.cadNumber,
    ]);
    return [{ id: `job:${movement.id}:${booking}`, kind: "job" as const, movementId: movement.id }];
  });
}

function destinationKey(destination: WardFlowState["referrals"][number]["destinations"][number]["destination"]) {
  switch (destination.kind) {
    case "psychiatric_ward":
      return fingerprint([destination.kind, destination.unitId]);
    case "emergency_department":
      return fingerprint([destination.kind, destination.edId]);
    case "community_team":
      return fingerprint([destination.kind, destination.teamName]);
  }
}

const recent = (at: Instant | null | undefined, now: Instant) =>
  at !== null && at !== undefined && at <= now && now - at < ROLE_ALERT_WINDOW_MINUTES;

/** A community team's referral answered, and stays admitted or left, in the last window. */
export function communityAlerts(state: Pick<WardFlowState, "referrals" | "admissions">, now: Instant): RoleAlert[] {
  const alerts: RoleAlert[] = [];
  for (const referral of state.referrals) {
    if (referral.source !== "community") continue;
    // Named by the destination and the answer's time, not its place in the list, so a desk's
    // trimmed copy of the referral gives the same id as the whole record, and two wards answering
    // in the same minute are two alerts. A team's name is hashed, never written into the id.
    for (const line of referral.destinations)
      if ((line.state === "accepted" || line.state === "declined") && recent(line.decidedAt, now))
        alerts.push({
          id: `answered:${referral.id}:${destinationKey(line.destination)}:${line.decidedAt}:${line.state}`,
          kind: "community",
        });
  }
  for (const admission of state.admissions) {
    if (recent(admission.arrivedAt, now)) alerts.push({ id: `admitted:${admission.id}`, kind: "community" });
    if (recent(admission.leftAt, now)) alerts.push({ id: `left:${admission.id}`, kind: "community" });
  }
  // Two answers in the same millisecond share an id; the push tables take each id once.
  return [...new Map(alerts.map((alert) => [alert.id, alert])).values()];
}

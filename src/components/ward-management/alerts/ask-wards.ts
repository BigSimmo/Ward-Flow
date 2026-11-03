import type { Instant } from "../ward-clock";
import type { BroadcastAlert } from "./ward-broadcast-model";

/**
 * One send path for every "Ask N wards" button (Josh, M6, 3 Nov 2026): Tools Ward updates and the
 * Discharges chase. Each press is ONE advisory directive to just the wards asked, live for four
 * hours. A ward that an active ask with the same title already names is skipped, so a second press
 * inside four hours never nags it again.
 */
const ASK_WARDS_MINUTES = 240;

export type WardAsk = { title: string; message: string };

export const ASK_CONFIRM_BEDS: WardAsk = {
  title: "Please confirm your beds",
  message: "Check your bed numbers, then tap Beds still correct or update them.",
};

/** The wards an active, unexpired ask with this title already names. */
function wardsAlreadyAsked(alerts: readonly BroadcastAlert[], title: string, now: Instant): ReadonlySet<string> {
  const asked = new Set<string>();
  for (const alert of alerts) {
    if (alert.title !== title || alert.status !== "active" || alert.expiresAt <= now) continue;
    for (const id of alert.targetUnitIds ?? []) asked.add(id);
  }
  return asked;
}

/** Split the wards picked into those to ask now and those asked within the last four hours. */
export function splitAsk(
  unitIds: readonly string[],
  alerts: readonly BroadcastAlert[],
  ask: WardAsk,
  now: Instant,
): { send: string[]; skipped: string[] } {
  const asked = wardsAlreadyAsked(alerts, ask.title, now);
  return {
    send: unitIds.filter((id) => !asked.has(id)),
    skipped: unitIds.filter((id) => asked.has(id)),
  };
}

const wards = (count: number) => `${count} ${count === 1 ? "ward" : "wards"}`;

/** The fields of the one DISPATCH_BROADCAST_ALERT an ask raises. */
export function askWardsFields(ask: WardAsk, unitIds: readonly string[]) {
  return {
    title: ask.title,
    message: ask.message,
    severity: "advisory" as const,
    category: "capacity_gridlock" as const,
    targetScope: "all" as const,
    targetScopeLabel: wards(unitIds.length),
    targetUnitIds: [...unitIds],
    durationMinutes: ASK_WARDS_MINUTES,
    dispatchedByName: "Bed coordinator",
    kind: "directive" as const,
  };
}

/** The one wording every ask button uses once it has sent. */
export function askedLine(sent: number, skipped: number): string {
  const head = sent > 0 ? `Asked ${wards(sent)}. It shows on their screen for 4 hours.` : "No one asked.";
  const tail = skipped > 0 ? ` ${wards(skipped)} already asked in the last 4 hours, so skipped.` : "";
  return head + tail;
}

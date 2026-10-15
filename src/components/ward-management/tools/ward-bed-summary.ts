import { standingFigures } from "../ward-standing-strip";
import { bedsPendingPreparation, capacityBreakdown } from "../ward-bed-availability";
import { unitHealthService } from "../ward-service-scope";
import { waitingInEds } from "../ward-shared-figures";
import { formatInstant } from "../ward-clock";
import { HEALTH_SERVICES, type HealthService } from "../ward-model";
import type { useWardFlow } from "../ward-flow-provider";

type Flow = ReturnType<typeof useWardFlow>;

export type BedSummaryInput = Pick<Flow, "units" | "admissions" | "movements" | "bedReleases" | "leaveBeds"> & {
  now: number;
};

/**
 * Tools, Copy bed summary (Tools review item 18, 15 Oct 2026): the plain text situation report a
 * coordinator pastes into the exec on-call email or a Teams message. Every number comes from the
 * same derivations the screens use, so the copy can never disagree with the board. Ready beds always
 * carry their pending count (owner ruling 2026-09-05). Plain text only: no arrows, no symbols.
 */
export function bedSummaryText(input: BedSummaryInput): string {
  const { units, admissions, movements, bedReleases, leaveBeds, now } = input;
  const ready = new Map<HealthService, number>(HEALTH_SERVICES.map((service) => [service, 0]));
  let readyTotal = 0;
  let pendingTotal = 0;
  let confirmed = 0;
  let expected = 0;
  let blocked = 0;
  for (const unit of units) {
    const capacity = capacityBreakdown(unit, bedReleases, leaveBeds, now);
    const service = unitHealthService(unit);
    readyTotal += capacity.availableNow;
    if (service) ready.set(service, (ready.get(service) ?? 0) + capacity.availableNow);
    pendingTotal += bedsPendingPreparation(unit.id, bedReleases);
    confirmed += capacity.confirmedToday;
    expected += capacity.expectedToday;
    blocked += capacity.blockedToday;
  }
  const beds = units.reduce((sum, unit) => sum + unit.beds, 0);
  const waiting = waitingInEds(movements, now);
  const flagged = standingFigures({
    movements,
    units,
    admissions,
    bedReleases,
    leaveBeds,
    now,
    chromeRole: "coordinator",
  }).filter((figure) => figure.flagged);

  const byService = HEALTH_SERVICES.filter((service) => (ready.get(service) ?? 0) > 0)
    .map((service) => `${service} ${ready.get(service)}`)
    .join(", ");
  const waitingByService = HEALTH_SERVICES.filter((service) => (waiting.byService.get(service) ?? 0) > 0)
    .map((service) => `${service} ${waiting.byService.get(service)}`)
    .join(", ");

  return [
    `Mental health bed summary at ${formatInstant(now)} AWST`,
    `Ready beds: ${readyTotal} of ${beds}${pendingTotal > 0 ? `, ${pendingTotal} pending preparation` : ""}.`,
    byService ? `Ready by service: ${byService}.` : "Ready by service: none.",
    `Waiting in EDs: ${waiting.total}${waitingByService ? ` (${waitingByService})` : ""}.`,
    `Discharges today: ${confirmed} confirmed, ${expected} expected, ${blocked} blocked.`,
    ...(flagged.length > 0
      ? [`Flagged: ${flagged.map((figure) => `${figure.value} ${figure.label.toLowerCase()}`).join(", ")}.`]
      : ["Flagged: nothing."]),
    "Synthetic prototype data. Not for clinical use.",
  ].join("\n");
}

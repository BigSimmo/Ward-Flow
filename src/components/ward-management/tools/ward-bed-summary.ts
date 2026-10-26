import { standingFigures } from "../ward-standing-strip";
import { bedsPendingPreparation, capacityBreakdown } from "../ward-bed-availability";
import { readyBedsNow } from "../ward-bed-states";
import { unitHealthService } from "../ward-service-scope";
import { openEdJourneys } from "../ward-shared-figures";
import { type DueSoonThresholds, formatInstant } from "../ward-clock";
import { HEALTH_SERVICES, type HealthService } from "../ward-model";
import type { WardNetwork } from "../ward-sites";
import type { useWardFlow } from "../ward-flow-provider";

type Flow = ReturnType<typeof useWardFlow>;

export type BedSummaryInput = Pick<Flow, "units" | "admissions" | "movements" | "bedReleases" | "leaveBeds"> & {
  now: number;
  thresholds: DueSoonThresholds;
  network: WardNetwork;
};

/**
 * Tools, Copy bed summary (Tools review item 18, 15 Oct 2026): the plain text situation report a
 * coordinator pastes into the exec on-call email or a Teams message. Every number comes from the
 * same derivations the screens use, so the copy can never disagree with the board. Ready beds always
 * carry their pending count (owner ruling 2026-09-05). Plain text only: no arrows, no symbols.
 *
 * NA3-05 (audit 26 Oct 2026): Ready is `readyBedsNow`, the figure Home, Capacity and the rail print,
 * not the older `capacityBreakdown().availableNow`, which still offered a bed pulled for an incoming
 * patient. The discharge line covers today and tomorrow (`releaseBand`), so it says so, and held up
 * is a part of the confirmed and expected releases, never a third bucket beside them. Confirmed
 * keeps a held-up release and says how many (decision 16), as Capacity does.
 */
export function bedSummaryText(input: BedSummaryInput): string {
  const { units, admissions, movements, bedReleases, leaveBeds, now, thresholds, network } = input;
  const ready = new Map<HealthService, number>(HEALTH_SERVICES.map((service) => [service, 0]));
  let readyTotal = 0;
  let pendingTotal = 0;
  let confirmed = 0;
  let expected = 0;
  let confirmedHeldUp = 0;
  let heldUp = 0;
  for (const unit of units) {
    const capacity = capacityBreakdown(unit, bedReleases, leaveBeds, now);
    const readyHere = readyBedsNow(unit, admissions, bedReleases);
    const service = unitHealthService(unit);
    readyTotal += readyHere;
    if (service) ready.set(service, (ready.get(service) ?? 0) + readyHere);
    pendingTotal += bedsPendingPreparation(unit.id, bedReleases);
    confirmed += capacity.confirmedToday;
    confirmedHeldUp += capacity.confirmedHeldUpToday;
    expected += capacity.expectedToday;
    heldUp += capacity.blockedToday;
  }
  const beds = units.reduce((sum, unit) => sum + unit.beds, 0);
  const waiting = openEdJourneys(movements, now);
  const flagged = standingFigures(
    {
      movements,
      units,
      admissions,
      bedReleases,
      leaveBeds,
      now,
      chromeRole: "coordinator",
    },
    thresholds,
    network,
  ).filter((figure) => figure.flagged);

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
    `Open ED journeys: ${waiting.total}${waitingByService ? ` (${waitingByService})` : ""}.`,
    `Still in ED: ${waiting.stillInEd}. In transit or recorded departure: ${waiting.inTransit}.`,
    `Discharges today and tomorrow: ${confirmed} confirmed${confirmedHeldUp > 0 ? ` (${confirmedHeldUp} also held up)` : ""}, ${expected} expected. Of these, ${heldUp} held up.`,
    ...(flagged.length > 0
      ? [`Flagged: ${flagged.map((figure) => `${figure.value} ${figure.label.toLowerCase()}`).join(", ")}.`]
      : ["Flagged: nothing."]),
    "Synthetic prototype data. Not for clinical use.",
  ].join("\n");
}

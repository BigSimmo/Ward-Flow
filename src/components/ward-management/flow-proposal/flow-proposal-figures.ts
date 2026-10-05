import { groupDischarges } from "@/components/ward-management/discharges/discharge-board";
import { SEVERE_CAUSES, delayGroups } from "@/components/ward-management/delays/delays-derivations";
import type { Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type {
  BedRelease,
  HealthService,
  LeaveBed,
  Movement,
  MovementStage,
  Referral,
  Unit,
} from "@/components/ward-management/ward-model";
import { serviceRollup, type UnitRollup } from "@/components/ward-management/ward-morning-rollup";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { decidedReferrals, referralQueueOrder, referralState } from "@/components/ward-management/ward-referrals";
import { movementBelongsToService, unitHealthService } from "@/components/ward-management/ward-service-scope";
import { siteByCode, wardSites } from "@/components/ward-management/ward-sites";

/**
 * Every figure the referrals, handover and discharges proposals show, read from the derivations the
 * sidebar and the current screens already use. Nothing here counts anything new: each function
 * names the shared derivation it reads, so a proposal figure cannot drift from the sidebar's.
 */

export type ProposalWorld = {
  movements: Movement[];
  units: Unit[];
  referrals: Referral[];
  bedReleases: readonly BedRelease[];
  leaveBeds: readonly LeaveBed[];
  admissions: readonly Admission[];
};

/** "network" or one health service. */
export type ProposalScope = "network" | HealthService;

/** Stages where a person is waiting for a ward to say yes. Same pair the current handover counts. */
export const WAITING_FOR_WARD_STAGES: readonly MovementStage[] = ["placement_requested", "destination_review"];

/** Stages where a ward has said yes and the person is on their way in. Same set as the handover's Inbound focus. */
export const INBOUND_STAGES: readonly MovementStage[] = ["accepted_awaiting_bed", "pulled", "handover_ready", "moving"];

/** The sidebar's own figures, unchanged. The proposals' headline strips read these. */
export function headlineFigures(world: ProposalWorld, now: Instant) {
  const counts = wardNavCounts({
    movements: world.movements,
    units: world.units,
    referrals: world.referrals,
    bedReleases: world.bedReleases,
    leaveBeds: world.leaveBeds,
    now,
  });
  return {
    bedsReadyNow: counts.capacity?.value ?? 0,
    openMovements: counts.movements?.value ?? 0,
    severeDelays: counts.delays?.value ?? 0,
    dischargesHeldUp: counts.discharges?.value ?? 0,
    referralsAwaitingDecision: counts.referrals?.value ?? 0,
  };
}

/** Per-unit bed position from the same rollup the sidebar's "beds ready now" sums. */
export function unitRollups(world: ProposalWorld, now: Instant): Map<string, UnitRollup> {
  const rollup = serviceRollup(wardSites, world.units, [...world.bedReleases], [...world.leaveBeds], now);
  return new Map(rollup.sites.flatMap((site) => site.units).map((entry) => [entry.unit.id, entry]));
}

/* ── Referral board ──────────────────────────────────────────────────────────────────────── */

export function referralBoardFigures(referrals: Referral[]) {
  const queued = referralQueueOrder(referrals);
  const decided = decidedReferrals(referrals);
  const accepted = decided.filter((referral) => referralState(referral) === "accepted");
  const declined = decided.filter((referral) => referralState(referral) === "declined");
  const oldest = queued.reduce<Referral | undefined>(
    (found, referral) => (found === undefined || referral.raisedAt < found.raisedAt ? referral : found),
    undefined,
  );
  return {
    queued,
    accepted,
    declined,
    /** Everything else the board holds: withdrawn, or nothing left awaiting an answer. */
    otherCount: referrals.length - queued.length - accepted.length - declined.length,
    tier1: queued.filter((referral) => referral.urgency === 1).length,
    wantsWard: queued.filter((referral) =>
      referral.destinations.some((addressing) => addressing.destination.kind === "psychiatric_ward"),
    ).length,
    oldest,
  };
}

/* ── Handover ────────────────────────────────────────────────────────────────────────────── */

function unitInScope(unit: Unit, scope: ProposalScope): boolean {
  return scope === "network" || unitHealthService(unit) === scope;
}

function referralInScope(referral: Referral, scope: ProposalScope): boolean {
  return scope === "network" || siteByCode(referral.originSiteCode)?.service === scope;
}

/**
 * The handover's figures for one scope. Fixes the current handover's vacancy count, which kept the
 * whole network's figure when a health service was chosen (`handover-page.tsx`, the
 * `allocatableVacancies` filter returns every unit for a service scope). Here every figure narrows
 * with the scope, and at network scope each one equals the sidebar's.
 */
export function handoverFigures(world: ProposalWorld, scope: ProposalScope, now: Instant) {
  const units = world.units.filter((unit) => unitInScope(unit, scope));
  const unitIds = new Set(units.map((unit) => unit.id));
  const sites = scope === "network" ? wardSites : wardSites.filter((site) => site.service === scope);
  const movements =
    scope === "network"
      ? world.movements
      : world.movements.filter((movement) => movementBelongsToService(movement, scope, world.units));
  const open = movements.filter(isOpen).sort((a, b) => a.openedAt - b.openedAt);
  const releases = world.bedReleases.filter((release) => unitIds.has(release.unitId));
  const leave = world.leaveBeds.filter((bed) => unitIds.has(bed.unitId));
  const rollup = serviceRollup(sites, units, [...releases], [...leave], now);
  const severe = delayGroups(movements, world.units, now).filter((group) => SEVERE_CAUSES.includes(group.cause));
  const referrals = world.referrals.filter((referral) => referralInScope(referral, scope));

  return {
    open,
    waitingForWard: open.filter((movement) => WAITING_FOR_WARD_STAGES.includes(movement.stage)),
    inbound: open.filter((movement) => INBOUND_STAGES.includes(movement.stage)),
    severe,
    severeCount: severe.reduce((total, group) => total + group.movements.length, 0),
    bedsReadyNow: rollup.service.availableNow,
    dischargesHeldUp: rollup.service.blockedToday,
    referralsAwaitingDecision: referralQueueOrder(referrals),
    sites: rollup.sites.filter((site) => site.units.length > 0),
    releases,
  };
}

/* ── Discharges ──────────────────────────────────────────────────────────────────────────── */

/** The discharge board's own grouping, unchanged, plus the totals the proposal's strip shows. */
export function dischargeFigures(world: ProposalWorld, now: Instant) {
  const groups = groupDischarges([...world.bedReleases], now);
  const shown =
    groups.blocked.length + groups.confirmed.length + groups.expected.length + groups["discharged-today"].length;
  return {
    groups,
    shown,
    total: world.bedReleases.length,
    /** Expected releases whose written time has already passed: still "Expected", but late. */
    pastExpected: [...groups.expected, ...groups.confirmed, ...groups.blocked].filter(
      (release) => release.expectedAt < now,
    ).length,
  };
}

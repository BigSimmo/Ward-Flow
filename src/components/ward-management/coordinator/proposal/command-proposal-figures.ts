/**
 * Command redesign proposal (5 October 2026): every figure the proposal shows, derived once from
 * live shared state through the engine's existing derivations. Nothing here re-counts a figure
 * another screen already owns: the ready-bed, referral and delay figures are `wardNavCounts`
 * itself, so the page and the sidebar cannot disagree.
 */
import { edOpenSummaries } from "@/components/ward-management/ed/ed-home-derivations";
import { clockState, type ClockState, type Instant } from "@/components/ward-management/ward-clock";
import { buildActionInbox, isOpen, type InboxItem } from "@/components/ward-management/ward-derivations";
import type {
  BedRelease,
  HealthService,
  LeaveBed,
  Movement,
  Referral,
  Unit,
} from "@/components/ward-management/ward-model";
import { serviceRollup } from "@/components/ward-management/ward-morning-rollup";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { edPressure } from "@/components/ward-management/ward-pressure";
import { edHealthService } from "@/components/ward-management/ward-service-scope";
import { wardSites } from "@/components/ward-management/ward-sites";

export type CommandInput = {
  movements: Movement[];
  units: Unit[];
  referrals: Referral[];
  bedReleases: readonly BedRelease[];
  leaveBeds: readonly LeaveBed[];
  now: Instant;
};

export type EdRow = {
  id: string;
  name: string;
  siteCode: string;
  service: HealthService | undefined;
  waiting: number;
  longestWaitMinutes: number;
  /** The worst state of any typed form due time among this department's open patients. */
  deadline: { state: ClockState | "none"; count: number };
};

export type ServiceBeds = {
  service: HealthService | "No service recorded";
  wards: number;
  ready: number;
  confirmedToday: number;
  expectedToday: number;
  blockedToday: number;
};

export type CommandFigures = {
  openMovements: number;
  waitingInEd: number;
  departmentsWithWaiting: number;
  longest: { minutes: number; edCode: string } | undefined;
  readyBeds: number;
  confirmedToday: number;
  expectedToday: number;
  blockedToday: number;
  referralsAwaiting: number;
  severeDelays: number;
  eds: EdRow[];
  services: ServiceBeds[];
  attention: InboxItem[];
};

const DEADLINE_RANK: Record<ClockState | "none", number> = { breached: 0, critical: 1, due: 2, clear: 3, none: 4 };
const TONE_RANK: Record<string, number> = { danger: 0, warn: 1, warning: 1, info: 2, neutral: 3 };

export function commandFigures(input: CommandInput): CommandFigures {
  const { movements, units, referrals, bedReleases, leaveBeds, now } = input;
  const open = movements.filter(isOpen);
  const nav = wardNavCounts({ movements, units, referrals, bedReleases, leaveBeds, now });
  const summaries = edOpenSummaries(movements, now);

  const eds: EdRow[] = edPressure(now, movements).map((row) => {
    const states = (summaries.find((summary) => summary.ed.id === row.ed.id)?.open ?? [])
      .map((movement) => movement.legalForm?.dueAt)
      .filter((dueAt): dueAt is Instant => dueAt !== undefined)
      .map((dueAt) => clockState(dueAt, now));
    const worst = states.reduce<ClockState | "none">(
      (current, state) => (DEADLINE_RANK[state] < DEADLINE_RANK[current] ? state : current),
      "none",
    );
    return {
      id: row.ed.id,
      name: row.ed.name,
      siteCode: row.ed.siteCode,
      service: edHealthService(row.ed.id),
      waiting: row.waiting,
      longestWaitMinutes: row.longestWaitMinutes,
      deadline: { state: worst, count: states.filter((state) => state === worst).length },
    };
  });

  const longestRow = eds.reduce<EdRow | undefined>(
    (best, row) => (row.waiting > 0 && (!best || row.longestWaitMinutes > best.longestWaitMinutes) ? row : best),
    undefined,
  );

  // Same rollup the sidebar's "beds ready now" reads (`wardNavCounts` → `serviceRollup`), grouped
  // by health service so the rows add up to that one figure.
  const rollup = serviceRollup(wardSites, units, [...bedReleases], [...leaveBeds], now);
  const byService = new Map<ServiceBeds["service"], ServiceBeds>();
  const add = (service: ServiceBeds["service"], wards: number, figures: Omit<ServiceBeds, "service" | "wards">) => {
    const current = byService.get(service) ?? {
      service,
      wards: 0,
      ready: 0,
      confirmedToday: 0,
      expectedToday: 0,
      blockedToday: 0,
    };
    current.wards += wards;
    current.ready += figures.ready;
    current.confirmedToday += figures.confirmedToday;
    current.expectedToday += figures.expectedToday;
    current.blockedToday += figures.blockedToday;
    byService.set(service, current);
  };
  for (const site of rollup.sites) {
    if (site.units.length === 0) continue;
    add(site.site.service, site.units.length, {
      ready: site.rollup.availableNow,
      confirmedToday: site.rollup.confirmedToday,
      expectedToday: site.rollup.expectedToday,
      blockedToday: site.rollup.blockedToday,
    });
  }
  const placed = new Set(rollup.sites.flatMap((site) => site.units.map((unit) => unit.unit.id)));
  const unplacedRollup = serviceRollup(
    [],
    units.filter((unit) => !placed.has(unit.id)),
    [...bedReleases],
    [...leaveBeds],
    now,
  );
  if (rollup.unplacedUnitIds.length > 0) {
    add("No service recorded", rollup.unplacedUnitIds.length, {
      ready: unplacedRollup.service.availableNow,
      confirmedToday: unplacedRollup.service.confirmedToday,
      expectedToday: unplacedRollup.service.expectedToday,
      blockedToday: unplacedRollup.service.blockedToday,
    });
  }

  const attention = buildActionInbox(open, now, units)
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (TONE_RANK[a.item.tone] ?? 3) - (TONE_RANK[b.item.tone] ?? 3) || a.index - b.index)
    .map(({ item }) =>
      // Same wording the live Command screen applies to an expired bed pull.
      item.id.startsWith("bed-pull-") || item.title === "Bed pull expired"
        ? {
            ...item,
            title: "Reserved time has passed, bed still held",
            detail: `${item.detail} · Release the bed or set a new reserved time`,
          }
        : item,
    );

  return {
    openMovements: open.length,
    waitingInEd: eds.reduce((total, row) => total + row.waiting, 0),
    departmentsWithWaiting: eds.filter((row) => row.waiting > 0).length,
    longest: longestRow ? { minutes: longestRow.longestWaitMinutes, edCode: longestRow.siteCode } : undefined,
    readyBeds: nav.capacity?.value ?? rollup.service.availableNow,
    confirmedToday: rollup.service.confirmedToday,
    expectedToday: rollup.service.expectedToday,
    blockedToday: rollup.service.blockedToday,
    referralsAwaiting: nav.referrals?.value ?? 0,
    severeDelays: nav.delays?.value ?? 0,
    eds,
    services: [...byService.values()],
    attention,
  };
}

/** The first sentence on the screen: who is waiting, where, and what is free. */
export function answerSentence(
  figures: Pick<CommandFigures, "waitingInEd" | "departmentsWithWaiting" | "readyBeds">,
): string {
  const beds = figures.readyBeds === 1 ? "1 bed ready now" : `${figures.readyBeds} beds ready now`;
  if (figures.waitingInEd === 0) return `Nobody is waiting in an emergency department; ${beds}.`;
  const departments =
    figures.departmentsWithWaiting === 1
      ? "1 emergency department"
      : `${figures.departmentsWithWaiting} emergency departments`;
  return `${people(figures.waitingInEd)} waiting in ${departments}, ${beds}.`;
}

/** "1 person" / "3 people" — the one plural rule the answer line needs. */
export function people(count: number): string {
  return count === 1 ? "1 person" : `${count} people`;
}

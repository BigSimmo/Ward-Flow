import { edOpenSummaries } from "@/components/ward-management/ed/ed-home-derivations";
import {
  availability,
  buildOnCallDirectory,
  hhmm,
  KEY_LINE_IDS,
  keyLineLabel,
  numberAt,
  type Availability,
  type DirectoryEntry,
} from "@/components/ward-management/on-call/on-call-directory";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { readyBedsNow, totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";
import type { Instant } from "@/components/ward-management/ward-clock";
import { edWaitStep, type EdWaitStep } from "@/components/ward-management/ward-ed-wait-steps";
import type { BedRelease, Movement, Referral, Site, Unit } from "@/components/ward-management/ward-model";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model-vocabulary";
import {
  ED_ELEVATED_PRESSURE_WAIT_MINUTES,
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  LONG_WAIT_MINUTES,
  VERY_LONG_WAIT_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";
import { queueOrder } from "@/components/ward-management/ward-priority";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { minutesInEd } from "@/components/ward-management/ward-shared-figures";

/**
 * NIGHT VIEW (feature plan item 29). One screen for the coordinator overnight. Every figure here is
 * read from the derivation the day screens already use; nothing new is counted:
 *
 * - Beds ready: `readyBedsNow` per ward, and `totalReadyBedsNow` for the total, the same call
 *   `wardNavCounts` makes for Home's "beds ready" and the rail (D-115: pulled and named beds are off).
 * - ED waits by Step: the people Waiting counts (`edOpenSummaries`, so the total is `waitingInEds`),
 *   each placed by `edWaitStep` on time in the department, as the ED board's Step chip is.
 * - On the way: open movements in Home's Moving stage (recorded stage `moving`).
 * - On call: the On-call page's key lines (`KEY_LINE_IDS`), with who answers now.
 *
 * Wards are listed in a fixed order, health service then ward name (D-126), never most ready first.
 */

type NightWardBeds = { unit: Unit; ready: number };

export type NightReadyBeds = {
  /** The same figure as Home's "beds ready" (`wardNavCounts().capacity`). */
  total: number;
  /** Wards with at least one bed ready, health service then ward name. */
  wards: NightWardBeds[];
  /** Wards with no bed ready now, counted, not listed. */
  wardsWithNone: number;
};

function serviceRank(unit: Unit): number {
  const service = unitHealthService(unit);
  const at = service ? HEALTH_SERVICES.indexOf(service) : -1;
  return at === -1 ? HEALTH_SERVICES.length : at;
}

/** Fixed order (D-126): health service, then ward name A to Z. */
function wardsInFixedOrder<T extends { unit: Unit }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => serviceRank(a.unit) - serviceRank(b.unit) || a.unit.name.localeCompare(b.unit.name));
}

export function nightReadyBeds(
  units: readonly Unit[],
  admissions: readonly Admission[],
  bedReleases: readonly BedRelease[],
  movements: readonly Movement[],
  referrals: readonly Referral[],
): NightReadyBeds {
  const reservations = [...movements, ...referrals];
  const rows = units.map((unit) => ({ unit, ready: readyBedsNow(unit, admissions, bedReleases, reservations) }));
  const wards = wardsInFixedOrder(rows.filter((row) => row.ready > 0));
  return {
    total: totalReadyBedsNow(units, admissions, bedReleases, reservations),
    wards,
    wardsWithNone: rows.length - wards.length,
  };
}

type NightStepRow = EdWaitStep & { count: number };

export type NightEdWaits = {
  /** Everyone waiting in an ED: Waiting's title figure (`waitingInEds().total`). */
  waiting: number;
  /** Waiting, but under Step 1. */
  underFirstStep: number;
  /** Steps 1 to 4, in that fixed order, each with how many are at it now. */
  steps: NightStepRow[];
};

/** The four Step thresholds, from the same values `ward-ed-wait-steps.ts` reads. */
const STEP_STARTS = [
  ED_ELEVATED_PRESSURE_WAIT_MINUTES,
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  LONG_WAIT_MINUTES,
  VERY_LONG_WAIT_MINUTES,
] as const;

export function nightEdWaits(movements: readonly Movement[], now: Instant): NightEdWaits {
  const waitingNow = edOpenSummaries(movements, now).flatMap((summary) => summary.open);
  const counts = new Map<number, number>();
  let underFirstStep = 0;
  for (const movement of waitingNow) {
    const step = edWaitStep(minutesInEd(movement, now));
    if (step) counts.set(step.step, (counts.get(step.step) ?? 0) + 1);
    else underFirstStep += 1;
  }
  const steps = STEP_STARTS.map((minutes) => edWaitStep(minutes))
    .filter((step): step is EdWaitStep => step !== undefined)
    .map((step) => ({ ...step, count: counts.get(step.step) ?? 0 }));
  return { waiting: waitingNow.length, underFirstStep, steps };
}

/** Open movements in Home's Moving stage (`flowStageOf`), oldest first as Home lists them. */
export function nightOnTheWay(movements: readonly Movement[], now: Instant): Movement[] {
  return queueOrder([...movements], now).filter((movement) => movement.stage === "moving");
}

export type NightContact = {
  entry: DirectoryEntry;
  label: string;
  now: Availability;
  number: string | null;
};

/** The On-call page's key lines, in its own order, with who answers at `minute`. */
export function nightContacts(sites: readonly Site[], minute: number): NightContact[] {
  const entries = buildOnCallDirectory(sites);
  return KEY_LINE_IDS.map((id) => entries.find((entry) => entry.id === id))
    .filter((entry): entry is DirectoryEntry => entry !== undefined)
    .map((entry) => ({
      entry,
      label: keyLineLabel(entry),
      now: availability(entry, minute),
      number: numberAt(entry, minute),
    }));
}

/** What a key line is doing now, in plain words: "Answering until 17:00". */
export function nightContactNowText(contact: NightContact): string {
  const now = contact.now;
  if (now.kind === "none") return "No line recorded";
  if (now.kind === "off") return `Closed, opens ${hhmm(now.opens)}`;
  if (now.allDay) return "Answering, all day";
  return `Answering until ${hhmm(now.until)}`;
}

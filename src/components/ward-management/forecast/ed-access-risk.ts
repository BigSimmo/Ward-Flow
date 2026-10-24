// src/components/ward-management/forecast/ed-access-risk.ts
//
// "Access risk, next 24 hours" (forecasting build, Josh, 23 Oct 2026, screen 4). Who in ED will
// pass the access target before a bed of the kind they need is due, counted from records only.
//
// ⚠️ **A QUEUE, NOT A PREDICTION.** Everyone waiting for a bed of a kind (the mismatch table's own
// count, ED and elsewhere) is lined up in the order they were referred. Beds that fit now go first,
// then releases of that kind that are not held up, in the time each ward recorded. A person is at
// risk when the bed their place in the line reaches is due after they pass the target, or when the
// line runs out. New referrals, new releases and clinical priority are not modelled, so the card
// says what this is: the earliest release on record, not a bed for this person.
import { bedKindGaps, type BedKindId } from "@/components/ward-management/capacity/capacity-derivations";
import { type Admission } from "@/components/ward-management/ward-admissions";
import { dayOf, MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import type { BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import type { BedRelease, Movement, Unit } from "@/components/ward-management/ward-model";
import { bedKindOfBed, bedKindOfNeed, isWaitingForBed } from "./forecast-by-kind";

type EdAccessRelease = { unitId: string; unitName: string; at: Instant; blocker: BedReleaseBlocker | null };

export type EdAccessRiskRow = {
  movementId: string;
  edId: string;
  kind: BedKindId;
  urgency: Movement["urgency"];
  passesAt: Instant;
  minutesLeft: number;
  /** When the bed this person's place in the line reaches is due. Null when the line runs out. */
  slotAt: Instant | null;
  /** The earliest release of the right kind on record (at the accepting ward when there is one). */
  nextRelease: EdAccessRelease | null;
  acceptedUnitName: string | null;
  declines: number;
};

export type EdAccessRisk = {
  targetMinutes: number;
  horizonMinutes: number;
  atRisk: EdAccessRiskRow[];
  /** People in ED still waiting for a bed who have already passed the target. */
  alreadyOver: number;
  byEd: { edId: string; atRisk: number; alreadyOver: number; firstMinutesLeft: number | null }[];
};

/**
 * How many days ahead to look for a release to name on a row: the network forecast's own furthest
 * window (`bedsForecast`, tomorrow and the day after), so a plan a week out is not shown as "next".
 */
export const RELEASE_LOOKAHEAD_DAYS = 2;

export function edAccessRisk(
  movements: readonly Movement[],
  units: readonly Unit[],
  releases: readonly BedRelease[],
  admissions: readonly Admission[],
  now: Instant,
  targetMinutes: number,
  horizonMinutes = MINUTES_PER_DAY,
): EdAccessRisk {
  const open = new Map(units.filter((unit) => !unit.isClosed).map((unit) => [unit.id, unit]));
  const admissionById = new Map(admissions.map((admission) => [admission.id, admission]));
  const gaps = bedKindGaps([...movements], [...units], now, admissions);
  const pending = releases
    .filter(
      (release) =>
        release.state !== "discharged" && open.has(release.unitId) && dayOf(release.expectedAt) >= dayOf(now),
    )
    .map((release) => ({
      release,
      kind: bedKindOfBed(open.get(release.unitId)!, admissionById.get(release.admissionId)),
      at: Math.max(release.expectedAt, now),
    }))
    .sort((a, b) => a.at - b.at);

  const waiting = movements.filter(isWaitingForBed).sort((a, b) => a.openedAt - b.openedAt || a.id.localeCompare(b.id));
  const slotOf = new Map<string, Instant | null>();
  for (const gap of gaps) {
    const slots: Instant[] = [
      ...Array.from({ length: Math.max(0, gap.bedsThatFit) }, () => now),
      ...pending.filter((entry) => entry.kind === gap.id && entry.release.blocker === null).map((entry) => entry.at),
    ];
    waiting
      .filter((movement) => bedKindOfNeed(movement) === gap.id)
      .forEach((movement, place) => slotOf.set(movement.id, slots[place] ?? null));
  }

  const inEd = waiting.filter(isWaitingInEd);
  const atRisk: EdAccessRiskRow[] = [];
  let alreadyOver = 0;
  const overByEd = new Map<string, number>();
  for (const movement of inEd) {
    // `isWaitingInEd` already leaves out a journey from a community team (D-76), which has no ED.
    const edId = movement.originEdId;
    if (edId === undefined) continue;
    const passesAt = movement.openedAt + targetMinutes;
    if (passesAt <= now) {
      alreadyOver += 1;
      overByEd.set(edId, (overByEd.get(edId) ?? 0) + 1);
      continue;
    }
    if (passesAt > now + horizonMinutes) continue;
    const slotAt = slotOf.get(movement.id) ?? null;
    if (slotAt !== null && slotAt <= passesAt) continue;
    const kind = bedKindOfNeed(movement);
    const accepted = movement.acceptedUnitId ? open.get(movement.acceptedUnitId) : undefined;
    const candidates = pending.filter(
      (entry) =>
        entry.kind === kind &&
        entry.at <= now + RELEASE_LOOKAHEAD_DAYS * MINUTES_PER_DAY &&
        (accepted === undefined || entry.release.unitId === accepted.id),
    );
    const first = candidates[0];
    atRisk.push({
      movementId: movement.id,
      edId,
      kind,
      urgency: movement.urgency,
      passesAt,
      minutesLeft: passesAt - now,
      slotAt,
      nextRelease: first
        ? {
            unitId: first.release.unitId,
            unitName: open.get(first.release.unitId)!.name,
            at: first.at,
            blocker: first.release.blocker,
          }
        : null,
      acceptedUnitName: accepted?.name ?? null,
      declines: movement.declines.length,
    });
  }
  atRisk.sort((a, b) => a.passesAt - b.passesAt || a.movementId.localeCompare(b.movementId));

  const edIds = [...new Set([...atRisk.map((row) => row.edId), ...overByEd.keys()])].sort();
  const byEd = edIds
    .map((edId) => {
      const rows = atRisk.filter((row) => row.edId === edId);
      return {
        edId,
        atRisk: rows.length,
        alreadyOver: overByEd.get(edId) ?? 0,
        firstMinutesLeft: rows[0]?.minutesLeft ?? null,
      };
    })
    .sort((a, b) => b.atRisk + b.alreadyOver - (a.atRisk + a.alreadyOver) || a.edId.localeCompare(b.edId));

  return { targetMinutes, horizonMinutes, atRisk, alreadyOver, byEd };
}

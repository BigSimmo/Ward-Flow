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
import {
  bedKindBreakdown,
  bedKindGaps,
  type BedKindId,
} from "@/components/ward-management/capacity/capacity-derivations";
import { type Admission } from "@/components/ward-management/ward-admissions";
import { readyBedsNow, type ReservationReferral } from "@/components/ward-management/ward-bed-states";
import { dayOf, MINUTES_PER_DAY, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import type { BedRelease, Movement, Unit } from "@/components/ward-management/ward-model";
import { bedKindOfBed, bedKindOfNeed, isWaitingForBed } from "./forecast-by-kind";
import { forecastReleaseAt } from "./forecast-release-date";

/**
 * A release the line counts (F-24, 13 Nov 2026): one that is not held up. The card used to name the
 * earliest release of any kind, held up or not, while the line it sits in skipped held-up releases,
 * so it could name a bed the count had ignored. Both now read the same supply (`lineSupply` below).
 */
type EdAccessRelease = { unitId: string; unitName: string; at: Instant };

/** "24 hour" for a whole-hour target, else "20h 30m": the access target as Settings states it. The card and
 * the brief both read it (H-0361), so a 4h 30m target is never rounded to whole hours. */
export function targetText(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60} hour` : splitDuration(minutes);
}

export type EdAccessRiskRow = {
  movementId: string;
  edId: string;
  kind: BedKindId;
  urgency: Movement["urgency"];
  passesAt: Instant;
  minutesLeft: number;
  /** When the bed this person's place in the line reaches is due. Null when the line runs out. */
  slotAt: Instant | null;
  /**
   * People before this person in their line (A16-07, 3.6): the accepting ward's line for this bed
   * kind when a ward has accepted them, else everyone waiting for this bed kind. 0 for the first in line, so the card
   * says "ahead in the line" only when someone is.
   */
  ahead: number;
  /**
   * The earliest release in this person's own line (F-24): of the right kind, at the accepting ward
   * when there is one, not held up, and within `RELEASE_LOOKAHEAD_DAYS`. The same supply `slotAt`
   * and `ahead` are worked out from, so the card never names a release the line skipped.
   */
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
  /** Referrals that may hold a named bed (3.6): the same named holds Capacity and the ward read. */
  referrals: readonly ReservationReferral[],
  horizonMinutes = MINUTES_PER_DAY,
): EdAccessRisk {
  const open = new Map(units.filter((unit) => !unit.isClosed).map((unit) => [unit.id, unit]));
  const admissionById = new Map(admissions.map((admission) => [admission.id, admission]));
  const expectedAt = (release: BedRelease) => forecastReleaseAt(release, admissionById.get(release.admissionId));
  const gaps = bedKindGaps([...movements], [...units], now, admissions, referrals, releases);
  const namedHolds: readonly ReservationReferral[] = [...movements, ...referrals];
  const pending = releases
    .filter(
      (release) =>
        release.state !== "discharged" && open.has(release.unitId) && dayOf(expectedAt(release)) >= dayOf(now),
    )
    .map((release) => ({
      release,
      kind: bedKindOfBed(open.get(release.unitId)!, admissionById.get(release.admissionId)),
      at: Math.max(expectedAt(release), now),
    }))
    .sort((a, b) => a.at - b.at);
  // F-24: the releases a line can use. A held-up release frees no bed, so neither the line nor the
  // release the card names may count it.
  const lineSupply = pending.filter((entry) => entry.release.blocker === null);

  const waiting = movements.filter(isWaitingForBed).sort((a, b) => a.openedAt - b.openedAt || a.id.localeCompare(b.id));
  const slotOf = new Map<string, Instant | null>();
  const aheadOf = new Map<string, number>();
  for (const gap of gaps) {
    const slots: Instant[] = [
      ...Array.from({ length: Math.max(0, gap.bedsThatFit) }, () => now),
      ...lineSupply.filter((entry) => entry.kind === gap.id).map((entry) => entry.at),
    ];
    waiting
      .filter((movement) => bedKindOfNeed(movement) === gap.id)
      .forEach((movement, place) => {
        slotOf.set(movement.id, slots[place] ?? null);
        aheadOf.set(movement.id, place);
      });
  }
  // A16-07 (Audit 16, 13 Nov 2026): a person a ward has accepted waits for THAT ward's beds of the
  // kind they need. Its line is the people it has accepted for that kind, in the same order, served
  // first by the ward's Ready beds of that kind (the mismatch table's own per-ward split, never more
  // than the ward's `readyBedsNow` with the same named holds), then by its own releases of that kind.
  // So the card never quotes a discharge in two days while the ward shows a fitting bed ready now,
  // and never counts an open bed for someone who needs a locked one (Codex review on #1657).
  const movementList = [...movements];
  const unitList = [...units];
  const kindBedsAt = new Map<BedKindId, Map<string, number>>();
  const kindBeds = (kind: BedKindId, unitId: string) => {
    let byUnit = kindBedsAt.get(kind);
    if (!byUnit) {
      byUnit = new Map(
        bedKindBreakdown(kind, movementList, unitList, admissions, referrals).wards.map((ward) => [
          ward.unit.id,
          ward.beds,
        ]),
      );
      kindBedsAt.set(kind, byUnit);
    }
    return byUnit.get(unitId) ?? 0;
  };
  for (const unit of open.values()) {
    const accepted = waiting.filter((movement) => movement.acceptedUnitId === unit.id);
    if (accepted.length === 0) continue;
    const wardReady = readyBedsNow(unit, admissions, releases, namedHolds);
    for (const kind of new Set(accepted.map(bedKindOfNeed))) {
      const line = accepted.filter((movement) => bedKindOfNeed(movement) === kind);
      const readyNow = Math.min(kindBeds(kind, unit.id), wardReady);
      const wardReleases = lineSupply
        .filter((entry) => entry.release.unitId === unit.id && entry.kind === kind)
        .map((entry) => entry.at);
      line.forEach((movement, place) => {
        slotOf.set(movement.id, place < readyNow ? now : (wardReleases[place - readyNow] ?? null));
        aheadOf.set(movement.id, place);
      });
    }
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
    const candidates = lineSupply.filter(
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
      ahead: aheadOf.get(movement.id) ?? 0,
      nextRelease: first
        ? {
            unitId: first.release.unitId,
            unitName: open.get(first.release.unitId)!.name,
            at: first.at,
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

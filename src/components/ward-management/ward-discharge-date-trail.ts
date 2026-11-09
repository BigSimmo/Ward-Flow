import { MINUTES_PER_DAY, type Instant } from "./ward-clock";

/**
 * Discharge date drift (feature 6, 9 Nov 2026). The first expected discharge date the ward set for
 * a stay, and each later move of it, so a screen can say how far the plan has slipped.
 *
 * A record of the WARD'S PLAN, never a measure of the person: it says the date kept moving, not
 * that anybody was slow. Append-only and bounded: the first date is never dropped, and only the
 * latest `DISCHARGE_DATE_TRAIL_LIMIT` moves are kept. `Admission.dischargeDateMoves` still counts
 * every move, so a long trail's count stays right after the oldest moves fall off.
 */
export type DischargeDateRevision = {
  /** When the move was recorded. */
  readonly at: Instant;
  /** The expected date before the move. */
  readonly previousExpectedAt: Instant;
  /** The expected date after the move. */
  readonly expectedAt: Instant;
};

export type DischargeDateTrail = {
  /** The first expected discharge date recorded for this stay. */
  readonly firstExpectedAt: Instant;
  /** Later moves, oldest first, at most `DISCHARGE_DATE_TRAIL_LIMIT`. */
  readonly revisions: readonly DischargeDateRevision[];
};

/** How many moves a trail keeps. A storage bound, not a clinical figure. */
export const DISCHARGE_DATE_TRAIL_LIMIT = 12;

/**
 * The trail after a date is set or moved. A stay with an earlier date but no trail (saved before
 * this field existed) starts its trail at that earlier date, so the move is still counted.
 */
export function nextDischargeDateTrail(
  trail: DischargeDateTrail | undefined,
  previousExpectedAt: Instant | null,
  expectedAt: Instant,
  now: Instant,
): DischargeDateTrail | undefined {
  if (previousExpectedAt === null) return trail ?? { firstExpectedAt: expectedAt, revisions: [] };
  if (previousExpectedAt === expectedAt) return trail;
  const base = trail ?? { firstExpectedAt: previousExpectedAt, revisions: [] };
  return {
    firstExpectedAt: base.firstExpectedAt,
    revisions: [...base.revisions, { at: now, previousExpectedAt, expectedAt }].slice(-DISCHARGE_DATE_TRAIL_LIMIT),
  };
}

/**
 * Whole days the current expected date sits after the first one, or 0 when it has not slipped (or
 * moved earlier). `null` when there is no trail or no current date, so a screen says nothing rather
 * than "0 days".
 */
export function dischargeDateSlipDays(stay: {
  readonly dischargeDateTrail?: DischargeDateTrail;
  readonly expectedDischargeAt: Instant | null;
}): number | null {
  const trail = stay.dischargeDateTrail;
  if (!trail || stay.expectedDischargeAt === null) return null;
  return Math.max(0, Math.round((stay.expectedDischargeAt - trail.firstExpectedAt) / MINUTES_PER_DAY));
}

/** The dates in order, first then each move, for `deriveEddDriftBadge`'s `eddRevisions`. */
export function dischargeDateSequence(trail: DischargeDateTrail | undefined): Instant[] {
  if (!trail) return [];
  return [trail.firstExpectedAt, ...trail.revisions.map((revision) => revision.expectedAt)];
}

export type SlippingDischarge = {
  readonly admissionId: string;
  readonly unitId: string;
  readonly firstExpectedAt: Instant;
  readonly expectedAt: Instant;
  readonly slipDays: number;
};

/**
 * Stays not yet gone whose expected date is more than `thresholdDays` after the first one, most
 * slipped first. The threshold is an operational setting (`EDD_SLIP_FLAG_DAYS`).
 */
export function slippingDischarges(
  stays: readonly {
    readonly admissionId: string;
    readonly unitId: string;
    readonly departed: boolean;
    readonly dischargeDateTrail?: DischargeDateTrail;
    readonly expectedDischargeAt: Instant | null;
  }[],
  thresholdDays: number,
): SlippingDischarge[] {
  const rows: SlippingDischarge[] = [];
  for (const stay of stays) {
    if (stay.departed) continue;
    const slipDays = dischargeDateSlipDays(stay);
    if (slipDays === null || slipDays <= thresholdDays || !stay.dischargeDateTrail) continue;
    rows.push({
      admissionId: stay.admissionId,
      unitId: stay.unitId,
      firstExpectedAt: stay.dischargeDateTrail.firstExpectedAt,
      expectedAt: stay.expectedDischargeAt!,
      slipDays,
    });
  }
  return rows.sort((a, b) => b.slipDays - a.slipDays || a.expectedAt - b.expectedAt);
}

const TRAIL_KEYS = ["firstExpectedAt", "revisions"];
const REVISION_KEYS = ["at", "previousExpectedAt", "expectedAt"];
const exactKeys = (value: object, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));

/** A stored trail is finite times only, in the exact shape above, within the bound. */
export function isDischargeDateTrail(value: unknown): value is DischargeDateTrail {
  if (!value || typeof value !== "object" || Array.isArray(value) || !exactKeys(value, TRAIL_KEYS)) return false;
  const trail = value as { firstExpectedAt?: unknown; revisions?: unknown };
  return (
    Number.isFinite(trail.firstExpectedAt) &&
    Array.isArray(trail.revisions) &&
    trail.revisions.length <= DISCHARGE_DATE_TRAIL_LIMIT &&
    trail.revisions.every(
      (revision: unknown) =>
        !!revision &&
        typeof revision === "object" &&
        !Array.isArray(revision) &&
        exactKeys(revision, REVISION_KEYS) &&
        REVISION_KEYS.every((key) => Number.isFinite((revision as Record<string, unknown>)[key])),
    )
  );
}

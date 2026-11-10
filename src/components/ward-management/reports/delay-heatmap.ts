// Feature 42 (Josh, 9 Nov 2026): bed days lost to delayed discharge, ward by day, for the Weekly
// operations page. A pure derivation over what each stay already records, nothing estimated:
//
// - a recorded hold-up (`Admission.stayBlockRecords`), from when it was logged until it was cleared
//   (`stayBlockClearances`, or the linked bed release's `clearedBlockHistory`), replaced, the person
//   left, or now while it is still the stay's `blockReason`. A hold-up whose end is not recorded is
//   not counted, because its length would be a guess;
// - and the time past the ward's current expected discharge date, counted from when that date was set,
//   exactly as the weekly Delayed discharge figure counts it (`weeklyOperationsReport`).
//
// The two overlap often. Each minute counts once, under the hold-up when one covers it. Every segment
// keeps its reason, so a later "by reason" split (or a clinically-ready-since date, which would be one
// more segment source) adds to `delaySegments` without changing the grid.
import { bedIsOccupied, type Admission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";

/** Why a minute counts: a recorded hold-up, or past the expected date with none recorded. */
type DelayReason = { kind: "held-up"; blocker: string } | { kind: "past-expected" };

export type DelaySegment = { from: Instant; to: Instant; reason: DelayReason };

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Where the stay's own time ends: when the person left, or now while they are still in. */
function stayEnd(admission: Admission, now: Instant): Instant | null {
  if (finite(admission.leftAt)) return admission.leftAt;
  return bedIsOccupied(admission) ? now : null;
}

/** Recorded hold-ups with a known start and end, in time order, never overlapping each other. */
/** What a hold-up's end reads from a bed release: whose it is and when its hold-ups were cleared. */
type ReleaseClearances = Pick<BedRelease, "admissionId" | "clearedBlockHistory">;

function heldUpSegments(admission: Admission, releases: readonly ReleaseClearances[], end: Instant): DelaySegment[] {
  const records = [...(admission.stayBlockRecords ?? [])].filter((r) => finite(r.at)).sort((a, b) => a.at - b.at);
  if (records.length === 0) return [];
  const clearances = [
    ...(admission.stayBlockClearances ?? []).map((c) => c.at),
    ...releases
      .filter((release) => release.admissionId === admission.id)
      .flatMap((release) => (release.clearedBlockHistory ?? []).map((c) => c.at)),
  ].filter(finite);
  const segments: DelaySegment[] = [];
  records.forEach((record, index) => {
    const next = records[index + 1]?.at;
    const cleared = clearances.filter((at) => at > record.at).sort((a, b) => a - b)[0];
    const stillCurrent = index === records.length - 1 && admission.blockReason === record.blocker;
    const candidates = [next, cleared, stillCurrent ? end : undefined].filter(finite);
    if (candidates.length === 0) return;
    const to = Math.min(end, ...candidates);
    if (to > record.at) segments.push({ from: record.at, to, reason: { kind: "held-up", blocker: record.blocker } });
  });
  return segments;
}

/**
 * One stay's delayed time as non-overlapping segments, each with its reason. Recorded hold-ups first;
 * past the expected date fills the gaps between them.
 */
export function delaySegments(
  admission: Admission,
  releases: readonly ReleaseClearances[],
  now: Instant,
): DelaySegment[] {
  const arrived = admission.arrivedAt;
  const end = stayEnd(admission, now);
  if (!finite(arrived) || end === null || end <= arrived) return [];
  const held = heldUpSegments(admission, releases, end).map((segment) => ({
    ...segment,
    from: Math.max(segment.from, arrived),
  }));
  const segments = held.filter((segment) => segment.to > segment.from);
  const expected = admission.expectedDischargeAt;
  if (finite(expected)) {
    const setAt = admission.dischargeDateSetAt;
    let from = Math.max(expected, arrived, finite(setAt) ? setAt : -Infinity);
    for (const segment of [...segments]) {
      if (segment.to <= from) continue;
      if (segment.from > from) segments.push({ from, to: segment.from, reason: { kind: "past-expected" } });
      from = Math.max(from, segment.to);
    }
    if (from < end) segments.push({ from, to: end, reason: { kind: "past-expected" } });
  }
  return segments.filter((segment) => segment.to > segment.from).sort((a, b) => a.from - b.from);
}

type HeatmapRow = {
  unitId: string;
  name: string;
  /** Bed days lost per day, in the order of `DelayHeatmap.dayStarts`. */
  days: number[];
  total: number;
};

export type DelayHeatmap = {
  /** Midnight at the start of each day shown. */
  dayStarts: Instant[];
  /** Wards with any delayed time in the period, most first. */
  rows: HeatmapRow[];
  /** Wards in view with none, so the grid can say so rather than draw rows of zeros. */
  wardsWithNone: number;
  dayTotals: number[];
  total: number;
  /** The largest single cell, which tops the colour scale. */
  max: number;
};

/**
 * Bed days lost per ward per day for the `days` days starting at `start` (a midnight), counted up to
 * `now`. A day still under way counts only to now; a day after now counts nothing.
 */
export function delayedDischargeHeatmap(
  units: readonly Unit[],
  admissions: readonly Admission[],
  releases: readonly BedRelease[],
  start: Instant,
  now: Instant,
  days = 7,
): DelayHeatmap {
  const dayStarts = Array.from({ length: days }, (_, index) => start + index * MINUTES_PER_DAY);
  const minutes = new Map<string, number[]>();
  for (const admission of admissions) {
    if (!units.some((unit) => unit.id === admission.unitId)) continue;
    for (const segment of delaySegments(admission, releases, now)) {
      dayStarts.forEach((dayStart, index) => {
        const overlap = Math.min(segment.to, dayStart + MINUTES_PER_DAY, now) - Math.max(segment.from, dayStart);
        if (overlap <= 0) return;
        let row = minutes.get(admission.unitId);
        if (!row) minutes.set(admission.unitId, (row = Array<number>(days).fill(0)));
        row[index]! += overlap;
      });
    }
  }
  const toDays = (value: number) => Math.round((value / MINUTES_PER_DAY) * 10) / 10;
  const rows = units
    .flatMap((unit): HeatmapRow[] => {
      const row = minutes.get(unit.id);
      if (!row) return [];
      const cells = row.map(toDays);
      return [{ unitId: unit.id, name: unit.name, days: cells, total: toDays(row.reduce((a, b) => a + b, 0)) }];
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const dayTotals = dayStarts.map((_, index) =>
    toDays([...minutes.values()].reduce((sum, row) => sum + row[index]!, 0)),
  );
  const totalMinutes = [...minutes.values()].reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0);
  return {
    dayStarts,
    rows,
    wardsWithNone: units.length - rows.length,
    dayTotals,
    total: toDays(totalMinutes),
    max: Math.max(0, ...rows.flatMap((row) => row.days)),
  };
}

/** The colour step for a cell, 0 (none) to 4 (the period's largest), so one scale reads the grid. */
export function heatStep(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((value / max) * 4))) as 1 | 2 | 3 | 4;
}

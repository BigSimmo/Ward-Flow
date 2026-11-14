/**
 * Typed calendar days on a patient record move by whole days, the way timed records move by minutes
 * (mechanics and clock audit CC-4 and CC-5, 14 Nov 2026).
 *
 * A timed record is held as minutes from the board's day 0, so it moves with the day the board opens
 * on. A typed calendar day ("2026-11-04": a tribunal hearing, a care plan's agreed and review dates)
 * is held as written, so it does not. Two places put the two out of step, and both use this one rule:
 *   - seeding: sample days are written for a fixed day and moved to the seed's own day
 *     (`withSeedClockFaceRecords`), never fixed when the server process started;
 *   - loading a saved scenario file on a later day: its days move by the days since it was saved.
 *
 * A date of birth never moves: it is who the person is, not part of the scenario, and a seeded
 * person keeps the date of birth the bundle gives them. Only a real "YYYY-MM-DD" day moves; a
 * placeholder ("Typed text not kept on this device") or any other text is left exactly as it is.
 */
import type { Patient } from "./ward-patients";

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/u;
const MS_PER_DAY = 24 * 60 * 60_000;

/** The keys whose day is never moved. */
const FIXED_DAYS: ReadonlySet<string> = new Set(["dateOfBirth"]);

/** "2026-11-04" moved by whole days; anything that is not a real calendar day comes back unchanged. */
export function movedIsoDay(value: string, days: number): string {
  const match = ISO_DAY.exec(value);
  if (!match || days === 0) return value;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const written = new Date(Date.UTC(year, month - 1, day));
  if (written.getUTCFullYear() !== year || written.getUTCMonth() !== month - 1 || written.getUTCDate() !== day)
    return value;
  return new Date(written.getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Whole days from one Perth midnight to another (Perth keeps no daylight saving). */
export function wholeDaysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** Copied only where something moved: a seed walks every patient, and most hold no typed day. */
function moved(value: unknown, days: number): unknown {
  if (typeof value === "string") return value.length === 10 ? movedIsoDay(value, days) : value;
  if (Array.isArray(value)) {
    let next: unknown[] | undefined;
    value.forEach((entry, index) => {
      const after = moved(entry, days);
      if (after !== entry) (next ??= [...value])[index] = after;
    });
    return next ?? value;
  }
  if (value && typeof value === "object") {
    let next: Record<string, unknown> | undefined;
    for (const [key, entry] of Object.entries(value)) {
      const after = FIXED_DAYS.has(key) ? entry : moved(entry, days);
      if (after !== entry) (next ??= { ...value })[key] = after;
    }
    return next ?? value;
  }
  return value;
}

/**
 * Every typed calendar day on these patients, except dates of birth, moved by whole days. A record
 * with nothing to move is returned as the same object, so a seed pays only for the few that hold one.
 */
export function withPatientCalendarDaysMoved(patients: readonly Patient[], days: number): Patient[] {
  if (days === 0) return [...patients];
  return patients.map((patient) => moved(patient, days) as Patient);
}

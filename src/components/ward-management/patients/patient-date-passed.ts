/**
 * Root cause 2.3 (Josh approved, 13 Nov 2026): a date that can pass gets the same neutral "date
 * passed" wording the tribunal hearing date already has (`tribunalHearingPassedWithoutOutcome`),
 * instead of printing as if it were still ahead. Pure day comparison on Perth "YYYY-MM-DD" days.
 */

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/**
 * The calendar day a recorded date starts with, as "YYYY-MM-DD": an ISO day ("2026-11-04") or a
 * day written out ("4 Nov 2026, clinic"). Undefined when the text does not start with a real day,
 * so nothing is guessed.
 */
export function recordedDayIso(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})\b/u.exec(trimmed);
  const written = /^(\d{1,2}) ([A-Za-z]{3})[A-Za-z]* (\d{4})\b/u.exec(trimmed);
  let year: number;
  let month: number;
  let day: number;
  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (written) {
    const named = MONTHS[written[2]!.toLowerCase()];
    if (named === undefined) return undefined;
    [year, month, day] = [Number(written[3]), named, Number(written[1])];
  } else {
    return undefined;
  }
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return undefined;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * True when the recorded day is before today, false when it is today or later, and undefined when
 * the text holds no readable day (then nothing is said either way).
 */
export function recordedDayPassed(text: string | undefined, todayIso: string): boolean | undefined {
  const day = recordedDayIso(text);
  return day === undefined ? undefined : day < todayIso;
}

import {
  calendarDateOf,
  formatInstantWithDay,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * ACT PERIODS — SYNTHETIC DEMO ONLY, NOT LEGALLY CHECKED.
 *
 * Owner ruling, 4 October 2026 (Josh, item 13 thread: "Go ahead for act drafting task", then
 * "Ok I give permission"): the demo may count down Mental Health Act 2014 (WA) periods, labelled
 * as a synthetic demo that is not legally checked, using only periods with a written source. This
 * file is the ONLY place in the ward directory allowed to hold those periods and their section
 * references; both legal guards exempt exactly this file and its test, and nothing else.
 *
 * Sources (the draft Josh reviewed, "WA Mental Health Act time limits: draft for legal check"):
 *   - "act": the Act text. Where the section is in this repository's stored copy,
 *     `data/mha-2014-sections.source.json` (version 02-b0-01, as at 25 Sept 2025), it was checked
 *     there; s 44 is not in that copy and was read in the 2018 consolidation (01-g0-02) instead.
 *   - "guidance": WA government or Mental Health Tribunal guidance, not the Act text.
 *
 * Deliberately absent, because no reliable period was found for them: Forms 1B and 3D. Form 6D
 * (confirmation) and the community treatment order confirmation are prompts, not order periods. Never add a row from memory: that is how three invented durations
 * reached the screen before (see tests/ward-legal-figure-guard.test.ts).
 *
 * The typed expiry from the paper form (`legalForm.dueAt`) stays the record. This module never
 * writes a `dueAt`; it only shows, beside the record, what the period would give.
 */

type PeriodLength = { hours: number } | { days: number } | { months: number };

export type ActPeriod = {
  /** What the period runs from, in words. */
  from: string;
  adult: PeriodLength;
  /** Set only where a source states a different period for a person under 18. */
  under18?: PeriodLength;
  /** The section as the source cites it, or undefined where no source gives one. */
  section?: string;
  source: "act" | "guidance";
  /** A short qualification shown with the period, where the source adds one. */
  note?: string;
};

export const actPeriodsDemo: Readonly<Record<string, ActPeriod>> = {
  "1A": {
    from: "the referral is made",
    adult: { hours: 72 },
    section: "s 44",
    source: "act",
    note: "outside the metropolitan area it can be extended by a further 72 hours (s 45)",
  },
  "2": { from: "the order is made", adult: { hours: 6 }, section: "s 34(3)", source: "act" },
  "3A": { from: "the order is made", adult: { hours: 24 }, section: "s 28(1)", source: "act" },
  "3B": {
    from: "the continuation is made",
    adult: { hours: 24 },
    section: "s 28(2)",
    source: "act",
    note: "total detention no more than 72 hours, or 144 outside the metropolitan area (s 28(3))",
  },
  "3C": {
    from: "the person was received into the authorised hospital",
    adult: { hours: 72 },
    section: "s 55(3)",
    source: "act",
    note: "counted here from the written time on the form; cannot be extended (s 55(4))",
  },
  "4A": {
    from: "the order is made",
    adult: { hours: 72 },
    source: "guidance",
    note: "for a referred person it ends when the referral ends",
  },
  "4B": {
    from: "the first 72 hours end",
    adult: { hours: 72 },
    section: "s 152",
    source: "guidance",
    note: "outside the metropolitan area only",
  },
  "5A": { from: "the order is made", adult: { months: 3 }, section: "s 116", source: "guidance" },
  "5B": {
    from: "the current treatment period ends",
    adult: { months: 3 },
    section: "s 121(1)",
    source: "act",
    note: "counted here from the written time on the form",
  },
  "6A": { from: "the order is made", adult: { days: 21 }, under18: { days: 14 }, section: "s 87", source: "guidance" },
  "6B": { from: "the order is made", adult: { days: 21 }, under18: { days: 14 }, section: "s 87", source: "guidance" },
  "6C": {
    from: "the current detention period ends",
    adult: { months: 3 },
    under18: { days: 28 },
    section: "s 89(3)",
    source: "act",
    note: "counted here from the written time on the form",
  },
  "7D": {
    from: "the day the order is made",
    adult: { days: 14 },
    section: "s 100",
    source: "guidance",
    note: "cannot be extended",
  },
};

export const ACT_PERIOD_DEMO_LABEL = "Synthetic demo, not legally checked";

export function actPeriodFor(code: string): ActPeriod | undefined {
  return Object.prototype.hasOwnProperty.call(actPeriodsDemo, code) ? actPeriodsDemo[code] : undefined;
}

export function periodLengthText(length: PeriodLength): string {
  if ("hours" in length) return `${length.hours} hours`;
  if ("days" in length) return `${length.days} days`;
  return `${length.months} months`;
}

/** Perth is UTC+8 all year (no daylight saving), so its wall clock is a fixed shift from UTC. */
const perthUtcOffsetMs = 8 * 60 * 60_000;

/**
 * The instant a period ends. Months are counted on the Perth calendar, and a start on a day the
 * end month lacks (31 August plus 3 months) ends on that month's last day, never spilling over.
 */
export function addPeriod(start: Instant, length: PeriodLength, dayZero: Date): Instant {
  if ("hours" in length) return start + length.hours * 60;
  if ("days" in length) return start + length.days * 24 * 60;
  const begin = new Date(calendarDateOf(start, dayZero).getTime() + perthUtcOffsetMs);
  const targetMonth = begin.getUTCMonth() + length.months;
  const lastDay = new Date(Date.UTC(begin.getUTCFullYear(), targetMonth + 1, 0)).getUTCDate();
  const end = new Date(begin.getTime());
  end.setUTCDate(1);
  end.setUTCMonth(targetMonth);
  end.setUTCDate(Math.min(begin.getUTCDate(), lastDay));
  return start + Math.round((end.getTime() - begin.getTime()) / 60_000);
}

export type ActPeriodReading = {
  period: ActPeriod;
  /** When the adult period would end, or undefined when no written time is recorded to count from. */
  endsAt?: Instant;
  /** One plain sentence for the screen. Always carries the demo label. */
  text: string;
};

/**
 * What the Act period would give for this movement's current form. Counts from `formedAt`, the
 * time a person typed from the form, and from nothing else: no written time, no countdown.
 *
 * The engine records no age band for a form, so the countdown always uses the ADULT period, and
 * the sentence names the under-18 period beside it wherever a source gives a different one.
 */
export function actPeriodReading(movement: Movement, dayZero: Date): ActPeriodReading | undefined {
  const code = movement.legalForm?.code;
  if (code === undefined) return undefined;
  const period = actPeriodFor(code);
  if (!period) return undefined;
  const lengthText =
    period.under18 === undefined
      ? periodLengthText(period.adult)
      : `${periodLengthText(period.adult)} for an adult (${periodLengthText(period.under18)} under 18)`;
  const cite = period.section ?? "section not confirmed";
  const basis = period.source === "act" ? "Act text" : "WA guidance";
  const note = period.note ? `; ${period.note}` : "";
  const text = `${ACT_PERIOD_DEMO_LABEL}: ${lengthText} from when ${period.from} (${cite}, ${basis})${note}.`;
  const endsAt = movement.formedAt === undefined ? undefined : addPeriod(movement.formedAt, period.adult, dayZero);
  return { period, endsAt, text };
}

/** The countdown half of the sentence: when the period would end, or why there is no countdown. */
export function actPeriodCountdownText(reading: ActPeriodReading, now: Instant): string {
  if (reading.endsAt === undefined) return "No written time recorded on the form, so there is nothing to count from.";
  const ending = reading.period.under18 === undefined ? "Period would end" : "Adult period would end";
  const remaining = reading.endsAt - now;
  return remaining < 0
    ? `${ending} ${formatInstantWithDay(reading.endsAt, now)}, ${splitDuration(-remaining)} ago.`
    : `${ending} ${formatInstantWithDay(reading.endsAt, now)}, in ${splitDuration(remaining)}.`;
}

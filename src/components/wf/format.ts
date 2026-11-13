/**
 * v6 time formats (design-system-v6.md section 5). A colon only ever means clock time. Durations
 * carry units and go beside a direction word: waiting, in, left, overdue or ago.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * RC 2.5 (F-35, 13 Nov 2026): what a time since a start reads when the start is still in the
 * future, a mistyped arrival for example. It used to be clamped and read "0m", which looks like a
 * new arrival. The words are about the record, not the person. `ward-clock.ts` re-exports it.
 */
export const FUTURE_START_TEXT = "Start time is in the future";

/**
 * Duration in milliseconds as `43s`, `5m 03s`, `52m`, `7h 05m`, `5h` or `1d 2h`. A whole hour is the
 * plain age, `5h`, never `5h 00m` (v10 content rule, wardanswer chapter).
 *
 * RC 2.5 (F-35, 13 Nov 2026): a negative length keeps its sign, `-18m`, as `splitDuration` does. It
 * used to print its size, so a start still in the future read as a time already waited. A caller
 * that means "how far past" passes the size itself, as `Timer` does for "overdue".
 */
export function dur(ms: number): string {
  if (ms < 0) return `-${dur(-ms)}`;
  const v = ms;
  if (v < MINUTE) return `${Math.floor(v / 1000)}s`;
  if (v < 10 * MINUTE) return `${Math.floor(v / MINUTE)}m ${pad(Math.floor((v % MINUTE) / 1000))}s`;
  if (v < HOUR) return `${Math.floor(v / MINUTE)}m`;
  if (v < DAY) {
    const minutes = Math.floor((v % HOUR) / MINUTE);
    return minutes === 0 ? `${Math.floor(v / HOUR)}h` : `${Math.floor(v / HOUR)}h ${pad(minutes)}m`;
  }
  return `${Math.floor(v / DAY)}d ${Math.floor((v % DAY) / HOUR)}h`;
}

/** Duration in whole minutes, same format. */
export function durMinutes(minutes: number): string {
  return dur(minutes * MINUTE);
}

/** Perth is UTC+8 all year (Western Australia observes no daylight saving), as in ward-clock.ts. */
const PERTH_UTC_OFFSET = 8 * HOUR;

/**
 * 24 hour Perth (AWST) clock time, `HH:MM`, whatever the device's time zone. Every other Ward Flow
 * clock face and date is Perth, so a device-zone reading here would disagree with them (F-22).
 */
export function clk(at: Date | number): string {
  const perth = new Date((typeof at === "number" ? at : at.getTime()) + PERTH_UTC_OFFSET);
  return `${pad(perth.getUTCHours())}:${pad(perth.getUTCMinutes())}`;
}

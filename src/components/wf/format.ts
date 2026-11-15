import { WARD_TIME_ZONE, zoneOffsetMs } from "@/lib/ward-time-zone";

/**
 * v6 time formats (design-system-v6.md section 5). A colon only ever means clock time. Durations
 * carry units and go beside a direction word: waiting, in, left, overdue or ago.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const pad = (n: number) => String(n).padStart(2, "0");

/** RC 2.5 (F-35): the words for a start still in the future. The engine's clock keeps the same words
 * (`ward-clock.ts`); the kit may not import ward code, and a test holds the two copies equal. */
export const FUTURE_START_TEXT = "Start time is in the future";

/**
 * Duration in milliseconds as `43 s`, `5 min 03 s`, `52 min`, `7 h 05 min`, `5 h` or `1 d 2 h`. A whole hour is the
 * plain age, `5 h`, never `5 h 00 min` (v10 content rule, wardanswer chapter).
 *
 * RC 2.5 (F-35, 13 Nov 2026): a negative length keeps its sign, `-18 min`, as `splitDuration` does. It
 * used to print its size, so a start still in the future read as a time already waited. A caller
 * that means "how far past" passes the size itself, as `Timer` does for "overdue".
 */
export function dur(ms: number): string {
  if (ms < 0) return `-${dur(-ms)}`;
  const v = ms;
  if (v < MINUTE) return `${Math.floor(v / 1000)} s`;
  if (v < 10 * MINUTE) return `${Math.floor(v / MINUTE)} min ${pad(Math.floor((v % MINUTE) / 1000))} s`;
  if (v < HOUR) return `${Math.floor(v / MINUTE)} min`;
  if (v < DAY) {
    const minutes = Math.floor((v % HOUR) / MINUTE);
    return minutes === 0 ? `${Math.floor(v / HOUR)} h` : `${Math.floor(v / HOUR)} h ${pad(minutes)} min`;
  }
  return `${Math.floor(v / DAY)} d ${Math.floor((v % DAY) / HOUR)} h`;
}

/** Duration in whole minutes, same format. */
export function durMinutes(minutes: number): string {
  return dur(minutes * MINUTE);
}

/**
 * Perth (AWST) clock time on screen, am/pm ("2:05 pm"), whatever the device's time zone. Every other
 * Ward Flow clock face and date is Perth, so a device-zone reading here would disagree with them
 * (F-22). Item 13 (Josh, 14 Nov 2026): times on screen read am/pm, as `formatInstant` does.
 */
export function clk(at: Date | number): string {
  const ms = typeof at === "number" ? at : at.getTime();
  // The app's one time zone setting (`WARD_TIME_ZONE`, Perth by default), as in ward-clock.ts.
  const perth = new Date(ms + zoneOffsetMs(WARD_TIME_ZONE, ms));
  const hours = perth.getUTCHours();
  return `${hours % 12 === 0 ? 12 : hours % 12}:${pad(perth.getUTCMinutes())} ${hours < 12 ? "am" : "pm"}`;
}

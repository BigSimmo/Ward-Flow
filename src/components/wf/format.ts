/**
 * v6 time formats (design-system-v6.md section 5). A colon only ever means clock time. Durations
 * carry units and go beside a direction word: waiting, in, left, overdue or ago.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Duration in milliseconds as `43s`, `5m 03s`, `52m`, `7h 05m`, `5h` or `1d 2h`. A whole hour is the
 * plain age, `5h`, never `5h 00m` (v10 content rule, wardanswer chapter). Negative values use their size.
 */
export function dur(ms: number): string {
  const v = Math.abs(ms);
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

/** 24 hour clock time, `HH:MM`. */
export function clk(at: Date | number): string {
  const d = typeof at === "number" ? new Date(at) : at;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Splits a duration into number and unit parts so the unit can be set smaller (`4h 17m`). */
export function durParts(ms: number): { value: string; unit: string }[] {
  return dur(ms)
    .split(" ")
    .map((part) => {
      const match = /^(\d+)([a-z]+)$/.exec(part);
      return match ? { value: match[1], unit: match[2] } : { value: part, unit: "" };
    });
}

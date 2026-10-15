/**
 * Typed form times in Perth wall time, for Form times (`ward-form-times.tsx`). Moved here from the
 * retired MHA form calculator (Tools review, 15 Oct 2026) with no change in behaviour. These only
 * read and show a time a person typed. Nothing here computes a legal limit (rule D5).
 */

const perthDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Australia/Perth",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

function perthParts(date: Date): Record<string, string> {
  return Object.fromEntries(perthDateTime.formatToParts(date).map(({ type, value }) => [type, value]));
}

/** Formats a Date as en-AU date and time in AWST: "Fri, 25 Sep 2026, 17:00". */
export function formatStatutoryDateTime(d: Date): string {
  if (Number.isNaN(d.getTime())) return "Not recorded";
  const dayStr = d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Perth",
  });
  const timeStr = d.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Australia/Perth",
  });
  return `${dayStr}, ${timeStr}`;
}

export function toDateInputValue(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  const { year, month, day } = perthParts(d);
  return `${year}-${month}-${day}`;
}

export function toTimeInputValue(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  const { hour, minute } = perthParts(d);
  return `${hour}:${minute}`;
}

export function parseDateTimeInput(dateStr: string, timeStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr)) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = (timeStr || "00:00").split(":").map(Number);
  if (year < 100 || month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59) return null;
  // Perth observes UTC+08:00 throughout the year. Interpret the typed wall time there.
  const parsed = new Date(Date.UTC(year, month - 1, day, hours - 8, minutes));
  return toDateInputValue(parsed) === dateStr && toTimeInputValue(parsed) === (timeStr || "00:00") ? parsed : null;
}

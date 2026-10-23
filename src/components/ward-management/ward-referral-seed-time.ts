import { DEMONSTRATION_DAY_LABEL } from "./ward-sites";
import { formatInstantWithDay } from "./ward-clock";

const PERTH_OFFSET_MS = 8 * 60 * 60_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parse explicit ISO dates without accepting a device-local zone or normalising impossible dates. */
function explicitIsoTime(raw: unknown): number | undefined {
  if (typeof raw !== "string") return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/.exec(raw);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second, fraction, zone] = match;
  const at = Date.parse(raw);
  if (!Number.isFinite(at)) return undefined;
  const offset =
    zone === "Z" ? 0 : (zone![0] === "+" ? 1 : -1) * (Number(zone!.slice(1, 3)) * 60 + Number(zone!.slice(4, 6)));
  const local = new Date(at + offset * 60_000);
  if (
    local.getUTCFullYear() !== Number(year) ||
    local.getUTCMonth() + 1 !== Number(month) ||
    local.getUTCDate() !== Number(day) ||
    local.getUTCHours() !== Number(hour) ||
    local.getUTCMinutes() !== Number(minute) ||
    local.getUTCSeconds() !== Number(second ?? 0) ||
    local.getUTCMilliseconds() !== Number((fraction ?? "").padEnd(3, "0"))
  )
    return undefined;
  return at;
}

/** Explicit provenance must name an actual Perth midnight, not merely a parseable date. */
export function isSyntheticReferralTimelineBase(value: unknown): value is string {
  const at = explicitIsoTime(value);
  if (at === undefined) return false;
  const perth = new Date(at + PERTH_OFFSET_MS);
  return (
    perth.getUTCHours() === 0 &&
    perth.getUTCMinutes() === 0 &&
    perth.getUTCSeconds() === 0 &&
    perth.getUTCMilliseconds() === 0
  );
}

/** The sole canonical scenario day, expressed as an explicit Perth midnight. */
export function seededReferralTimelineBase(): string {
  const [day, month, year] = DEMONSTRATION_DAY_LABEL.split(" ");
  const monthIndex = MONTHS.indexOf(month!);
  const base = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${day?.padStart(2, "0")}T00:00:00+08:00`;
  if (!isSyntheticReferralTimelineBase(base)) throw new Error("Invalid canonical demonstration day");
  return base;
}

/**
 * Generated target times follow the demonstration's day zero only with explicit seed provenance.
 * User-entered unmarked timestamps retain their absolute calendar day. Neither input is mutated.
 */
export function formatReferralIntakeTime(
  raw: string | undefined,
  target: { syntheticTimelineBase?: string },
  dayZero: Date,
  relativeTo?: number,
): string {
  const at = explicitIsoTime(raw);
  if (at === undefined) return "Time not recorded";
  let displayed = at;
  if (target.syntheticTimelineBase !== undefined) {
    if (!isSyntheticReferralTimelineBase(target.syntheticTimelineBase) || !Number.isFinite(dayZero.getTime()))
      return "Time not recorded";
    displayed = dayZero.getTime() + (at - Date.parse(target.syntheticTimelineBase));
  }
  const date = new Date(displayed);
  if (!Number.isFinite(date.getTime())) return "Time not recorded";
  if (relativeTo !== undefined)
    return `${formatInstantWithDay((displayed - dayZero.getTime()) / 60_000, relativeTo)} AWST`;
  const dateWords = date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Perth",
  });
  const timeWords = date.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Australia/Perth",
  });
  return `${dateWords}, ${timeWords} AWST`;
}

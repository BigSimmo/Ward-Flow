/**
 * THE time zone Ward Flow runs on: every clock face, calendar day, day zero and written date, on the
 * public demo and the signed-in site, in the browser and in the backend's shared engine (which bundles
 * `ward-clock.ts`). Change this one value to move the whole app to another zone; nothing else names a
 * zone or a fixed UTC offset. It must be an IANA zone name ("Australia/Perth", "Australia/Sydney").
 *
 * AWST (Perth, UTC+8, no daylight saving) is the default (Josh, 14 Nov 2026: "link it automatically to
 * AWST (Perth time)"). Offsets are read from the zone's own rules (`zoneOffsetMs`), so a zone with
 * daylight saving gives the right offset on each date. The one copy is in the backend's config reader
 * (`backend/ward-flow/config.mjs`, plain JavaScript run with no build step), which
 * `backend/ward-flow/day-zero-rebase.test.mjs` holds equal to this one.
 *
 * Lives in `src/lib` so the wf kit's clock (`clk`) can read it too (the kit imports no ward code).
 */
export const WARD_TIME_ZONE = "Australia/Perth";

/** Offsets change only on a quarter hour of UTC, so one reading serves a whole quarter hour. */
const OFFSET_STEP_MS = 15 * 60_000;
const offsetsByZone = new Map<string, { parts: Intl.DateTimeFormat; offsets: Map<number, number> }>();

/**
 * How far `zone` is ahead of UTC at a real moment, in milliseconds (8 hours for AWST). Callers pass
 * `WARD_TIME_ZONE`. Read from the zone's own rules and cached per quarter hour, so frequent reads stay
 * cheap.
 */
export function zoneOffsetMs(zone: string, at: number): number {
  let known = offsetsByZone.get(zone);
  if (!known) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
    known = { parts, offsets: new Map() };
    offsetsByZone.set(zone, known);
  }
  const step = Math.floor(at / OFFSET_STEP_MS) * OFFSET_STEP_MS;
  const cached = known.offsets.get(step);
  if (cached !== undefined) return cached;
  const part = Object.fromEntries(
    known.parts.formatToParts(new Date(step)).map((piece) => [piece.type, Number(piece.value)]),
  );
  const offset = Date.UTC(part.year!, part.month! - 1, part.day!, part.hour!, part.minute!) - step;
  if (known.offsets.size > 4096) known.offsets.clear();
  known.offsets.set(step, offset);
  return offset;
}

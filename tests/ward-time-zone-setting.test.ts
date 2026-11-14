import { afterEach, describe, expect, it, vi } from "vitest";

import { seedWorld } from "../backend/ward-flow/engine";
import { parseDateTimeInput } from "../src/components/ward-management/tools/ward-form-time-input";
import {
  absoluteWallClockMinutes,
  demoDayZero,
  MINUTES_PER_DAY,
  perthMidnight,
  wardZonedLocalIso,
  wardZoneOffsetMs,
} from "../src/components/ward-management/ward-clock";
import { clk } from "../src/components/wf/format";
import { WARD_TIME_ZONE } from "../src/lib/ward-time-zone";

/**
 * Josh, 14 Nov 2026: "The clock should easily be able to be changed. However, please link it
 * automatically to AWST (Perth time), also ensure it is live and this is reflected in the demo."
 * The app's time zone is the one setting `WARD_TIME_ZONE`; the public demo's day zero and clock and
 * the signed-in engine's new worlds all read it. Run under TZ=UTC or TZ=Australia/Sydney too: the
 * device's own zone must not matter.
 */
const MOMENTS = ["2026-11-13T16:00:00Z", "2026-11-14T08:41:00Z", "2026-11-14T15:59:00Z", "2026-11-14T20:00:00Z"];

describe("the app's one time zone setting", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.doUnmock("@/lib/ward-time-zone");
    vi.resetModules();
  });

  it("defaults to AWST (Perth), UTC+8 on every date", () => {
    expect(WARD_TIME_ZONE).toBe("Australia/Perth");
    for (const at of ["2026-01-15T00:00:00Z", "2026-07-15T00:00:00Z", "2026-11-14T08:41:00Z"])
      expect(wardZoneOffsetMs(Date.parse(at))).toBe(8 * 3_600_000);
    expect(wardZonedLocalIso("2026-11-14T09:30")).toBe("2026-11-14T09:30+08:00");
  });

  it("puts the public demo's and the signed-in engine's day zero on the same Perth midnight", () => {
    for (const at of MOMENTS) {
      const moment = new Date(at);
      const perth = new Date(moment.getTime() + 8 * 3_600_000);
      const midnight = perthMidnight(perth.getUTCFullYear(), perth.getUTCMonth(), perth.getUTCDate());
      // The demo (`ward-flow-provider.tsx` adopts `demoDayZero(new Date())`).
      expect(demoDayZero(moment).toISOString()).toBe(midnight.toISOString());
      expect(midnight.toISOString().slice(11)).toBe("16:00:00.000Z");
      // A new signed-in world (`seedWorld`, D-150).
      expect(seedWorld(moment).dayZero).toBe(midnight.toISOString());
    }
  });

  it("runs the demo clock live on Perth time: now less day zero is the Perth clock face", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-14T08:41:00Z")); // 16:41 in Perth
    expect((Date.now() - demoDayZero(new Date()).getTime()) / 60_000).toBe(16 * 60 + 41);
    expect(absoluteWallClockMinutes() % MINUTES_PER_DAY).toBe(16 * 60 + 41);
    expect(clk(Date.now())).toBe("16:41");
  });

  it("moves every computation when the setting names another zone, daylight saving included", async () => {
    vi.resetModules();
    vi.doMock("@/lib/ward-time-zone", async (importOriginal) => ({
      ...(await importOriginal<typeof import("../src/lib/ward-time-zone")>()),
      WARD_TIME_ZONE: "Australia/Sydney",
    }));
    const clock = await import("../src/components/ward-management/ward-clock");
    const engine = await import("../backend/ward-flow/engine");
    const format = await import("../src/components/wf/format");
    const form = await import("../src/components/ward-management/tools/ward-form-time-input");

    // November is AEDT (UTC+11); July is AEST (UTC+10).
    expect(clock.wardZoneOffsetMs(Date.parse("2026-11-14T08:41:00Z"))).toBe(11 * 3_600_000);
    expect(clock.wardZoneOffsetMs(Date.parse("2026-07-01T05:00:00Z"))).toBe(10 * 3_600_000);
    const november = new Date("2026-11-14T08:41:00Z"); // 19:41 in Sydney
    expect(clock.demoDayZero(november).toISOString()).toBe("2026-11-13T13:00:00.000Z");
    expect(engine.seedWorld(november).dayZero).toBe("2026-11-13T13:00:00.000Z");
    expect(clock.demoDayZero(new Date("2026-07-01T05:00:00Z")).toISOString()).toBe("2026-06-30T14:00:00.000Z");
    expect(format.clk(november)).toBe("19:41");
    expect(clock.perthClockTime(november)).toBe("19:41");
    expect(clock.perthCalendarDay(new Date("2026-11-14T13:30:00Z"))).toMatchObject({ monthIndex: 10, day: 15 });
    // 4 Oct 2026: Sydney's clocks go forward at 02:00, so midnight is +10 and 09:00 is +11.
    expect(clock.perthMidnight(2026, 9, 4).toISOString()).toBe("2026-10-03T14:00:00.000Z");
    expect(clock.perthDateTimeLocal("2026-10-04T09:00")?.toISOString()).toBe("2026-10-03T22:00:00.000Z");
    expect(clock.wardZonedLocalIso("2026-11-14T09:30")).toBe("2026-11-14T09:30+11:00");
    expect(form.parseDateTimeInput("2026-11-14", "09:30")?.toISOString()).toBe("2026-11-13T22:30:00.000Z");

    // And the default module, untouched by the switch, still reads Perth.
    expect(parseDateTimeInput("2026-11-14", "09:30")?.toISOString()).toBe("2026-11-14T01:30:00.000Z");
  });
});

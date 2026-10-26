// Audit TC2-02 (time and clocks, 26 Oct 2026): a handover page left open across midnight re-read
// its chosen handover against the new day, so "new since" lay in the future and the page read
// "Nothing has changed". The page now holds the handover as the instant it meant when chosen.
import { describe, expect, it } from "vitest";

import {
  currentHeldHandover,
  defaultHandoverShift,
  handoverNewSince,
  heldHandoverCutoff,
  heldHandoverNewSince,
  holdHandover,
} from "@/components/ward-management/handover/handover-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const DAY = 24 * 60;
const midnight = NOW_ANCHOR - (NOW_ANCHOR % DAY);
const opened = midnight + 22 * 60 + 30; // 22:30, preparing the 23:00 handover
const afterMidnight = midnight + DAY + 2; // 00:02 the next day, page still open

describe("a handover page left open across midnight (audit TC2-02)", () => {
  const held = holdHandover(defaultHandoverShift(opened), opened);

  it("held the 23:00 handover when opened at 22:30", () => {
    expect(held).toEqual({ id: "ev", at: midnight + 23 * 60 });
  });

  it("is the case the audit found: read against the new day, new since lies in the future", () => {
    expect(handoverNewSince(held.id, afterMidnight)).toBeGreaterThan(afterMidnight);
  });

  it("keeps last night's 23:00 handover, with new since at 15:00 yesterday and due by 07:00 today", () => {
    const { at } = currentHeldHandover(held, afterMidnight);
    expect(at).toBe(midnight + 23 * 60);
    expect(heldHandoverNewSince(at, afterMidnight)).toBe(midnight + 15 * 60);
    expect(heldHandoverCutoff(at, afterMidnight)).toBe(midnight + DAY + 7 * 60);
  });

  it("never lets new since be later than now", () => {
    const tomorrowMorning = holdHandover("am", midnight + 23 * 60 + 30);
    expect(heldHandoverNewSince(tomorrowMorning.at, midnight + 23 * 60 + 30)).toBeLessThanOrEqual(
      midnight + 23 * 60 + 30,
    );
  });

  it("starts again from the next handover once the held one is more than a day away", () => {
    const muchLater = midnight + 3 * DAY + 10 * 60;
    expect(currentHeldHandover(held, muchLater)).toEqual(holdHandover(defaultHandoverShift(muchLater), muchLater));
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  arrivalsAxis,
  arrivedSinceStartOfDay,
  expectedArrival,
  pastWardEta,
} from "@/components/ward-management/officer/officer-screen-helpers";
import { createdEvent, historyLeadTitle } from "@/components/ward-management/patients/patient-history-tab";
import { clockTime, savedAtToast } from "@/components/ward-management/ward-saved-at-toast";

describe("WF-09 arrivals axis", () => {
  it("clamps to now +/-48h and bounds the tick count", () => {
    const now = 20_000;
    const axis = arrivalsAxis(now, [now - 8 * 1440 - 7 * 60, now + 30]);
    expect(axis.start).toBe(now - 48 * 60);
    expect(axis.end).toBe(now + 30);
    expect(axis.ticks.length).toBeLessThanOrEqual(13);
    expect(axis.left(now - 100 * 1440)).toBe("0%");
  });
  it("keeps hourly ticks for a short window", () => {
    const axis = arrivalsAxis(600, [660, 780]);
    expect(axis.ticks).toEqual([600, 660, 720, 780]);
  });
});

describe("WF-08 History counts an arrival by the time of the write", () => {
  it("counts a write stamped today or later, not an earlier day", () => {
    const now = 3 * 1440 + 600;
    expect(arrivedSinceStartOfDay(now, now)).toBe(true);
    expect(arrivedSinceStartOfDay(now + 8 * 1440, now)).toBe(true);
    expect(arrivedSinceStartOfDay(now - 1440, now)).toBe(false);
  });
});

describe("WF-49 created-by on the patient record", () => {
  it("names the desk and time it was added", () => {
    const e = createdEvent({ addedAt: 500, registrationScope: { kind: "ed", placeId: "ed-1" } }, () => undefined);
    expect(e).toEqual({ at: 500, tone: "neutral", text: "Record created by the ED" });
    const w = createdEvent({ addedAt: 9, registrationScope: { kind: "ward", placeId: "u1" } }, () => "Ward 4");
    expect(w?.text).toBe("Record created by Ward 4 (ward)");
    expect(createdEvent({}, () => undefined)).toBeUndefined();
  });

  it("does not head a creation-only history as a movement", () => {
    expect(historyLeadTitle(false, 1, true)).toBe("Record");
    expect(historyLeadTitle(false, 2, false)).toBe("Last movement");
    expect(historyLeadTitle(false, 0, false)).toBe("Ward stays");
    expect(historyLeadTitle(true, 1, true)).toBe("Current presentation");
  });
});

describe("overdue arrival follows a ward ETA only", () => {
  it("never reports a booking estimate as overdue", () => {
    const booked = { transport: { estimatedAt: 100 } } as unknown as Parameters<typeof pastWardEta>[0];
    expect(expectedArrival(booked)).toEqual({ at: 100, booked: true });
    expect(pastWardEta(booked, 10_000)).toBe(false);
    const ward = { arrivalDetails: { estimatedArrivalAt: 100 } } as unknown as Parameters<typeof pastWardEta>[0];
    expect(pastWardEta(ward, 10_000)).toBe(true);
  });
});

describe("WF-47 saved-at toast", () => {
  it("says what was saved and the HH:MM", () => {
    const push = vi.fn();
    const at = new Date(2026, 10, 5, 9, 7);
    savedAtToast({ push } as never, "Hold-up saved: Awaiting pharmacy", at);
    expect(push).toHaveBeenCalledWith({
      tone: "success",
      title: "Hold-up saved: Awaiting pharmacy",
      body: `Saved at ${clockTime(at)}`,
    });
    expect(clockTime(at)).toMatch(/^09:07$/);
  });
});

describe("WF-18 draft saved points to the Drafts list", () => {
  it("offers View drafts on the saved toast", async () => {
    const { noticeDraftKept } = await import("@/components/ward-management/referrals/referral-draft-saved-notice");
    const push = vi.fn(() => "t");
    // 09:07 on the Perth clock (CL-2): the time reads in Perth whatever the device zone.
    noticeDraftKept({ push }, true, new Date("2026-11-05T01:07:00Z"));
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Draft saved at 09:07",
        nextStep: { label: "View drafts", href: "/ward-flow/settings#you" },
      }),
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  hoursBreakdown,
  hoursText,
  medianStageMinutes,
  type HoursMovement,
} from "@/components/ward-management/ward-hours-breakdown";

/** Synthetic journey: instants are minutes from the demo's day zero. */
function journey(overrides: Partial<HoursMovement> = {}): HoursMovement {
  return {
    openedAt: 100,
    legalStatus: "Involuntary inpatient",
    ...overrides,
  } as HoursMovement;
}

const stage = (movement: HoursMovement, key: string, now = 2000) =>
  hoursBreakdown(movement, now).stages.find((item) => item.key === key)!;

describe("hoursBreakdown: where the hours went", () => {
  it("splits a fully recorded journey into its four stages", () => {
    const movement = journey({
      examination: { at: 160, outcome: "inpatient_order" } as HoursMovement["examination"],
      legalForm: { code: "1A" } as HoursMovement["legalForm"],
      legalFormReceivedAt: 220,
      referredAt: 230,
      acceptedAt: 500,
      leftDepartmentAt: 620,
    });
    const breakdown = hoursBreakdown(movement, 2000);
    expect(breakdown.open).toBe(false);
    expect(breakdown.totalMinutes).toBe(520);
    expect(breakdown.stages.map((item) => [item.key, item.status, item.minutes])).toEqual([
      ["review", "recorded", 60],
      ["form", "recorded", 60],
      ["bed", "recorded", 270],
      ["transport", "recorded", 120],
    ]);
    // 520 total, 510 in stages: the 10 minutes between the form and the referral are not named.
    expect(breakdown.otherMinutes).toBe(10);
    expect(breakdown.overlap).toBe(false);
  });

  it("says Not recorded for a missing boundary and never estimates", () => {
    const movement = journey({ referredAt: 300, acceptedAt: 400, leftDepartmentAt: 500 });
    const review = stage(movement, "review");
    expect(review.status).toBe("not_recorded");
    expect(review.minutes).toBeUndefined();
    expect(review.note).toBe("Review time not recorded");
    const form = stage(movement, "form");
    expect(form.status).toBe("not_recorded");
    expect(form.minutes).toBeUndefined();
    expect(stage(movement, "bed").minutes).toBe(100);
  });

  it("reports times recorded out of order instead of a negative figure", () => {
    const movement = journey({ referredAt: 400, acceptedAt: 300 });
    const bed = stage(movement, "bed");
    expect(bed.status).toBe("out_of_order");
    expect(bed.minutes).toBeUndefined();
    expect(bed.note).toBe("Accepted recorded before referred");
  });

  it("runs only the latest started stage of an open journey to now", () => {
    const movement = journey({
      examination: { at: 160, outcome: "inpatient_order" } as HoursMovement["examination"],
      referredAt: 200,
    });
    const breakdown = hoursBreakdown(movement, 1000);
    expect(breakdown.open).toBe(true);
    expect(breakdown.totalMinutes).toBe(900);
    const bed = breakdown.stages.find((item) => item.key === "bed")!;
    expect(bed).toMatchObject({ status: "running", minutes: 800 });
    // The form stage started earlier and has no end: its end was not recorded, it is not running.
    expect(breakdown.stages.find((item) => item.key === "form")!.status).toBe("not_recorded");
    expect(breakdown.stages.find((item) => item.key === "transport")!.status).toBe("not_recorded");
  });

  it("does not run a stage to now once the journey is closed", () => {
    const movement = journey({ referredAt: 200, closure: { at: 300 } as HoursMovement["closure"] });
    const breakdown = hoursBreakdown(movement, 1000);
    expect(breakdown.open).toBe(false);
    expect(breakdown.endAt).toBe(300);
    expect(stage(movement, "bed", 1000).status).toBe("not_recorded");
  });

  it("marks the form stage not needed when no form is on the record and the status needs none", () => {
    const movement = journey({ legalStatus: "Voluntary" as HoursMovement["legalStatus"] });
    expect(stage(movement, "form").status).toBe("not_needed");
  });

  it("gives no remainder when measured stages overlap", () => {
    const movement = journey({
      examination: { at: 160, outcome: "inpatient_order" } as HoursMovement["examination"],
      legalForm: { code: "1A" } as HoursMovement["legalForm"],
      legalFormReceivedAt: 400,
      referredAt: 200,
      acceptedAt: 300,
      leftDepartmentAt: 600,
    });
    const breakdown = hoursBreakdown(movement, 2000);
    expect(breakdown.overlap).toBe(true);
    expect(breakdown.otherMinutes).toBeUndefined();
  });

  it("formats elapsed minutes as hours", () => {
    expect(hoursText(45)).toBe("45m");
    expect(hoursText(125)).toBe("2h 05m");
    expect(hoursText(1440 + 180)).toBe("1d 3h");
  });

  it("takes the median of recorded stages across closed journeys only", () => {
    const closed = (bed: number) =>
      journey({ referredAt: 200, acceptedAt: 200 + bed, closure: { at: 2000 } as HoursMovement["closure"] });
    const rows = medianStageMinutes(
      [closed(60), closed(120), closed(300), journey({ referredAt: 0, acceptedAt: 9000 })],
      3000,
    );
    expect(rows.find((row) => row.key === "bed")).toMatchObject({ median: 120, journeys: 3 });
    expect(rows.find((row) => row.key === "review")).toMatchObject({ median: undefined, journeys: 0 });
  });
});

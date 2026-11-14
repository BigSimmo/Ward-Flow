import { describe, expect, it } from "vitest";

import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { involuntaryBedNeededForLegalStatus } from "@/components/ward-management/ward-eligibility";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { isDetained, isNotVoluntary } from "@/components/ward-management/ward-legal-meaning";
import type { LegalStatus } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * D-186 item 4: two named rules. The planned-admission booking view and the shortlist's legal form
 * prompt compared legal status by hand; they now use the named rules, with identical behaviour on
 * every status they can be given. The D-69 rule in `ward-eligibility.ts` is named in its comment and
 * deliberately not swapped (a blank status needs the bed there, and is not "not voluntary").
 */

const STATUSES: readonly LegalStatus[] = [
  "Voluntary",
  "Referred for psychiatric examination",
  "Detained awaiting examination",
  "Involuntary inpatient",
];

describe("the swapped comparisons behave exactly as before", () => {
  it("planned admissions: the locked-first statuses are the detained rule", () => {
    const lockedFirst: readonly LegalStatus[] = ["Involuntary inpatient", "Detained awaiting examination"];
    for (const status of STATUSES) expect(isDetained(status)).toBe(lockedFirst.includes(status));
    // A referral is not detained, so its booking does not take a locked bed first.
    expect(isDetained("Referred for psychiatric examination")).toBe(false);
  });

  it("shortlist: the legal form is asked for any chosen status other than Voluntary", () => {
    for (const status of [...STATUSES, undefined]) {
      const before = status !== undefined && status !== "Voluntary";
      expect(isNotVoluntary(status)).toBe(before);
    }
    // A referred person counts as not voluntary and not detained.
    expect(isNotVoluntary("Referred for psychiatric examination")).toBe(true);
  });
});

describe("the named rules decide at each site", () => {
  // A wholly open ward (no locked beds), so a booking read as Secure has no locked bed to take.
  const OPEN_WARD = "fre-adult-open";

  function convert(legalStatus: LegalStatus) {
    const booked = wardFlowReducer(seedWardFlowState(), {
      type: "BOOK_PLANNED_ADMISSION",
      role: "coordinator",
      now: NOW_ANCHOR,
      initials: "ab",
      sex: "Female",
      gender: "Female",
      reason: "respite",
      unitId: OPEN_WARD,
      expectedArrivalAt: NOW_ANCHOR + MINUTES_PER_DAY,
      expectedStayDays: 7,
      legalStatus,
      ageBand: "Adult",
      calendarDate: "2026-10-09",
    });
    expect(booked.rejections, legalStatus).toEqual([]);
    return wardFlowReducer(booked, {
      type: "CONVERT_PLANNED_ADMISSION",
      role: "coordinator",
      now: NOW_ANCHOR + 30,
      plannedAdmissionId: booked.plannedAdmissions.at(-1)!.id,
      unitId: OPEN_WARD,
    });
  }

  it.each(STATUSES)("planned admissions: a %s booking takes a locked bed first only when detained", (status) => {
    const refusal = convert(status).rejections.at(-1)?.reason ?? "";
    expect(refusal.includes("No locked bed is free"), refusal).toBe(isDetained(status));
  });

  it("the D-69 rule needs an involuntary-capable bed until a status is set, unlike isNotVoluntary", () => {
    for (const status of STATUSES) expect(involuntaryBedNeededForLegalStatus(status)).toBe(status !== "Voluntary");
    for (const blank of [undefined, null, "", "  "]) {
      expect(involuntaryBedNeededForLegalStatus(blank)).toBe(true);
      expect(isNotVoluntary(blank ?? undefined)).toBe(false);
    }
    expect(involuntaryBedNeededForLegalStatus(" Voluntary ")).toBe(false);
  });

  // The shortlist's legal form prompt is checked rendered in ward-clinical-d189-placement-legal-rules.dom.test.tsx;
  // no hand-written "not Voluntary" check is left in it (ward-clinical-source-guards.test.ts).
});

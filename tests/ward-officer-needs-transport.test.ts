import { describe, expect, it } from "vitest";

import { returnPlanBooking } from "@/components/ward-management/officer/officer-needs-transport";
import { BLANK_TRANSPORT_BOOKING } from "@/components/ward-management/transport/transport-booking-form";
import type { RepatriationRecord } from "@/components/ward-management/ward-flow-reducer";

// OA1 (Josh, 4 Nov 2026, question 5 option A): Log booking for an Out of area return opens with the
// coordinator's own return-plan answers. Synthetic values only.
const NOW = 10 * 24 * 60 + 9 * 60; // day 10, 09:00
const plan: RepatriationRecord = {
  admissionId: "adm-synthetic-1",
  at: NOW - 120,
  by: "coordinator",
  homeHospital: "RPH",
  receivingWardAgreed: true,
  mode: "road",
  provider: "Ambulance (St John)",
  cadNumber: "CAD-4821",
  transportLegalStatus: "involuntary",
  estimatedAt: NOW + 90,
  escortRequired: true,
};

describe("returnPlanBooking", () => {
  it("starts blank when there is no return plan", () => {
    expect(returnPlanBooking(undefined, NOW)).toEqual(BLANK_TRANSPORT_BOOKING);
  });

  it("carries the plan's provider, CAD, legal status, escort and depart time", () => {
    expect(returnPlanBooking(plan, NOW)).toEqual({
      provider: "Ambulance (St John)",
      cadNumber: "CAD-4821",
      transportLegalStatus: "involuntary",
      escortRequired: true,
      estimatedTime: "10:30",
      estimatedDay: "today",
    });
  });

  it("leaves a depart time already past blank", () => {
    const answers = returnPlanBooking({ ...plan, estimatedAt: NOW - 30 }, NOW);
    expect(answers.estimatedTime).toBe("");
    expect(answers.estimatedDay).toBeUndefined();
    expect(answers.cadNumber).toBe("CAD-4821");
  });

  it("keeps an unanswered escort unanswered", () => {
    const { escortRequired: _omit, ...noEscort } = plan;
    expect(returnPlanBooking(noEscort, NOW).escortRequired).toBeUndefined();
  });
});

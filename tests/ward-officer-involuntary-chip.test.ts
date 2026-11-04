import { describe, expect, it } from "vitest";

import { jobIsInvoluntary } from "@/components/ward-management/officer/officer-forms-pack";
import type { Movement } from "@/components/ward-management/ward-model";

// Deep audit (4 Nov 2026): the Involuntary chip read 0 beside jobs under Form 4C.
const job = (legalStatus: Movement["legalStatus"] | undefined, booked?: "voluntary" | "involuntary") =>
  ({ legalStatus, transport: booked ? { transportLegalStatus: booked } : {} }) as unknown as Movement;

describe("jobIsInvoluntary", () => {
  it("falls back to Legal now when the booking has no legal status", () => {
    expect(jobIsInvoluntary(job("Involuntary inpatient"))).toBe(true);
    expect(jobIsInvoluntary(job("Voluntary"))).toBe(false);
    expect(jobIsInvoluntary(job(undefined))).toBe(false);
  });

  it("lets the status recorded on the booking win", () => {
    expect(jobIsInvoluntary(job("Voluntary", "involuntary"))).toBe(true);
    expect(jobIsInvoluntary(job("Involuntary inpatient", "voluntary"))).toBe(false);
  });
});

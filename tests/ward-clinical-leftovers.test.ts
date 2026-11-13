import { describe, expect, it, vi } from "vitest";

import { patientStateTag } from "@/components/ward-management/patients/patient-glance";
import { TRANSPORT_EXCEPTION_STEP_LABELS } from "@/components/ward-management/ward-transport-checks";

/**
 * The held clinical PR's leftover items (13 Nov 2026), on synthetic records only:
 * - A recorded transport exception names the step it was taken at, never "Booked" for every step.
 * - A9-20(a): the patient-glance state tag says "Referral waiting for triage" instead of "Not active".
 * - D-189 item 5: iOS Safari does not turn the copy-only crisis numbers into call links.
 */

// The patient page's and the officer job's exception rows, and the patient page's state tag, are
// checked rendered (ward-clinical-d189-transport-legal-fit-to-travel.dom.test.tsx and
// ward-clinical-leftovers.dom.test.tsx), not by reading the source as text (CQ-10).

// The root layout's metadata reads the request headers, and its font loader runs only in Next's
// build; the test has neither.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/font/local", () => ({ default: () => ({ className: "font", variable: "font", style: {} }) }));

describe("a transport exception names its own step", () => {
  it("has one label per step", () => {
    expect(TRANSPORT_EXCEPTION_STEP_LABELS).toEqual({
      booked: "Booked",
      handover_ready: "Handover ready",
      collected: "Collected",
      arrived: "Arrived",
    });
  });
});

describe("A9-20(a): the state tag for a referral waiting for triage", () => {
  it("replaces Not active only", () => {
    expect(patientStateTag({ mode: "idle", communityActive: false, waitingForTriage: true })).toEqual({
      tag: "Referral waiting for triage",
      tone: "info",
    });
    expect(patientStateTag({ mode: "idle", communityActive: false }).tag).toBe("Not active");
  });

  it("leaves every other state as it was, the CTO included", () => {
    expect(patientStateTag({ mode: "cto", communityActive: true, waitingForTriage: true }).tag).toBe(
      "Community active",
    );
    expect(patientStateTag({ mode: "idle", communityActive: false, openWork: "bed", waitingForTriage: true }).tag).toBe(
      "In placement",
    );
    expect(
      patientStateTag({ mode: "idle", communityActive: false, openWork: "community", waitingForTriage: true }).tag,
    ).toBe("Referred");
    expect(patientStateTag({ mode: "ward", communityActive: false, waitingForTriage: true }).tag).toBe("Inpatient");
  });
});

describe("D-189 item 5: crisis numbers stay copy-only on iOS", () => {
  it("turns off telephone detection in the app metadata", async () => {
    const { generateMetadata } = await import("@/app/layout");
    expect((await generateMetadata()).formatDetection).toEqual({ telephone: false });
  });
});

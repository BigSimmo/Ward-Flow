import { describe, expect, it } from "vitest";

import WardPersonPage from "@/app/ward-flow/people/[patientId]/page";
import { WardMovementNotFound } from "@/components/ward-management/ward-management-console";

describe("patient route decoding", () => {
  it("recovers from malformed percent encoding without selecting a patient", async () => {
    const requestedId = "PT-%E0%A4%A";
    const page = await WardPersonPage({ params: Promise.resolve({ patientId: requestedId }) });

    expect(page.type).toBe(WardMovementNotFound);
    expect(page.props).toMatchObject({ requestedId, reason: "not-a-person-id" });
  });
});

describe("a UMRN in the patient address (D-39)", () => {
  it("does not resolve a UMRN-shaped id, and passes no UMRN on to the not-found page", async () => {
    const page = await WardPersonPage({ params: Promise.resolve({ patientId: "UM100023" }) });

    expect(page.type).toBe(WardMovementNotFound);
    expect(page.props).toEqual({ requestedId: "", reason: "not-a-person-id" });
    expect(JSON.stringify(page.props)).not.toContain("UM100023");
  });

  it("also refuses the real WA UMRN shape, one letter then seven digits, without quoting it", async () => {
    const page = await WardPersonPage({ params: Promise.resolve({ patientId: "A1234567" }) });

    expect(page.type).toBe(WardMovementNotFound);
    expect(page.props).toEqual({ requestedId: "", reason: "not-a-person-id" });
  });

  it("still refuses an id that is neither a UMRN nor an internal id", async () => {
    const page = await WardPersonPage({ params: Promise.resolve({ patientId: "nobody" }) });

    expect(page.type).toBe(WardMovementNotFound);
    expect(page.props).toMatchObject({ reason: "not-a-person-id" });
  });
});

import { describe, expect, it } from "vitest";

import WardPersonPage from "@/app/mockups/ward-flow/people/[patientId]/page";
import { PersonByUmrn } from "@/components/ward-management/patients/person-by-umrn";
import { WardMovementNotFound } from "@/components/ward-management/ward-management-console";

describe("patient route decoding", () => {
  it("recovers from malformed percent encoding without selecting a patient", async () => {
    const requestedId = "PT-%E0%A4%A";
    const page = await WardPersonPage({ params: Promise.resolve({ patientId: requestedId }) });

    expect(page.type).toBe(WardMovementNotFound);
    expect(page.props).toMatchObject({ requestedId, reason: "not-a-person-id" });
  });
});

describe("a UMRN in the patient address (shell-6)", () => {
  it("hands a UMRN-shaped id to the UMRN resolver instead of calling it not a record number", async () => {
    const page = await WardPersonPage({ params: Promise.resolve({ patientId: "UM100023" }) });

    expect(page.type).toBe(PersonByUmrn);
    expect(page.props).toMatchObject({ umrn: "UM100023", governed: false });
  });

  it("still refuses an id that is neither a UMRN nor an internal id", async () => {
    const page = await WardPersonPage({ params: Promise.resolve({ patientId: "nobody" }) });

    expect(page.type).toBe(WardMovementNotFound);
    expect(page.props).toMatchObject({ reason: "not-a-person-id" });
  });
});

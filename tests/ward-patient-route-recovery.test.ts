import { describe, expect, it } from "vitest";

import WardPersonPage from "@/app/mockups/ward-flow/people/[patientId]/page";
import { WardMovementNotFound } from "@/components/ward-management/ward-management-console";

describe("patient route decoding", () => {
  it("recovers from malformed percent encoding without selecting a patient", async () => {
    const requestedId = "PT-%E0%A4%A";
    const page = await WardPersonPage({ params: Promise.resolve({ patientId: requestedId }) });

    expect(page.type).toBe(WardMovementNotFound);
    expect(page.props).toMatchObject({ requestedId, reason: "not-a-person-id" });
  });
});

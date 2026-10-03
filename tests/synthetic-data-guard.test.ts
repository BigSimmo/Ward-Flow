import { describe, expect, it } from "vitest";
import { checkSyntheticPayload } from "@/lib/synthetic-data-guard";

describe("synthetic-data-guard", () => {
  it("passes valid synthetic clinical demonstration data", () => {
    const demoPayload = {
      patients: [
        {
          id: "P-101",
          name: "Patient Blue",
          age: 42,
          ward: "Ward 2K",
          legalStatus: "Voluntary",
          notes: "Admitted for observation. Stable.",
        },
      ],
      movements: [
        {
          id: "M-501",
          patientId: "P-101",
          destination: "Bentley Hospital",
          status: "pending",
        },
      ],
    };

    const result = checkSyntheticPayload(demoPayload);
    expect(result.safe).toBe(true);
  });

  it("detects real-looking Australian Medicare numbers", () => {
    const badPayload = {
      patientNotes: "Patient card details: 2123 45678 1 provided.",
    };

    const result = checkSyntheticPayload(badPayload);
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.reason).toContain("Medicare");
    }
  });

  it("detects Australian hospital UMRN / MRN record numbers", () => {
    const badPayload = {
      notes: "Previous admission record UMRN: 7654321 located.",
    };

    const result = checkSyntheticPayload(badPayload);
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.reason).toContain("hospital record number");
    }
  });

  it("detects Australian mobile phone numbers", () => {
    const badPayload = {
      contact: "Next of kin phone 0412 345 678 called.",
    };

    const result = checkSyntheticPayload(badPayload);
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.reason).toContain("telephone number");
    }
  });

  it("handles circular references gracefully without crashing", () => {
    const circularObj: Record<string, unknown> = { name: "Safe Patient" };
    circularObj.self = circularObj;

    const result = checkSyntheticPayload(circularObj);
    expect(result.safe).toBe(true);
  });

  it("fails closed when nesting exceeds the scan depth", () => {
    const deep: Record<string, unknown> = { note: "MRN 12345678" };
    let node = deep;
    for (let i = 0; i < 20; i++) {
      const next: Record<string, unknown> = {};
      node.child = next;
      node = next;
    }
    expect(checkSyntheticPayload(deep, 5).safe).toBe(false);
  });
});

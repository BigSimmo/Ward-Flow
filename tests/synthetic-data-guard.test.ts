import { describe, expect, it } from "vitest";
import { checkSyntheticPayload } from "@/lib/synthetic-data-guard";
import { redactCaptionIdentifiers } from "@/lib/privacy";

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

  it("detects hyphenated Australian hospital UMRN format UMRN-1234567", () => {
    const badPayload = {
      notes: "Transferred under UMRN-1234567 to Bentley.",
    };

    const result = checkSyntheticPayload(badPayload);
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.reason).toContain("hospital record number");
    }
  });

  it("detects numeric Medicare and UMRN identifiers in payload values", () => {
    const numericMedicare = {
      medicareNumber: 2123456781,
    };
    const result1 = checkSyntheticPayload(numericMedicare);
    expect(result1.safe).toBe(false);

    const numericUmrn = {
      UMRN: 7654321,
    };
    const result2 = checkSyntheticPayload(numericUmrn);
    expect(result2.safe).toBe(false);
  });

  it.each(["9876543210", 9876543210])("rejects ten-digit UMRN key-value identifiers (%s)", (umrn) => {
    const result = checkSyntheticPayload({ UMRN: umrn });
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.reason).toContain("hospital record number");
      expect(result.sample).not.toContain(String(umrn));
    }
  });

  it("rejects ten-digit UMRNs embedded in text", () => {
    const result = checkSyntheticPayload({ notes: "Record UMRN: 9876543210 found." });
    expect(result.safe).toBe(false);
    if (!result.safe) expect(result.reason).toContain("hospital record number");
  });

  it("passes the fictitious 5550 and 7010 landline ranges and still refuses a real number beside one", () => {
    // Audit E-06: the demo's own numbers (Settings profile, reference teams) are 08 5550 0xxx.
    for (const phone of ["08 5550 0142", "(08) 5550 0115", "08 7010 1234", "0855500108"])
      expect(checkSyntheticPayload({ referrer: { phone } }).safe, phone).toBe(true);
    const mixed = checkSyntheticPayload({ note: "Office 08 5550 0142, home 08 1234 5678" });
    expect(mixed.safe).toBe(false);
    if (!mixed.safe) expect(mixed.sample).toBe("08 1****");
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

  it("detects landlines outside WA and Medicare numbers with the card position digit (A4-1)", () => {
    for (const note of [
      "Sister on 02 9876 5432",
      "Call (03) 9123 4567",
      "Office 07 3123 4567",
      "Clinic +61 2 9876 5432",
      "Clinic +61 (3) 9123 4567",
      "Medicare 29501234561",
      "Medicare 2950 12345 6 1",
    ])
      expect(checkSyntheticPayload({ note }).safe, note).toBe(false);
    for (const phone of ["02 5550 0142", "(03) 7010 1234", "+61 7 5550 0100"])
      expect(checkSyntheticPayload({ referrer: { phone } }).safe, phone).toBe(true);
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

  it("redacts WA UMRN formats in redactCaptionIdentifiers", () => {
    expect(redactCaptionIdentifiers("Patient UMRN: 1234567 admitted")).toBe("Patient [id] admitted");
    expect(redactCaptionIdentifiers("Patient UMRN-1234567 admitted")).toBe("Patient [id] admitted");
    expect(redactCaptionIdentifiers("Patient UMRN1234567 admitted")).toBe("Patient [id] admitted");
  });

  it("detects real 8-digit UMRN values in record fields", () => {
    const payload = { umrn: "12345678" };
    const result = checkSyntheticPayload(payload);
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.reason).toContain("hospital record number");
    }
  });

  it("permits only the exact synthetic identifier shape the demo fixtures generate", () => {
    const payload = {
      umrn: "SYNTHETIC-12345678",
      notes: "Demo patient SYNTHETIC-87654321 admitted.",
      wardUmrn: "UM100093",
    };
    const result = checkSyntheticPayload(payload);
    expect(result.safe).toBe(true);
  });

  it("does not let a demo or synthetic word hide a real-looking identifier", () => {
    for (const note of [
      "call demo 0412 345 678",
      "Synthetic 2123456781",
      "demo UMRN-1234567",
      "DEMO-0412345678",
      "SYNTHETIC-UMRN-1234567",
    ]) {
      expect(checkSyntheticPayload({ note }).safe).toBe(false);
    }
  });
});

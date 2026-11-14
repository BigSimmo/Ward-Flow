import { describe, expect, it } from "vitest";

import { copiedText } from "@/components/ward-management/ward-clipboard";
import {
  MEDICATION_LIST_NOTE,
  handoverPackAvailable,
  handoverPackModel,
  handoverPackText,
  type HandoverPackInput,
} from "@/components/ward-management/patients/patient-handover-pack";

/** Synthetic only: an invented name and a synthetic UMRN. Instants are demo-clock minutes. */
function input(overrides: Partial<HandoverPackInput> = {}): HandoverPackInput {
  return {
    movement: {
      id: "WF-SYNTH-1",
      urgency: 2,
      legalStatus: "Involuntary inpatient",
      legalForm: { code: "1A" },
      acceptedUnitId: "U-SYNTH",
      acceptedAt: 600,
      closure: undefined,
      allocatedBed: 4,
      medicationChartDone: undefined,
    } as HandoverPackInput["movement"],
    patient: { name: "Testperson, Alex", umrn: "UM100001", ageSex: "41, female" },
    fromName: "Synthetic ED",
    wardName: "Synthetic Ward",
    riskFlags: ["aggression"],
    clearance: { cleared: true, at: 540 },
    paperExpiryAt: 900,
    edContacts: [{ name: "Synthetic ED", role: "Sending ED, nurse in charge", number: "(08) 0000 0001" }],
    careContacts: [],
    checklist: [
      { key: "medical_clearance", label: "Medical clearance", state: "done", detail: "Medically cleared" },
      { key: "contraband_search", label: "Contraband search", state: "outstanding", detail: "Not recorded" },
    ],
    now: 700,
    ...overrides,
  };
}

const section = (pack: ReturnType<typeof handoverPackModel>, id: string) =>
  pack.sections.find((item) => item.id === id)!;
const value = (pack: ReturnType<typeof handoverPackModel>, id: string, label: string) =>
  section(pack, id).rows.find((row) => row.label === label)?.value;

describe("handover pack model", () => {
  it("is offered only once a ward has accepted and the movement is open", () => {
    expect(handoverPackAvailable(undefined)).toBe(false);
    expect(handoverPackAvailable({ acceptedUnitId: undefined, closure: undefined, originEdId: "ED-SYNTH" })).toBe(
      false,
    );
    expect(handoverPackAvailable({ acceptedUnitId: "U-SYNTH", closure: undefined, originEdId: "ED-SYNTH" })).toBe(true);
    // A ward-to-ward transfer has no ED, so it is not an ED handover.
    expect(handoverPackAvailable({ acceptedUnitId: "U-SYNTH", closure: undefined, originEdId: undefined })).toBe(false);
    expect(
      handoverPackAvailable({
        acceptedUnitId: "U-SYNTH",
        originEdId: "ED-SYNTH",
        closure: { at: 1 } as HandoverPackInput["movement"]["closure"],
      }),
    ).toBe(false);
  });

  it("carries every section in order", () => {
    expect(handoverPackModel(input()).sections.map((item) => item.id)).toEqual([
      "patient",
      "legal",
      "risks",
      "clearance",
      "medication",
      "ed-contacts",
      "care-contacts",
      "outstanding",
    ]);
  });

  it("shows the paper expiry only as typed, never as a count", () => {
    const pack = handoverPackModel(input());
    const expiry = value(pack, "legal", "Paper expiry");
    expect(expiry).toMatch(/^End(s|ed) \S/);
    expect(expiry).not.toMatch(/as typed/); // D-218
    expect(expiry).not.toMatch(/\b\d+\s*[hm]\b|left|overdue|ago/);
    expect(value(handoverPackModel(input({ paperExpiryAt: undefined })), "legal", "Paper expiry")).toBe("Not recorded");
  });

  it("reuses the referral letter words for urgency, risks and clearance", () => {
    const pack = handoverPackModel(input());
    expect(value(pack, "patient", "Urgency")).toMatch(/^Tier 2/);
    expect(value(pack, "risks", "Risks")).toBe("Aggression");
    expect(value(pack, "clearance", "Medical clearance")).toMatch(/^Cleared, recorded /);
  });

  it("says Not recorded or Not shared rather than inventing risks", () => {
    expect(value(handoverPackModel(input({ riskFlags: undefined })), "risks", "Risks")).toBe("Not recorded");
    expect(value(handoverPackModel(input({ riskFlags: "not_shared" })), "risks", "Risks")).toBe(
      "Not shared with this desk",
    );
    expect(value(handoverPackModel(input({ riskFlags: [] })), "risks", "Risks")).toBe("None recorded on the referral");
    expect(value(handoverPackModel(input({ clearance: undefined })), "clearance", "Medical clearance")).toBe(
      "Not recorded",
    );
  });

  it("reads the medication chart state and says the app holds no medication list", () => {
    const words = (done: boolean | undefined) =>
      value(
        handoverPackModel(input({ movement: { ...input().movement, medicationChartDone: done } })),
        "medication",
        "Medication chart",
      );
    expect(words(true)).toBe("Ready for the ward");
    expect(words(false)).toBe("To follow");
    expect(words(undefined)).toBe("Not recorded");
    expect(section(handoverPackModel(input()), "medication").note).toBe(MEDICATION_LIST_NOTE);
  });

  it("lists contacts, Not recorded when none, and only outstanding checklist items", () => {
    const pack = handoverPackModel(input());
    expect(section(pack, "ed-contacts").rows[0].value).toBe("Synthetic ED · (08) 0000 0001");
    expect(section(pack, "care-contacts").rows).toEqual([{ label: "Contact", value: "Not recorded", missing: true }]);
    expect(section(pack, "outstanding").rows).toEqual([{ label: "Contraband search", value: "Not recorded" }]);
    const none = handoverPackModel(input({ checklist: [] }));
    expect(section(none, "outstanding").rows[0].value).toBe("Nothing outstanding on the record");
  });

  it("copies without the UMRN once it passes through the clipboard scrub", () => {
    const text = copiedText(handoverPackText(handoverPackModel(input()), "11:40 AWST"));
    expect(text.startsWith("Synthetic prototype.")).toBe(true);
    expect(text).not.toMatch(/UM\d{6}|UMRN/);
    expect(text).toContain("Paper expiry: ");
    expect(text).toContain("OUTSTANDING");
  });
});

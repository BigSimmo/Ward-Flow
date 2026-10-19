import { describe, expect, it } from "vitest";

import { previewFeedMessage, readFeedMessage } from "@/components/ward-management/integration/hospital-feed";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";

/** An invented ADT message in the HL7 version 2 shape, for the seeded synthetic person UM100001. */
function message({
  event = "A01",
  umrn = "UM100001",
  name = "HALLOWAY^TALIA",
  dob = "19880314",
  type = "ADT",
  patientClass = "I",
}: { event?: string; umrn?: string; name?: string; dob?: string; type?: string; patientClass?: string } = {}): string {
  return [
    `MSH|^~\\&|PAS|HOSP|WARDFLOW|NET|202610190830||${type}^${event}|MSG0001|P|2.4`,
    `EVN|${event}|202610190825`,
    `PID|1||${umrn}^^^HOSP^MR||${name}||${dob}|F`,
    `PV1|1|${patientClass}|MH4^12^B||||`,
  ].join("\r");
}

describe("readFeedMessage", () => {
  it("reads the event, record number, name, date of birth, location and time", () => {
    const result = readFeedMessage(message());
    expect(result).toEqual({
      ok: true,
      message: {
        event: "admitted",
        umrn: "UM100001",
        familyName: "HALLOWAY",
        givenName: "TALIA",
        dateOfBirth: "1988-03-14",
        patientClass: "I",
        location: { pointOfCare: "MH4", room: "12", bed: "B" },
        recordedAt: "202610190825",
      },
    });
  });

  it("refuses a record number that is not synthetic, whatever the event", () => {
    for (const umrn of ["1234567", "UM12345", "MRN100001", ""]) {
      expect(readFeedMessage(message({ umrn }))).toEqual({
        ok: false,
        reason: "Refused: the record number is not a synthetic UMnnnnnn number.",
      });
    }
    expect(readFeedMessage(message({ umrn: "1234567", event: "A99" })).ok).toBe(false);
  });

  it("refuses an event it does not handle, and text that is not an ADT message", () => {
    expect(readFeedMessage(message({ event: "A08" }))).toEqual({
      ok: false,
      reason: "Not read: event A08 is not one this seam handles.",
    });
    expect(readFeedMessage("hello").ok).toBe(false);
    expect(readFeedMessage(message({ type: "ORU" }))).toEqual({
      ok: false,
      reason: "Not read: message type ORU is not ADT.",
    });
  });
});

describe("previewFeedMessage", () => {
  const read = (text: string) => {
    const result = readFeedMessage(text);
    if (!result.ok) throw new Error(result.reason);
    return result.message;
  };

  it("matches a person by record number and reports no differences when the details agree", () => {
    expect(previewFeedMessage(read(message()), wardPatients)).toMatchObject({
      kind: "known_person",
      patientId: "PT-001",
      differences: [],
    });
  });

  it("lists name and date of birth differences rather than matching on them", () => {
    const preview = previewFeedMessage(read(message({ name: "HALLOWAY^TARA", dob: "19880341" })), wardPatients);
    expect(preview).toMatchObject({ kind: "known_person", patientId: "PT-001" });
    expect(preview.kind === "known_person" && preview.differences).toEqual([
      "Given name differs from the record",
      "Date of birth differs from the record",
    ]);
  });

  it("never matches by name alone: an unknown number with a known name is a new person", () => {
    const preview = previewFeedMessage(
      read(message({ umrn: "UM999999", event: "A04", patientClass: "E" })),
      wardPatients,
    );
    expect(preview).toEqual({
      kind: "new_person",
      action: "No person holds UM999999. Would suggest checking whether this person needs a bed request.",
    });
  });

  it("suggests a bed request check only for an emergency registration", () => {
    const outpatient = previewFeedMessage(
      read(message({ umrn: "UM999999", event: "A04", patientClass: "O" })),
      wardPatients,
    );
    expect(outpatient).toEqual({
      kind: "new_person",
      action: "No person holds UM999999. Would suggest nothing: this registration is not an emergency attendance.",
    });
  });
});

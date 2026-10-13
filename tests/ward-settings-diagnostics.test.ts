import { describe, expect, it, vi } from "vitest";
import {
  maskDiagnosticPatient,
  maskDiagnosticMovement,
  copySettingsDiagnostics,
} from "@/components/ward-management/settings/settings-screen";
import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";

describe("Settings Diagnostics Privacy Masking (WF-A4-10)", () => {
  it("masks patient given name, family name, preferred name and replaces UMRN digits with asterisks", () => {
    const rawPatient = {
      id: "P-12345",
      givenName: "Jane",
      familyName: "Doe",
      preferredName: "Janey",
      displayName: "Jane Doe",
      name: "Jane Doe",
      umrn: "UMRN-9876543",
      dateOfBirth: "1980-05-12",
    };

    const masked = maskDiagnosticPatient(rawPatient);

    expect(masked.givenName).toBe("[MASKED]");
    expect(masked.familyName).toBe("[MASKED]");
    expect(masked.preferredName).toBe("[MASKED]");
    expect(masked.displayName).toBe("[MASKED]");
    expect(masked.name).toBe("[MASKED]");
    expect(masked.umrn).toBe("UMRN-*******");
    expect(masked.dateOfBirth).toBe("1980-05-12");
  });

  it("masks movement patient name and patient UMRN", () => {
    const rawMovement = {
      id: "M-101",
      patientName: "John Smith",
      patientUmrn: "1234567",
      status: "waiting",
    };

    const masked = maskDiagnosticMovement(rawMovement);

    expect(masked.patientName).toBe("[MASKED]");
    expect(masked.patientUmrn).toBe("*******");
  });

  it("writes diagnostic JSON payload to navigator.clipboard with all patient names and MRNs masked", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const state = {
      configuration: defaultWardConfiguration(),
      movements: [
        {
          id: "M-101",
          patientName: "Alice Cooper",
          patientUmrn: "UMRN-1122334",
        },
      ],
      patients: [
        {
          id: "P-202",
          givenName: "Bob",
          familyName: "Marley",
          umrn: "9988776",
        },
      ],
    };

    const text = await copySettingsDiagnostics(state);

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(text).not.toContain("Alice Cooper");
    expect(text).not.toContain("Bob");
    expect(text).not.toContain("Marley");
    expect(text).not.toContain("1122334");
    expect(text).not.toContain("9988776");
    expect(text).toContain("[MASKED]");
    expect(text).toContain("UMRN-*******");
    expect(text).toContain("*******");
  });
});

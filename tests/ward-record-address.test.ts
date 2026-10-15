import { describe, expect, it } from "vitest";

import {
  decodeRecordAddress,
  encodeRecordAddress,
  recordIdFromAddress,
  recordIdFromParam,
} from "@/components/ward-management/shell/ward-record-address";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { UMRN_IN_ADDRESS } from "@/components/ward-management/ward-patients";

/** D-39 (15 October 2026): an address code that carries no record number. */
const seed = seedWardFlowState();
const SEEDED_IDS = [...seed.movements, ...seed.patients, ...seed.referrals, ...seed.admissions].map((r) => r.id);

describe("record address codes (D-39)", () => {
  it("round-trips every seeded journey, person, referral and stay id", () => {
    expect(SEEDED_IDS.length).toBeGreaterThan(50);
    const failed = SEEDED_IDS.filter((id) => decodeRecordAddress(encodeRecordAddress(id)) !== id);
    expect(failed).toEqual([]);
  });

  it("round-trips ids made while the app runs, with no lookup table", () => {
    for (const id of ["PT-A07", "AD-ARR-12", "WF-PA-3", "RF-DN-001", "PT-G-AD-FREA-09"]) {
      expect(decodeRecordAddress(encodeRecordAddress(id))).toBe(id);
    }
  });

  it("gives every record its own code", () => {
    expect(new Set(SEEDED_IDS.map(encodeRecordAddress)).size).toBe(new Set(SEEDED_IDS).size);
  });

  it("refuses a code whose check byte does not match", () => {
    const code = encodeRecordAddress("WF-005");
    const last = code.at(-1)!;
    const altered = code.slice(0, -2) + (code.at(-2) === "a" ? "b" : "a") + last;
    expect(decodeRecordAddress(altered)).toBeNull();
    expect(decodeRecordAddress("")).toBeNull();
    expect(decodeRecordAddress("WF-005")).toBeNull();
    expect(decodeRecordAddress("not-a-code")).toBeNull();
    expect(decodeRecordAddress(encodeRecordAddress("XX-1"))).toBeNull();
  });

  it("never carries a record prefix or the id's own digits", () => {
    const leaking = SEEDED_IDS.filter((id) => {
      const code = encodeRecordAddress(id);
      // A two-digit run can turn up by chance in a long code; three or more would be a real echo.
      const digits = id.match(/\d{3,}/gu) ?? [];
      return /(?:wf|pt|rf|ad)-/u.test(code) || code.includes("-") || digits.some((run) => code.includes(run));
    });
    expect(leaking).toEqual([]);
  });

  it("never looks like a UMRN, so the person route's UMRN refusal cannot catch a code", () => {
    expect(SEEDED_IDS.map(encodeRecordAddress).filter((code) => UMRN_IN_ADDRESS.test(code))).toEqual([]);
  });

  it("still accepts a raw id from an old link", () => {
    expect(recordIdFromAddress("WF-005")).toBe("WF-005");
    expect(recordIdFromAddress(encodeRecordAddress("WF-005"))).toBe("WF-005");
    expect(recordIdFromParam(null)).toBeNull();
    expect(recordIdFromParam("")).toBeNull();
    expect(recordIdFromParam(encodeRecordAddress("PT-001"))).toBe("PT-001");
  });
});

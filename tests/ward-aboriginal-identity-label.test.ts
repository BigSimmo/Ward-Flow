import { describe, expect, it } from "vitest";
import {
  ABORIGINAL_OR_TORRES_STRAIT_ISLANDER_STATUSES,
  aboriginalOrTorresStraitIslanderIdentityLabel,
} from "@/components/ward-management/ward-patient-aboriginal-status";

// M119 (master audit list, D-123): identity is shown exactly as recorded, never shortened into a
// different meaning. "Neither" and "Not stated" must show no identity label.
describe("Aboriginal or Torres Strait Islander identity label", () => {
  it("labels only the three statuses that record an identity, in their own words", () => {
    const labels = Object.fromEntries(
      ABORIGINAL_OR_TORRES_STRAIT_ISLANDER_STATUSES.map((status) => [
        status,
        aboriginalOrTorresStraitIslanderIdentityLabel(status),
      ]),
    );
    expect(labels).toEqual({
      "Aboriginal, not Torres Strait Islander": "Aboriginal",
      "Torres Strait Islander, not Aboriginal": "Torres Strait Islander",
      "Aboriginal and Torres Strait Islander": "Aboriginal and Torres Strait Islander",
      "Neither Aboriginal nor Torres Strait Islander": undefined,
      "Not stated": undefined,
    });
  });

  it("shows nothing for an empty, missing or unknown answer", () => {
    expect(aboriginalOrTorresStraitIslanderIdentityLabel(undefined)).toBeUndefined();
    expect(aboriginalOrTorresStraitIslanderIdentityLabel("")).toBeUndefined();
    expect(aboriginalOrTorresStraitIslanderIdentityLabel("Unknown")).toBeUndefined();
  });

  it("shows nothing for inherited object keys", () => {
    for (const key of ["toString", "__proto__", "constructor", "hasOwnProperty"]) {
      expect(aboriginalOrTorresStraitIslanderIdentityLabel(key)).toBeUndefined();
    }
  });
});

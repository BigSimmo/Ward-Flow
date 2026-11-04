import { describe, expect, it } from "vitest";
import { safeScreenReturn, authorisedScreenReturn } from "../src/components/ward-management/ward-screen-return";
import type { PlaceLookup } from "../src/components/ward-management/ward-role-access";

const places: PlaceLookup = {
  unitSiteCode: () => undefined,
  unitService: () => undefined,
  edSiteCode: () => undefined,
  edService: () => undefined,
  teamSlug: () => "synthetic-team",
};
describe("safe sign-in return", () => {
  it("keeps a screen but strips queries, hashes and all record addresses", () => {
    expect(safeScreenReturn("/ward-flow/alerts?person=SYNTHETIC_PRIVATE_SENTINEL#row")).toBe("/ward-flow/alerts");
    for (const path of [
      "https://foreign.invalid/ward-flow",
      "//foreign.invalid/ward-flow",
      "/ward-flow/patients/private",
      "/ward-flow/movements/private",
      "/ward-flow/ed/%2fprivate",
      "/ward-flow/unknown",
    ])
      expect(safeScreenReturn(path)).toBeUndefined();
  });
  it("rechecks the destination against the newly authenticated desk", () => {
    const access = { role: "ward" as const, scope: { kind: "ward" as const, unitIds: ["synthetic-ward"] } };
    expect(authorisedScreenReturn("/ward-flow/capacity", access, places)).toBe("/ward-flow/ward/synthetic-ward");
    expect(authorisedScreenReturn("/ward-flow/ward/other-ward", access, places)).toBe("/ward-flow/ward/synthetic-ward");
  });
});

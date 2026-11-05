import { afterEach, describe, expect, it, vi } from "vitest";
import {
  safeScreenReturn,
  authorisedScreenReturn,
  rememberScreenReturn,
  takeScreenReturn,
} from "../src/components/ward-management/ward-screen-return";
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

describe("remembered sign-out return", () => {
  afterEach(() => vi.unstubAllGlobals());
  function storage(refuseWrites = false) {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (refuseWrites) throw new Error("Synthetic quota denial");
        data.set(key, value);
      },
      removeItem: (key: string) => void data.delete(key),
    };
  }
  it("does not bring back a return that its session storage no longer holds", () => {
    const held = storage();
    vi.stubGlobal("sessionStorage", held);
    rememberScreenReturn("/ward-flow/alerts");
    held.data.clear();
    expect(takeScreenReturn()).toBeUndefined();
  });
  it("keeps the return in memory only when storage could not hold it, and gives it once", () => {
    vi.stubGlobal("sessionStorage", storage(true));
    rememberScreenReturn("/ward-flow/alerts?person=SYNTHETIC#row");
    expect(takeScreenReturn()).toBe("/ward-flow/alerts");
    expect(takeScreenReturn()).toBeUndefined();
  });
});

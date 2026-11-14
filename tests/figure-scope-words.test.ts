import { describe, expect, it } from "vitest";

import { figureScopeWords, NETWORK_SCOPE_WORD } from "@/components/ward-management/figures/figure-scope-words";
import type { WardAccessScope } from "@/components/ward-management/ward-role-access";

/** The scope word beside a figure: one word, never a sentence (R-FIGS-11, R-BEDS-5; D-220; 14 Nov wording rule). */

const STATEWIDE: WardAccessScope = { kind: "statewide" };

describe("figureScopeWords", () => {
  it("names the network, or the chosen service, on a statewide desk", () => {
    expect(figureScopeWords(STATEWIDE, null, "desk")).toBe(NETWORK_SCOPE_WORD);
    expect(figureScopeWords(STATEWIDE, "East Metro", "desk")).toBe("EMHS");
    expect(figureScopeWords({ kind: "service", service: "North Metro" }, null, "desk")).toBe("NMHS");
  });

  it("names the desk's own place on a site, ward, ED or team desk", () => {
    expect(figureScopeWords({ kind: "site", siteCode: "RPH" }, null, "desk")).toBe("RPH");
    expect(figureScopeWords({ kind: "ward", unitIds: ["u1"] }, null, "desk", { ward: "Dabakarn" })).toBe("Dabakarn");
    expect(figureScopeWords({ kind: "ward", unitIds: ["u1"] }, null, "desk")).toBe("Ward");
    expect(figureScopeWords({ kind: "ed", edId: "e1" }, null, "desk", { ed: "Armadale" })).toBe("Armadale");
    expect(figureScopeWords({ kind: "team", teamName: "Midland" }, null, "desk")).toBe("Midland");
    expect(figureScopeWords({ kind: "jobs" }, null, "desk")).toBe(NETWORK_SCOPE_WORD);
    expect(figureScopeWords({ kind: "jobs", service: "South Metro" }, null, "desk")).toBe("SMHS");
  });

  it("keeps a network figure network-wide on every desk, and gives a patient figure no word", () => {
    expect(figureScopeWords({ kind: "site", siteCode: "RPH" }, "East Metro", "network")).toBe(NETWORK_SCOPE_WORD);
    expect(figureScopeWords({ kind: "site", siteCode: "RPH" }, null, "patient")).toBe("");
  });

  it("names one place for a ward, ED or team figure on any desk", () => {
    expect(figureScopeWords(STATEWIDE, null, "ward", { ward: "Dabakarn" })).toBe("Dabakarn");
    expect(figureScopeWords(STATEWIDE, null, "ward")).toBe("Ward");
    expect(figureScopeWords(STATEWIDE, null, "ed")).toBe("ED");
    expect(figureScopeWords(STATEWIDE, null, "team")).toBe("Team");
    expect(figureScopeWords({ kind: "team", teamName: "Midland" }, null, "team")).toBe("Midland");
  });

  it("is always one word", () => {
    const scopes: WardAccessScope[] = [
      STATEWIDE,
      { kind: "service", service: "WACHS" },
      { kind: "site", siteCode: "RPH" },
      { kind: "ward", unitIds: [] },
      { kind: "ed", edId: "e1" },
      { kind: "team", teamName: "Midland" },
      { kind: "jobs" },
    ];
    for (const scope of scopes) {
      for (const kind of ["network", "desk", "ward", "ed", "service", "team"] as const) {
        expect(figureScopeWords(scope, null, kind)).toMatch(/^\S+$/);
      }
    }
  });

  it("follows the chosen service for a service figure", () => {
    expect(figureScopeWords(STATEWIDE, null, "service")).toBe(NETWORK_SCOPE_WORD);
    expect(figureScopeWords(STATEWIDE, "CAHS", "service")).toBe("CAHS");
  });
});

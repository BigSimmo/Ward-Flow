import { describe, expect, it } from "vitest";
import { selectFoldGate } from "../scripts/ward-flow/select-fold-gate.mjs";

describe("Ward fold gate selection", () => {
  it("keeps policy and documentation changes static", () => {
    expect(selectFoldGate(["AGENTS.md", "docs/ward-flow/README.md"]).tier).toBe("static");
  });

  it("checks a queue script and its tests without selecting the full suite", () => {
    expect(selectFoldGate(["scripts/ward-flow/trial-merge.mjs", "tests/ward-trial-merge.test.ts"])).toEqual({
      tier: "focused",
      typecheck: false,
      journeys: false,
      reason: "local tooling contract",
    });
  });

  it("checks a Ward screen and its browser journey", () => {
    expect(selectFoldGate(["src/components/ward-management/alerts/alerts-screen.tsx"])).toEqual({
      tier: "focused",
      typecheck: true,
      journeys: true,
      reason: "Ward screen or route",
    });
  });

  it("does not type-check a CSS-only screen change", () => {
    expect(selectFoldGate(["src/components/ward-management/alerts/alerts-screen.module.css"])).toMatchObject({
      tier: "focused",
      typecheck: false,
      journeys: true,
    });
  });

  it("keeps shared engine, test discovery, and unknown changes broad", () => {
    for (const file of [
      "src/components/ward-management/ward-flow-reducer.ts",
      "src/components/ward-management/ward-derivations.ts",
      "vitest.config.mts",
      "scripts/check-ward-expected-reds.mjs",
      "src/unknown.ts",
    ]) {
      expect(selectFoldGate([file]).tier, file).toBe("full");
    }
  });

  it("does not request browser journeys for test discovery changes", () => {
    expect(selectFoldGate(["scripts/check-ward-expected-reds.mjs"])).toMatchObject({
      tier: "full",
      journeys: false,
    });
  });

  it("uses focused contracts for the READY helper", () => {
    expect(selectFoldGate(["scripts/ward-flow/ready-check.mjs", "tests/ward-select-fold-gate.test.ts"])).toMatchObject({
      tier: "focused",
      typecheck: false,
      journeys: false,
    });
  });

  it("keeps a mixed policy and local tooling batch focused", () => {
    expect(
      selectFoldGate([
        "AGENTS.md",
        "docs/ward-flow/decisions.md",
        "scripts/ward-flow/ready-check.mjs",
        "scripts/ward-flow/run-slot.mjs",
        "scripts/ward-flow/select-fold-gate.mjs",
        "tests/ward-select-fold-gate.test.ts",
      ]),
    ).toMatchObject({ tier: "focused", typecheck: false, journeys: false });
  });

  it("fails closed for executable and test deletions but permits documentation removal", () => {
    expect(selectFoldGate([{ status: "D", path: "tests/ward-trial-merge.test.ts" }]).tier).toBe("full");
    expect(selectFoldGate([{ status: "D", path: "docs/ward-flow/old.md" }]).tier).toBe("static");
  });
});

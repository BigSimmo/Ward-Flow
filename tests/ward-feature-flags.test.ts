import { describe, expect, it } from "vitest";

import {
  WARD_FEATURE_FLAG_NAMES,
  WARD_FEATURE_FLAGS,
  parseStoredWardFeatureFlags,
  parseWardFeatureFlagList,
  resolveWardFeatureFlags,
  wardEnvironment,
  wardSafeguardsLocked,
} from "@/components/ward-management/ward-feature-flags";
import { WARD_NAV } from "@/components/ward-management/ward-nav";

const flag = (resolved: ReturnType<typeof resolveWardFeatureFlags>, name: string) =>
  resolved.find((entry) => entry.name === name)!;

describe("the feature flag registry", () => {
  it("gives every flag an owner, a date, a description, a removal note and a default per environment", () => {
    for (const name of WARD_FEATURE_FLAG_NAMES) {
      const definition = WARD_FEATURE_FLAGS[name];
      expect(definition.owner, name).not.toBe("");
      expect(definition.added, name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(definition.description.length, name).toBeGreaterThan(10);
      expect(definition.removeWhen.length, name).toBeGreaterThan(10);
      expect(Object.keys(definition.defaults).sort(), name).toEqual(["demo", "development", "production"]);
    }
  });

  it("only names registered flags on navigation entries", () => {
    for (const item of WARD_NAV) {
      if (item.flag) expect(WARD_FEATURE_FLAG_NAMES).toContain(item.flag);
    }
  });
});

describe("wardEnvironment", () => {
  it("uses the named environment, else development locally and demo when deployed", () => {
    expect(wardEnvironment("production", "production")).toBe("production");
    expect(wardEnvironment(" Demo ", "development")).toBe("demo");
    expect(wardEnvironment(undefined, "development")).toBe("development");
    expect(wardEnvironment(undefined, "production")).toBe("demo");
    expect(wardEnvironment("staging", "production")).toBe("demo");
  });
});

describe("parsing overrides", () => {
  it("reads the server list and demo link forms, skipping unknown names and values", () => {
    expect(parseWardFeatureFlagList("bed-meeting-tv=off, demo-reset:on")).toEqual({
      "bed-meeting-tv": false,
      "demo-reset": true,
    });
    expect(parseWardFeatureFlagList("made-up=on,bed-meeting-tv=maybe")).toEqual({});
    expect(parseWardFeatureFlagList(undefined)).toEqual({});
  });

  it("keeps only registered names with a true or false value from storage", () => {
    expect(parseStoredWardFeatureFlags('{"bed-meeting-tv":false,"other":true,"demo-reset":"yes"}')).toEqual({
      "bed-meeting-tv": false,
    });
    expect(parseStoredWardFeatureFlags("not json")).toEqual({});
    expect(parseStoredWardFeatureFlags("[true]")).toEqual({});
  });
});

describe("resolveWardFeatureFlags", () => {
  it("turns every finished feature on in all environments (Josh, 20 Oct 2026), leaving only the held-back flags off", () => {
    const allOn = [
      "bed-meeting-tv",
      "referral-opened-receipts",
      "referral-information-needs",
      "ward-closure-mode",
      "shift-confirmations",
      "bed-meeting-actions",
      "pilot-measures",
      "missed-requests-check",
      "awol-bed-hold-review",
      "top25-criteria-led-discharge",
    ] as const;
    for (const environment of ["development", "demo", "production"] as const) {
      const resolved = resolveWardFeatureFlags({ environment, server: {}, device: {} });
      for (const name of allOn) expect(flag(resolved, name), `${name} in ${environment}`).toMatchObject({ on: true });
    }
    expect(
      flag(resolveWardFeatureFlags({ environment: "development", server: {}, device: {} }), "role-access").on,
    ).toBe(false);
    expect(flag(resolveWardFeatureFlags({ environment: "demo", server: {}, device: {} }), "role-access").on).toBe(true);
    const production = resolveWardFeatureFlags({ environment: "production", server: {}, device: {} });
    expect(production.filter((entry) => !entry.on).map((entry) => entry.name)).toEqual([
      "demo-reset",
      "make-room-chains",
    ]);
  });

  it("keeps demo reset off on the live site, which runs as demo, and on for a local build (Josh, 20 Oct 2026)", () => {
    const at = (environment: "development" | "demo" | "production") =>
      flag(resolveWardFeatureFlags({ environment, server: {}, device: {} }), "demo-reset").on;
    expect(at("development")).toBe(true);
    expect(at("demo")).toBe(false);
    expect(at("production")).toBe(false);
    // Make room plans stay a local-build mockup.
    const makeRoom = (environment: "development" | "demo" | "production") =>
      flag(resolveWardFeatureFlags({ environment, server: {}, device: {} }), "make-room-chains").on;
    expect([makeRoom("development"), makeRoom("demo"), makeRoom("production")]).toEqual([true, false, false]);
  });

  it("keeps role access on in production whatever the server setting says (review item 14)", () => {
    const resolved = resolveWardFeatureFlags({
      environment: "production",
      server: { "role-access": false },
      device: { "role-access": false },
    });
    expect(flag(resolved, "role-access")).toMatchObject({ on: true, source: "default", deviceCanChange: false });
    // Outside production the switch still works, so a demonstration can show the whole view.
    expect(
      flag(
        resolveWardFeatureFlags({ environment: "demo", server: { "role-access": false }, device: {} }),
        "role-access",
      ).on,
    ).toBe(false);
  });

  it("locks safeguards on in a deployed build that names no environment (audit F-20)", () => {
    expect(wardSafeguardsLocked(undefined, "production")).toBe(true);
    expect(wardSafeguardsLocked("staging", "production")).toBe(true);
    expect(wardSafeguardsLocked("production", "production")).toBe(true);
    expect(wardSafeguardsLocked(" Demo ", "production")).toBe(false);
    expect(wardSafeguardsLocked(undefined, "development")).toBe(false);
    const unnamed = resolveWardFeatureFlags({
      environment: wardEnvironment(undefined, "production"),
      safeguardsLocked: wardSafeguardsLocked(undefined, "production"),
      server: { "role-access": false },
      device: { "role-access": false, "bed-meeting-tv": true },
    });
    expect(flag(unnamed, "role-access")).toMatchObject({ on: true, source: "default", deviceCanChange: false });
    // Everything else still behaves as a demo build.
    expect(flag(unnamed, "bed-meeting-tv")).toMatchObject({ on: true, source: "device", deviceCanChange: true });
  });

  it("lets the device beat the server, and the server beat the default", () => {
    const resolved = resolveWardFeatureFlags({
      environment: "demo",
      server: { "bed-meeting-tv": false, "demo-reset": false },
      device: { "demo-reset": true },
    });
    expect(flag(resolved, "bed-meeting-tv")).toMatchObject({ on: false, source: "server" });
    expect(flag(resolved, "demo-reset")).toMatchObject({ on: true, source: "device" });
  });

  it("ignores the device in production, where only the server decides", () => {
    const resolved = resolveWardFeatureFlags({
      environment: "production",
      server: { "bed-meeting-tv": true },
      device: { "bed-meeting-tv": false, "demo-reset": true },
    });
    expect(flag(resolved, "bed-meeting-tv")).toMatchObject({ on: true, source: "server", deviceCanChange: false });
    expect(flag(resolved, "demo-reset")).toMatchObject({ on: false, source: "default" });
  });
});

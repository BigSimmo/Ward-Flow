import { describe, expect, it } from "vitest";

import {
  WARD_FEATURE_FLAG_NAMES,
  WARD_FEATURE_FLAGS,
  parseStoredWardFeatureFlags,
  parseWardFeatureFlagList,
  resolveWardFeatureFlags,
  wardEnvironment,
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
  it("defaults both new features on for development and demo, off for production", () => {
    for (const environment of ["development", "demo"] as const) {
      const resolved = resolveWardFeatureFlags({ environment, server: {}, device: {} });
      expect(flag(resolved, "bed-meeting-tv")).toMatchObject({ on: true, source: "default" });
      expect(flag(resolved, "demo-reset")).toMatchObject({ on: true, source: "default" });
    }
    const production = resolveWardFeatureFlags({ environment: "production", server: {}, device: {} });
    // D-65 (17 Oct 2026): Josh switched criteria led discharge on in production and kept its flag,
    // so it can still be switched off. Every other flag stays off there until it is removed (D-62).
    const onInProduction = production.filter((entry) => entry.on).map((entry) => entry.name);
    expect(onInProduction).toEqual(["top25-criteria-led-discharge"]);
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

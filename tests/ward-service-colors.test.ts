import { describe, expect, it } from "vitest";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import {
  WA_HEALTH_SERVICES_COLOR_KEY,
  getHealthServiceColorDefinition,
  getHealthServiceBadgeStyle,
  getHealthServiceDotStyle,
} from "@/components/ward-management/ward-service-colors";

describe("WA Health Services Color Key & Brand Specification", () => {
  it("covers every declared HealthService in the application model", () => {
    for (const service of HEALTH_SERVICES) {
      const def = getHealthServiceColorDefinition(service);
      expect(def).toBeDefined();
      expect(def.brandHex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(def.dotColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(def.light.bg).toBeDefined();
      expect(def.light.border).toBeDefined();
      expect(def.light.ink).toBeDefined();
    }
  });

  it("allocates the verified official brand colors for Western Australia HSPs", () => {
    // East Metro (EMHS) -> Primary Green #00825e (from EMHS.css)
    const emhs = getHealthServiceColorDefinition("East Metro");
    expect(emhs.code).toBe("EMHS");
    expect(emhs.brandHex.toLowerCase()).toBe("#00825e");

    // North Metro (NMHS) -> Primary Red #990057 (from NMHS.css)
    const nmhs = getHealthServiceColorDefinition("North Metro");
    expect(nmhs.code).toBe("NMHS");
    expect(nmhs.brandHex.toLowerCase()).toBe("#990057");

    // South Metro (SMHS) -> Primary Purple #5a2476 (from SMHS.css)
    const smhs = getHealthServiceColorDefinition("South Metro");
    expect(smhs.code).toBe("SMHS");
    expect(smhs.brandHex.toLowerCase()).toBe("#5a2476");

    // WA Country Health Service (WACHS) -> Primary Blue #005b94 (from WACHS.css)
    const wachs = getHealthServiceColorDefinition("WACHS");
    expect(wachs.code).toBe("WACHS");
    expect(wachs.brandHex.toLowerCase()).toBe("#005b94");

    // Child & Adolescent Health Service (CAHS) -> Primary Blue #0076be (from CAHS.css)
    const cahs = getHealthServiceColorDefinition("CAHS");
    expect(cahs.code).toBe("CAHS");
    expect(cahs.brandHex.toLowerCase()).toBe("#0076be");

    // Statewide -> WA Health Blue / Coordination
    const statewide = getHealthServiceColorDefinition("Statewide");
    expect(statewide.code).toBe("STATEWIDE");
    expect(statewide.brandHex.toLowerCase()).toBe("#0071a5");
  });

  it("returns appropriate badge and dot styles using CSS variables", () => {
    const badgeStyle = getHealthServiceBadgeStyle("North Metro");
    expect(badgeStyle.backgroundColor).toContain("--svc-north-bg");
    expect(badgeStyle.borderColor).toContain("--svc-north-border");
    expect(badgeStyle.color).toContain("--svc-north-ink");

    const dotStyle = getHealthServiceDotStyle("North Metro");
    expect(dotStyle.backgroundColor).toContain("--svc-north");
  });

  it("resolves unrecognised or null service to Statewide safely", () => {
    const defNull = getHealthServiceColorDefinition(null);
    expect(defNull.code).toBe("STATEWIDE");

    const defUndefined = getHealthServiceColorDefinition(undefined);
    expect(defUndefined.code).toBe("STATEWIDE");

    const defUnknown = getHealthServiceColorDefinition("Unknown Future Service");
    expect(defUnknown.code).toBe("STATEWIDE");
  });
});

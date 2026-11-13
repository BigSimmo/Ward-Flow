import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { getHealthServiceDefinition } from "@/components/ward-management/ward-service-colors";
import { serviceShortName } from "@/components/ward-management/service-name-tag";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("WA health services are named, never coloured (F-78)", () => {
  it("covers every declared HealthService in the application model", () => {
    for (const service of HEALTH_SERVICES) {
      const def = getHealthServiceDefinition(service);
      expect(def).toBeDefined();
      expect(def.code).toMatch(/^[A-Z]+$/);
      expect(def.facilities.length).toBeGreaterThan(0);
    }
  });

  it("carries no brand colour values", () => {
    const source = read("src/components/ward-management/ward-service-colors.ts");
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/rgba?\(/);
    expect(source).not.toMatch(/brandHex|dotColor|Sourced directly/);
  });

  it("resolves service names to the short names used in the neutral tag", () => {
    expect(getHealthServiceDefinition("East Metro").code).toBe("EMHS");
    expect(getHealthServiceDefinition("North Metro").code).toBe("NMHS");
    expect(getHealthServiceDefinition("South Metro").code).toBe("SMHS");
    expect(serviceShortName("North Metro")).toBe("NMHS");
    expect(serviceShortName("South Metro")).toBe("SMHS");
    expect(serviceShortName("East Metro")).toBe("EMHS");
    expect(serviceShortName("WACHS")).toBe("WACHS");
    expect(serviceShortName("Private")).toBe("Private");
    expect(serviceShortName("Statewide")).toBe("Statewide");
  });

  it("resolves unrecognised or null service to Statewide safely", () => {
    expect(getHealthServiceDefinition(null).code).toBe("STATEWIDE");
    expect(getHealthServiceDefinition(undefined).code).toBe("STATEWIDE");
    expect(getHealthServiceDefinition("Unknown Future Service").code).toBe("STATEWIDE");
  });

  it("keeps the --wf-svc-* tokens as neutral aliases with no hue", () => {
    const tokens = read("src/app/ward-flow-v9-tokens.css");
    const lines = tokens.split("\n").filter((line) => /^\s*--wf-svc-[a-z]+:/.test(line));
    expect(lines).toHaveLength(7);
    for (const line of lines) expect(line).toMatch(/:\s*var\(--wf-(ink|line)-[0-9]\);/);
  });
});

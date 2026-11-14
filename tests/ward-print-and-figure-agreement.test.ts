import { describe, expect, it } from "vitest";
import { overLineLabel } from "@/components/ward-management/shell-next/next-rail-parts";
import { isNearFull } from "@/components/ward-management/wards/ward-index";

const row = (key: string, percent: number | null) => ({ key, name: key, counts: key, percent });

describe("rail Bed alerts chip counts every service at or over the line (RV1a-7)", () => {
  const services = [
    { occupancyPercent: 88 },
    { occupancyPercent: 87 },
    { occupancyPercent: 86 },
    { occupancyPercent: 85 },
  ];
  const shown = services.slice(0, 3).map((service, index) => row(`s${index}`, service.occupancyPercent));

  it("counts all services on a network desk, not the three rows shown", () => {
    expect(overLineLabel(shown, services)).toEqual({ label: "4 at or over 85% full", over: 4 });
  });

  it("keeps the shown rows when the desk reads its own place", () => {
    expect(overLineLabel([row("own", 90), row("s1", 70)], services).over).toBe(1);
  });

  it("still works with rows alone", () => {
    expect(overLineLabel(shown).over).toBe(3);
  });
});

describe("All wards near-full tone follows the whole percent shown (RV1a-8)", () => {
  it("treats 18 of 19 (94.7%, shown 95%) like 19 of 20", () => {
    expect(isNearFull(18 / 19)).toBe(true);
    expect(isNearFull(19 / 20)).toBe(true);
  });

  it("leaves 94% and below alone", () => {
    expect(isNearFull(16 / 17)).toBe(false);
    expect(isNearFull(0.944)).toBe(false);
  });
});

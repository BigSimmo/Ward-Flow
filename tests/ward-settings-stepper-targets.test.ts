import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * P089: the Settings rule stepper's minus and plus were 32px boxes on desktop (reported as about
 * 20px of glyph). They must meet the 44px touch target (`--wf-touch`) on every screen.
 */
const css = readFileSync(join(process.cwd(), "src/components/ward-management/settings/settings.module.css"), "utf8");

describe("P089 settings stepper targets", () => {
  it("gives the stepper box the 44px touch height", () => {
    expect(css).toMatch(/\n\.ruleStepper > span:first-child \{[^}]*height:\s*var\(--wf-touch\)/);
  });

  it("gives the minus and plus buttons the 44px touch width", () => {
    expect(css).toMatch(/\n\.ruleStepper > span:first-child > button \{[^}]*width:\s*var\(--wf-touch\)/);
  });
});

describe("a rule value typed as well as stepped (live walk 16 Nov 2026)", () => {
  const bounds = { min: 30, max: 480, step: 30 };
  const words = (minutes: number) =>
    minutes % 60 === 0
      ? `${minutes / 60}h`
      : minutes < 60
        ? `${minutes}m`
        : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

  it("reads the words as shown, a bare number with its unit, and nothing the stepper could not reach", async () => {
    const { parseRuleTyped } = await import("@/components/ward-management/settings/settings-rows");
    expect(parseRuleTyped("1h 30m", bounds, words)).toBe(90);
    expect(parseRuleTyped("1H30M", bounds, words)).toBe(90);
    expect(parseRuleTyped("2", bounds, words)).toBe(120);
    expect(parseRuleTyped("30", bounds, words)).toBe(30);
    expect(parseRuleTyped("9h", bounds, words)).toBeNull();
    expect(parseRuleTyped("1h 10m", bounds, words)).toBeNull();
    expect(parseRuleTyped("", bounds, words)).toBeNull();
    const clock = (minutes: number) =>
      `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    expect(parseRuleTyped("9:45", { min: 480, max: 660, step: 15 }, clock)).toBe(585);
    expect(parseRuleTyped("09:45", { min: 480, max: 660, step: 15 }, clock)).toBe(585);
  });
});

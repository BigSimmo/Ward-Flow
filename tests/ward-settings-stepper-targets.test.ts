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

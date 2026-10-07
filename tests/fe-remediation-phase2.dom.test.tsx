import "@testing-library/jest-dom/vitest";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Phase 2 Remediation - Touch Ergonomics & Responsive Resilience", () => {
  it("enforces 44px min-height on shift switcher buttons in handover-third-edition.module.css", () => {
    const cssPath = path.resolve(
      __dirname,
      "../src/components/ward-management/handover/handover-third-edition.module.css",
    );
    const css = fs.readFileSync(cssPath, "utf8");

    // Check .shiftBtnLight has min-height: 44px
    const shiftBtnMatch = css.match(/\.shiftBtnLight\s*\{([^}]+)\}/);
    expect(shiftBtnMatch).not.toBeNull();
    expect(shiftBtnMatch![1]).toContain("min-height: 44px");

    // Check .shiftSubtime has elevated font size
    const subtimeMatch = css.match(/(?:^|\n)\.shiftSubtime\s*\{([^}]+)\}/);
    expect(subtimeMatch).not.toBeNull();
    expect(subtimeMatch![1]).toContain("font-size: 12px");
  });

  it("enforces 44px min-height on selectThin and btnResetIntuitive in handover-third-edition.module.css", () => {
    const cssPath = path.resolve(
      __dirname,
      "../src/components/ward-management/handover/handover-third-edition.module.css",
    );
    const css = fs.readFileSync(cssPath, "utf8");

    const selectThinMatch = css.match(/\.selectThin\s*\{([^}]+)\}/);
    expect(selectThinMatch).not.toBeNull();
    expect(selectThinMatch![1]).toContain("min-height: 44px");

    const resetBtnMatch = css.match(/\.btnResetIntuitive\s*\{([^}]+)\}/);
    expect(resetBtnMatch).not.toBeNull();
    expect(resetBtnMatch![1]).toContain("min-height: 44px");
  });

  it("enforces 44px min-height and min-width on .close button in delays-coordination.module.css", () => {
    const cssPath = path.resolve(__dirname, "../src/components/ward-management/delays/delays-coordination.module.css");
    const css = fs.readFileSync(cssPath, "utf8");

    const closeMatch = css.match(/\.close\s*\{([^}]+)\}/);
    expect(closeMatch).not.toBeNull();
    expect(closeMatch![1]).toContain("min-height: 44px");
    expect(closeMatch![1]).toContain("min-width: 44px");
  });

  it("verifies referral-match.tsx does not truncate unit name to single word on accept buttons", () => {
    const tsxPath = path.resolve(__dirname, "../src/components/ward-management/referrals/referral-match.tsx");
    const code = fs.readFileSync(tsxPath, "utf8");

    // Must not contain shortName regex truncation that turns "Mental Health Unit" into "Mental"
    expect(code).not.toContain("c.unit.name.replace(/^(Hospital|Ward|Centre)");
    // Must render full unit name
    expect(code).toContain("✓ Accept Bed at {c.unit.name}");
    // Must not have sub-12px inline font size
    expect(code).not.toMatch(/fontSize:\s*['"]11px['"]/);
  });
});

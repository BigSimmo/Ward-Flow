import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * jsdom does not apply CSS modules, so guard the cascade in the stylesheet text: the overdue
 * hover rule must not outrank `.rowOn:hover`, or a selected overdue referral row loses its
 * selected background while the pointer is over it.
 */
const css = readFileSync("src/components/ward-management/referrals/referral-board.module.css", "utf8");

describe("referral overdue rows keep the selected background on hover", () => {
  it("excludes selected rows from the overdue hover rule", () => {
    expect(css).toMatch(/\.row\[data-overdue="true"\]:not\(\.rowOn\):hover\s*\{/);
    expect(css).not.toMatch(/\.row\[data-overdue="true"\]:hover\s*\{/);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * P090: the seclusion room's "Mark available" and "Mark out of service" buttons were small
 * (`size="sm"`, about 28px tall at 1180 wide). They must meet the 44px touch target.
 *
 * Kit sizes (Josh, 31 Oct 2026, "no 48px controls"; QA fix round): they are now the kit's standard
 * button, which is 44px on a touch screen and 40px on a phone with a 48px tap cover, rather than a
 * small button with a hand-set height. The record buttons beside the 44px fields match.
 */
const dir = join(process.cwd(), "src/components/ward-management/restrictive-practice");
const css = readFileSync(join(dir, "seclusion-screen.module.css"), "utf8");
const tsx = readFileSync(join(dir, "seclusion-screen.tsx"), "utf8");

describe("P090 seclusion room buttons", () => {
  it("sit in the controls row", () => {
    const controls = tsx.indexOf("className={styles.controls}");
    expect(controls).toBeGreaterThan(-1);
    expect(tsx.indexOf('data-testid="seclusion-room-available"')).toBeGreaterThan(controls);
    expect(tsx.indexOf('data-testid="seclusion-room-out-of-service"')).toBeGreaterThan(controls);
  });

  it("use the kit's standard button size, never a small button or a hand-set height", () => {
    for (const testId of [
      "seclusion-room-available",
      "seclusion-room-out-of-service",
      "seclusion-start",
      "seclusion-incident-record",
      "seclusion-episode-end",
      "seclusion-episode-end-open",
    ]) {
      const at = tsx.indexOf(`data-testid="${testId}"`);
      const open = tsx.lastIndexOf("<Button", at);
      expect(open, testId).toBeGreaterThan(-1);
      expect(tsx.slice(open, at), testId).not.toMatch(/size=/u);
    }
    expect(css).not.toMatch(/\.controls\s*>\s*button/u);
  });
});

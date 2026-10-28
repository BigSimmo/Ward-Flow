import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * P090: the seclusion room's "Mark available" and "Mark out of service" buttons were small
 * (`size="sm"`, about 28px tall at 1180 wide). They must meet the 44px touch target (`--wf-touch`).
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

  it("are at least the 44px touch target", () => {
    expect(css).toMatch(/\.controls\s*>\s*button\s*\{[^}]*min-height:\s*var\(--wf-touch\)/);
    expect(css).toMatch(/\.controls\s*>\s*button\s*\{[^}]*height:\s*auto/);
  });
});

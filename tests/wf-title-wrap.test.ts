import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Lane S's checks (31 October 2026): a hero eyebrow must not end in an ellipsis
 * ("GOVERNANCE · THIS S…"). It wraps on every screen, as it already did on phone.
 */
const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("hero eyebrow wraps instead of clipping", () => {
  it("lets the hero eyebrow wrap on desktop", () => {
    const css = read("src/components/wf/hero.module.css");
    const eyebrow = /(?:^|\n)\.eyebrow \{([^}]*)\}/u.exec(css);
    expect(eyebrow).not.toBeNull();
    expect(eyebrow?.[1]).toMatch(/white-space:\s*normal/u);
    expect(eyebrow?.[1]).not.toMatch(/text-overflow:\s*ellipsis/u);
  });
});

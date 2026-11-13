import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/* Spec item 14 (13 Nov 2026): the Appearance pop-up's key line sits under a thin neutral divider, as
   in the approved picture. */
const css = readFileSync(join(process.cwd(), "src/components/ward-management/shell/ward-rail.module.css"), "utf8");

describe("Appearance pop-up key line", () => {
  it("has a hairline divider above it", () => {
    const at = css.indexOf(".appearanceKeys {");
    expect(at).toBeGreaterThan(-1);
    const block = css.slice(at, css.indexOf("}", at));
    expect(block).toMatch(/border-top: 1px solid var\(--wf-line\);/u);
    expect(block).toMatch(/padding-top: var\(--wf-s-2\);/u);
  });
});

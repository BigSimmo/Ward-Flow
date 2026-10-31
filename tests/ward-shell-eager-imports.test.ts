import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The header (ward-bar.tsx) is on every page's first load, which the phone script budget measures
 * (script-budget.json). On 31 October 2026 one constant imported from the rail's parts pulled the
 * rail's capacity card, its stylesheet map and the bed alert model into every route, about 10 KB.
 * The rail, its parts, the phone Menu sheet and the executive chrome load only when needed.
 */
const bar = readFileSync(path.join(process.cwd(), "src/components/ward-management/shell/ward-bar.tsx"), "utf8");
const staticImports = [...bar.matchAll(/^import\s[^;]*?from\s+"([^"]+)";/gmsu)]
  .filter((match) => !/^import\s+type\s/u.test(match[0]))
  .map((match) => match[1]);

describe("the header's first load", () => {
  it("does not import the rail, its parts, the phone Menu sheet or the executive chrome eagerly", () => {
    for (const heavy of ["./ward-rail", "./ward-rail-parts", "./ward-phone-menu-sheet", "./ward-executive-chrome"]) {
      expect(staticImports, heavy).not.toContain(heavy);
    }
  });

  it("takes the close-menus event from its own small module", () => {
    expect(staticImports).toContain("./ward-menu-events");
  });
});

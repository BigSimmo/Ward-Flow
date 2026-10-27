import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * P077 (200% zoom): the header's "Synthetic prototype" pill must keep its whole warning on screen.
 * The pill used to wrap " prototype" in a class that the CSS visually hides once the header is
 * narrow (as it is at 200% zoom), leaving only "Synthetic". No span inside the pill may use a class
 * that the module hides with `clip`.
 */
const root = join(process.cwd(), "src/components/ward-management");
const source = readFileSync(join(root, "ward-shared-access.tsx"), "utf8");
const css = readFileSync(join(root, "ward-shared-access.module.css"), "utf8");

function pillSource(): string {
  const start = source.indexOf("function DataModePill(");
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, end === -1 ? undefined : end);
}

function clippedClasses(): Set<string> {
  const hidden = new Set<string>();
  for (const match of css.matchAll(/\.([A-Za-z][\w-]*)\s*\{([^}]*)\}/g)) {
    if (/clip\s*:\s*rect\(0/.test(match[2])) hidden.add(match[1]);
  }
  return hidden;
}

describe("P077 Synthetic prototype pill", () => {
  it("shows both words of the warning at every header width", () => {
    const pill = pillSource();
    expect(pill).toMatch(/Synthetic/);
    expect(pill).toMatch(/prototype/);
    const used = [...pill.matchAll(/styles\.([A-Za-z]\w*)/g)].map((m) => m[1]);
    const hidden = clippedClasses();
    expect(used.filter((name) => hidden.has(name))).toEqual([]);
  });
});

describe("P077 narrow header", () => {
  it("lets the pill wrap onto two lines instead of hiding a word", () => {
    const narrow = css.slice(css.indexOf("@container ward-bar (max-width: 72rem)"));
    expect(narrow).toMatch(/\.pill\s*\{[^}]*white-space:\s*normal/);
    expect(narrow).toMatch(/\.pill\s*\{[^}]*height:\s*auto/);
  });
});

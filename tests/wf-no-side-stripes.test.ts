import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Josh, 31 October 2026: no coloured side edges or left accent stripes on rows, cards or tiles ("it
 * feels tacky"). Status shows as the StatusGlyph or a small tinted tag; selection as the selected tint
 * with a neutral border (design/v9/design-system-v9.md, "No side edges").
 *
 * The kit has none. The rest of the real app still has older ones; each page build removes its own,
 * so this count may only fall. Lower BASELINE when a build removes some. Mock-up copies are left out
 * (each page build deletes its copy).
 */
const BASELINE = 97;

const SIDE_STRIPE = [
  // A thick coloured border on one side: border-left: 3px solid …, border-inline-start: 4px solid …
  /border-(?:left|right|inline-start|inline-end)\s*:\s*[2-9]px\s+solid/u,
  // An inset bar painted with a shadow: box-shadow: inset 3px 0 0 …
  /inset\s+-?[2-9]px\s+0(?:px)?\s+0(?:px)?\s/u,
];
// Forced-colours (Windows high contrast) rules use system colours, not tone; they are not stripes.
const SYSTEM_COLOUR = /\b(?:Highlight|CanvasText|ButtonText|GrayText|Canvas)\b/u;

function cssFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) return cssFiles(full);
    return name.endsWith(".css") ? [full] : [];
  });
}

function stripeLines(file: string): string[] {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => SIDE_STRIPE.some((pattern) => pattern.test(line)) && !SYSTEM_COLOUR.test(line))
    .map((line) => `${path.relative(process.cwd(), file)}: ${line.trim()}`);
}

describe("no coloured side edges (Josh, 31 Oct 2026)", () => {
  it("the kit (src/components/wf) has none", () => {
    expect(cssFiles(path.join(process.cwd(), "src/components/wf")).flatMap(stripeLines)).toEqual([]);
  });

  it("the rest of the real app never adds more", () => {
    const roots = ["src/components", "src/app"].map((root) => path.join(process.cwd(), root));
    const found = roots
      .flatMap(cssFiles)
      .filter((file) => !/[\\/](?:ward-redesign|mockups)[\\/]/u.test(file))
      .flatMap(stripeLines);
    expect(found.length, found.join("\n")).toBeLessThanOrEqual(BASELINE);
  });
});

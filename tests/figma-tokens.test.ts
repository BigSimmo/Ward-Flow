import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CSS_PATH, applyTokens, diffTokens, exportTokens } from "../scripts/figma-tokens.mjs";

type Values = Record<string, unknown>;
type Tokens = { Colour: { Day: Values; Night: Values }; Size: Values };

const css = readFileSync(CSS_PATH, "utf8");
const map = JSON.parse(readFileSync("design/figma/figma-sync.json", "utf8"));

/** True when a URL path resolves to a page.tsx, letting a [param] folder match any segment. */
function routeExists(route: string): boolean {
  let dir = "src/app";
  for (const segment of route.split("/").filter(Boolean)) {
    if (existsSync(join(dir, segment))) dir = join(dir, segment);
    else {
      const dynamic = readdirSync(dir).find((name) => /^\[[^.]+\]$/.test(name));
      if (!dynamic) return false;
      dir = join(dir, dynamic);
    }
  }
  return existsSync(join(dir, "page.tsx"));
}

describe("figma token sync", () => {
  it("exports day, night and size values that round-trip with no changes", () => {
    const tokens = exportTokens(css) as Tokens;
    expect(tokens.Colour.Day["--wf-accent"]).toBe("#2f4c66");
    expect(tokens.Colour.Night["--wf-accent"]).toBe("#8fb0d4");
    expect(tokens.Colour.Night["--wf-hero-ink"]).toBe("#ffffff");
    expect(tokens.Size["--wf-r-md"]).toBe(10);
    expect(tokens.Size["--wf-fs-28"]).toBe(28);
    expect(tokens.Colour.Day["--wf-e1"]).toBeUndefined();
    expect(diffTokens(css, tokens).changes).toEqual([]);
  });

  it("diffs a Figma pull and applies it to every block that holds the value", () => {
    const pulled = exportTokens(css) as Tokens;
    pulled.Colour.Night["--wf-accent"] = { r: 0.5, g: 0.6, b: 0.8, a: 1 };
    pulled.Colour.Day["--wf-line"] = "rgba(22, 30, 40, 0.1)";
    pulled.Size["--wf-r-lg"] = 16;
    pulled.Colour.Day["--wf-alpha-10"] = "#000000";

    const { changes, unknown } = diffTokens(css, pulled);
    expect(changes.map((c) => `${c.mode ?? "Size"} ${c.name}`)).toEqual([
      "Day --wf-line",
      "Night --wf-accent",
      "Size --wf-r-lg",
    ]);
    expect(unknown).toEqual([]);

    const result = applyTokens(css, pulled);
    expect(result.skipped).toEqual([]);
    expect(result.css.match(/--wf-accent: #8099cc;/g)).toHaveLength(2);
    expect(result.css).toContain("--wf-accent: #2f4c66;");
    expect(result.css).toContain("--wf-line: rgba(22, 30, 40, 0.1);");
    expect(result.css).toContain("--wf-r-lg: 16px;");
    expect(diffTokens(result.css, pulled).changes).toEqual([]);
  });
});

describe("figma sync map", () => {
  it("points every component at an existing file and every screen at an existing route", () => {
    for (const { file } of Object.values(map.components) as { file: string }[]) {
      expect(existsSync(file), file).toBe(true);
    }
    const routes = Object.values(map.screens).flatMap((group) => Object.values(group as Record<string, string>));
    for (const route of [...routes, ...Object.keys(map.aliases)]) expect(routeExists(route), route).toBe(true);
  });
});

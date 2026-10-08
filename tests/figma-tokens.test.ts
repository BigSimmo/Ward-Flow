import { existsSync, readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { unitById } from "../src/components/ward-management/ward-sites";
import { HEALTH_SERVICES } from "../src/components/ward-management/ward-model";
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

  it("refuses a Day edit that would also change Night when the CSS holds one value for both", () => {
    const pulled = exportTokens(css) as Tokens;
    pulled.Colour.Day["--wf-hero-danger"] = "#ff0000";
    pulled.Colour.Night["--wf-hero-danger"] = "#00ff00";
    const result = applyTokens(css, pulled);
    expect(result.applied).toBe(0);
    expect(result.skipped).toHaveLength(2);
    expect(result.css).toBe(css);

    pulled.Colour.Night["--wf-hero-danger"] = "#ff0000";
    expect(applyTokens(css, pulled).css).toContain("--wf-hero-danger: #ff0000;");
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

describe("Figma import validation", () => {
  it.each([
    { Size: { "--wf-r-xs": null } },
    { Size: { "--wf-r-xs": Infinity } },
    { Size: { "--wf-r-xs": "..px" } },
    { Colour: { Day: { "--wf-accent": { r: 2, g: -1, b: 0, a: 1 } } } },
    { Colour: { Day: { "--wf-accent": { r: 0.2, g: 0.3 } } } },
    { Colour: { Day: { "--wf-accent": { r: 0.2, g: 0.3, b: 0.4, a: null } } } },
    { Colour: { Day: { "--wf-accent": "invalid" } } },
    { Colour: { Day: { "--wf-accent": "rgba(0, 0, 0, 2)" } } },
    { Colour: { Day: { "--wf-accent": "rgb(256, 0, 0)" } } },
    { Colour: { Day: [] } },
    { Size: null },
    { Colour: { Twilight: {} } },
    null,
  ])("rejects malformed imports before producing CSS: %j", (incoming) => {
    expect(() => applyTokens(css, incoming)).toThrow(/invalid token/i);
    expect(() => diffTokens(css, incoming)).toThrow(/invalid token/i);
  });

  it("a CLI import with one valid change and one invalid value leaves CSS byte-identical", () => {
    const root = mkdtempSync(join(tmpdir(), "ward-figma-validation-"));
    try {
      mkdirSync(join(root, "scripts"));
      mkdirSync(join(root, "src/app"), { recursive: true });
      cpSync("scripts/figma-tokens.mjs", join(root, "scripts/figma-tokens.mjs"));
      const cssFile = join(root, "src/app/ward-flow-v6-tokens.css");
      writeFileSync(cssFile, css);
      const incoming = join(root, "incoming.json");
      writeFileSync(incoming, JSON.stringify({ Size: { "--wf-r-md": 15, "--wf-r-xs": null } }));
      const result = spawnSync(process.execPath, [join(root, "scripts/figma-tokens.mjs"), "--apply", incoming], {
        encoding: "utf8",
        timeout: 10_000,
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/invalid token/i);
      expect(readFileSync(cssFile, "utf8")).toBe(css);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function fixtureExists(route: string): boolean {
  const segments = route.split("/").filter(Boolean).map(decodeURIComponent);
  if (segments[2] === "ward" || segments[2] === "board") return Boolean(unitById(segments[3]));
  if (segments[2] === "statistics" && segments[3] === "ward") return Boolean(unitById(segments[4]));
  if (segments[2] === "statistics" && segments[3] === "service")
    return (HEALTH_SERVICES as readonly string[]).includes(segments[4]);
  return true;
}

describe("Figma mapped fixture identity", () => {
  it("resolves every mapped concrete ward and service rather than only dynamic directories", () => {
    const routes = Object.values(map.screens).flatMap((group) => Object.values(group as Record<string, string>));
    for (const route of routes) expect(fixtureExists(route), route).toBe(true);
  });
  it("rejects existing dynamic pages with missing records", () => {
    expect(fixtureExists("/mockups/ward-flow/ward/ahs-moodjar")).toBe(false);
    expect(fixtureExists("/mockups/ward-flow/statistics/service/East")).toBe(false);
    expect(fixtureExists("/mockups/ward-flow/ward/rph-adult-secure")).toBe(true);
    expect(fixtureExists("/mockups/ward-flow/statistics/service/East%20Metro")).toBe(true);
  });
});

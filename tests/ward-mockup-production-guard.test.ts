import { readFileSync, readdirSync } from "node:fs";
import { dirname, posix } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy, shouldBlockProductionMockups } from "../src/proxy";
import { DEVELOPER_GATED_PATH_PREFIXES } from "@/lib/developer-area/headers";

// The layout's own check runs before anything it renders, so its heavy children are stubbed.
vi.mock("../src/app/mockups/ward-flow-redesign/_preview/preview-world", () => ({ PreviewWorld: () => null }));
vi.mock("@/components/wf", () => ({
  WfServerPhoneProvider: () => null,
  guessPhoneFromRequest: () => false,
  guessTabletFromRequest: () => false,
}));

/**
 * M149 (Tier 7 plan, 10 Nov 2026): mockups cannot ship as live pages. Every mockup family under
 * src/app/mockups is named here with its reason and the file that refuses it in production, and
 * both refusals are proved: the proxy answers 404, and the family's own layout or route does too
 * (A4-14), so a matcher change cannot expose one. A new family, a page outside a guarded layout, a
 * route handler without its own check, or a mockup file anywhere else fails this test.
 */
const MOCKUP_FAMILIES: Record<string, { reason: string; guard: string }> = {
  "ward-flow-redesign": {
    reason: "October 2026 redesign review pages (D-74); nothing moves into the app until Josh approves a page",
    guard: "src/app/mockups/ward-flow-redesign/layout.tsx",
  },
  "ward-flow-digest": {
    reason: "serves the one design reference HTML from design/third-edition-mockups",
    guard: "src/app/mockups/ward-flow-digest/route.ts",
  },
};

/**
 * Root-level design mockups in public/ are deliberately served in production for sharing and are
 * noindexed (12 October 2026 review, A4-7; next.config.ts and tests/ward-268-security-port.test.ts).
 * They are static HTML, not app pages. A new one needs the same review, so the list is exact.
 */
const PUBLIC_STATIC_MOCKUPS = ["public/capacity-table-mockup.html", "public/referral-board-mockup.html"];

/** Every file under `directory` on disk, so a new file fails before it is even committed. */
const filesUnder = (directory: string) =>
  readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => posix.join(entry.parentPath.replaceAll("\\", "/"), entry.name))
    .sort();

const ROUTE_FILE = /\/(?:page|layout|route|default|template)\.(?:tsx?|jsx?|mjs)$/;
const mockupRouteFiles = filesUnder("src/app/mockups").filter((file) => ROUTE_FILE.test(file));
const familyOf = (file: string) => file.split("/")[3];

/** A guard names its own family's address and refuses in production. */
function guardsFamily(file: string, family: string) {
  const source = readFileSync(file, "utf8");
  const calls = [...source.matchAll(/shouldBlockProductionMockups\(\s*"([^"]+)"\s*\)/g)].map((match) => match[1]);
  const refuses = file.endsWith("layout.tsx")
    ? /shouldBlockProductionMockups\([^)]*\)\)\s*notFound\(\)/.test(source)
    : /shouldBlockProductionMockups\([^)]*\)\)\s*return new Response\(null, \{ status: 404 \}\)/.test(source);
  return calls.includes(`/mockups/${family}`) && refuses;
}

/** The nearest layout.tsx at or above `file`, inside its family. */
function nearestLayout(file: string, files: Set<string>) {
  const familyRoot = `src/app/mockups/${familyOf(file)}`;
  for (let directory = dirname(file); directory.startsWith(familyRoot); directory = posix.dirname(directory)) {
    const layout = `${directory}/layout.tsx`;
    if (files.has(layout)) return layout;
  }
  return null;
}

function production() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("PLAYWRIGHT_OFFLINE_MODE", "");
  vi.stubEnv("NEXT_PUBLIC_MOCKUPS_ENABLED", "");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mockups cannot ship as live pages (M149)", () => {
  it("lists every mockup family exactly, each with a reason", () => {
    expect(mockupRouteFiles.length).toBeGreaterThan(0);
    expect([...new Set(mockupRouteFiles.map(familyOf))].sort()).toEqual(Object.keys(MOCKUP_FAMILIES).sort());
    for (const [family, { reason, guard }] of Object.entries(MOCKUP_FAMILIES)) {
      expect(reason.length, family).toBeGreaterThan(20);
      expect(mockupRouteFiles, family).toContain(guard);
      expect(guardsFamily(guard, family), `${guard} must refuse /mockups/${family} in production`).toBe(true);
    }
  });

  it("puts every mockup page under a layout that refuses it, and every route handler checks itself", () => {
    const files = new Set(mockupRouteFiles);
    const unguarded = mockupRouteFiles.filter((file) => {
      const family = familyOf(file);
      // Route handlers get no layout, so each one must refuse production itself.
      if (/\/route\.[a-z]+$/.test(file)) return !guardsFamily(file, family);
      const layout = nearestLayout(file, files);
      return !layout || !guardsFamily(layout, family);
    });
    expect(unguarded).toEqual([]);
  });

  it("has no mockup route outside src/app/mockups, and no new public mockup file", () => {
    const appMockups = filesUnder("src/app").filter(
      (file) => /mock-?up/i.test(file) && !file.startsWith("src/app/mockups/"),
    );
    expect(appMockups).toEqual([]);
    expect(filesUnder("public").filter((file) => /mock-?up|prototype/i.test(file))).toEqual(PUBLIC_STATIC_MOCKUPS);
  });

  it("exempts no mockup address from the production block", () => {
    expect(DEVELOPER_GATED_PATH_PREFIXES).toEqual([]);
  });

  it("refuses every family at the proxy in production", async () => {
    production();
    for (const family of Object.keys(MOCKUP_FAMILIES)) {
      for (const path of [`/mockups/${family}`, `/mockups/${family}/any-screen`]) {
        expect(shouldBlockProductionMockups(path), path).toBe(true);
        const response = await proxy(new NextRequest(new URL(`http://localhost${path}`)));
        expect(response.status, path).toBe(404);
      }
    }
    // A family nobody has added yet is refused too: the block is on the whole /mockups tree.
    expect(shouldBlockProductionMockups("/mockups/some-new-family")).toBe(true);
  });

  it("refuses each family in its own layout or route in production, without the proxy", async () => {
    production();
    const { default: RedesignLayout } = await import("../src/app/mockups/ward-flow-redesign/layout");
    await expect(RedesignLayout({ children: null })).rejects.toMatchObject({
      digest: expect.stringMatching(/;404$/),
    });
    const { GET: digest } = await import("../src/app/mockups/ward-flow-digest/route");
    expect((await digest()).status).toBe(404);
  });

  it("leaves the mockups reachable outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    for (const family of Object.keys(MOCKUP_FAMILIES))
      expect(shouldBlockProductionMockups(`/mockups/${family}`)).toBe(false);
  });
});

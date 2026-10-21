import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The code map's route table (overview.md section 3.1) had drifted: /waiting and /bed-meeting/agenda
// were added without a row and nothing failed. Every page.tsx under src/app/ward-flow must now be
// named there in backticks. Statistics rows use a shorter form (`/compare` under `/statistics`),
// so a statistics route may also be named by the part after /statistics.

const ROOT = path.resolve(__dirname, "..");
const APP = path.join(ROOT, "src/app/ward-flow");

function pageRoutes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return pageRoutes(full);
    if (entry.name !== "page.tsx") return [];
    const route = path.relative(APP, path.dirname(full)).split(path.sep).join("/");
    return [`/${route}`.replace(/\/$/, "") || "/"];
  });
}

function routeSection(): string {
  const map = readFileSync(path.join(ROOT, "docs/ward-flow/code-map/overview.md"), "utf8");
  const start = map.indexOf("### 3.1 Routes");
  const end = map.indexOf("### 3.2", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return map.slice(start, end);
}

describe("code map route table", () => {
  it("names every Ward Flow page route", () => {
    const section = routeSection();
    const missing = pageRoutes(APP).filter((route) => {
      if (section.includes(`\`${route}\``)) return false;
      const short = route.replace(/^\/statistics(?=\/)/, "");
      return !(route.startsWith("/statistics/") && section.includes(`\`${short}\``));
    });
    expect(missing).toEqual([]);
  });
});

import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DEVELOPER_GATED_PATH_PREFIXES } from "@/lib/developer-area/headers";

// Anchored on this file's own location (`__dirname`), never on `process.cwd()`.
// A cwd-relative `fs.existsSync("src/app/ward-management")` passes or fails
// depending on where the test runner happened to start — a half-finished move
// could report clean if vitest's cwd ever drifted from the repo root. Resolving
// from `__dirname` makes the check independent of invocation directory, matching
// the pattern already proven in tests/search-results-band-adoption.test.ts.
const REPO_ROOT = path.resolve(__dirname, "..");

describe("Ward Flow lives at its own address, outside /mockups", () => {
  it("has left /mockups, so production needs no exemption list to reach it", () => {
    expect(existsSync(path.join(REPO_ROOT, "src", "app", "ward-flow", "page.tsx"))).toBe(true);
    expect(existsSync(path.join(REPO_ROOT, "src", "app", "ward-flow-sign-in", "page.tsx"))).toBe(true);
    expect(existsSync(path.join(REPO_ROOT, "src", "app", "mockups", "ward-flow"))).toBe(false);
    expect(existsSync(path.join(REPO_ROOT, "src", "app", "mockups", "ward-flow-sign-in"))).toBe(false);
    expect(DEVELOPER_GATED_PATH_PREFIXES).toEqual([]);
  });

  it("no longer exists as a public app route", () => {
    const oldRouteDir = path.join(REPO_ROOT, "src", "app", "ward-management");
    expect(existsSync(oldRouteDir), `${oldRouteDir} still exists — it must be gone, not just unlinked`).toBe(false);
  });

  // The clinical tools-catalogue leak case was retired: `src/lib/tools-catalog.ts` and the whole
  // dead app-modes/tools-catalog/search chain it belonged to were PsychSift leftovers, retired
  // 27 September 2026 (Josh, full permission 26 Sept 2026). There is no catalogue left to leak
  // a sandbox path into.
});

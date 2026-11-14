import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Screens use the kit MissingValue instead of a bare "Not recorded" (R-STYLE-2). Lanes lower this number; it never rises. */
const BARE_NOT_RECORDED_CEILING = 313; // 14 Nov 2026 count; lanes lower it as screens adopt MissingValue

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".tsx") ? [path] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("bare Not recorded ratchet", () => {
  it("does not rise above today's count", () => {
    let count = 0;
    for (const file of files("src/components/ward-management")) {
      count += (stripComments(readFileSync(file, "utf8")).match(/Not recorded/g) ?? []).length;
    }
    expect(count).toBeLessThanOrEqual(BARE_NOT_RECORDED_CEILING);
  });
});

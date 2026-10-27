import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// P006: the What's new card and the toast region float over printed outputs (Downtime pack,
// Handover, Discharges). Both must be hidden in print.
const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

function printBlocks(css: string): string {
  return [...css.matchAll(/@media print\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join("\n");
}

describe("print hides floating overlays", () => {
  it("hides the What's new card", () => {
    expect(printBlocks(read("src/components/ward-management/help/ward-whats-new.module.css"))).toMatch(
      /\.card\s*\{[^}]*display:\s*none\s*!important/,
    );
  });
  it("hides the toast region", () => {
    expect(printBlocks(read("src/components/wf/overlay.module.css"))).toMatch(
      /\.toastRegion\s*\{[^}]*display:\s*none\s*!important/,
    );
  });
});

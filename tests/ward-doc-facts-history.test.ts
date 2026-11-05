import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { removePathSync } from "../scripts/retryable-fs.mjs";
import { describe, expect, it } from "vitest";
import { applyMarkers, run } from "../scripts/doc-facts.mjs";

const facts = new Map([["migration-count", "16"]]);
const marker = "<!-- fact:migration-count -->13<!-- /fact -->";

describe("immutable documentation evidence", () => {
  it("updates live facts but refuses to rewrite a fixed-revision verification", () => {
    const evidence = `_Checked at \`899b232e\`: ${marker} migrations._`;
    const result = applyMarkers(`Current: ${marker}\n${evidence}`, facts);
    expect(result.updated).toBe(`Current: <!-- fact:migration-count -->16<!-- /fact -->\n${evidence}`);
    expect(result.frozen).toEqual([{ line: 2, name: "migration-count" }]);
    expect(result.stale).toHaveLength(1);
  });
  it("freezes only a commit-SHA token, not an all-digit one such as a date", () => {
    const dated = `Verified on \`2026110\`: ${marker} migrations.`;
    const live = applyMarkers(dated, facts);
    expect(live.frozen).toEqual([]);
    expect(live.updated).toBe("Verified on `2026110`: <!-- fact:migration-count -->16<!-- /fact --> migrations.");
    const pinned = `Verified at \`4f2e9a1\`: ${marker} migrations.`;
    const frozen = applyMarkers(pinned, facts);
    expect(frozen.frozen).toEqual([{ line: 1, name: "migration-count" }]);
    expect(frozen.updated).toBe(pinned);
  });
  it.each(["docs-script-refs:historical", "docs-facts:frozen"])(
    "preserves %s evidence and resumes live updates",
    (fence) => {
      const history = `<!-- ${fence}-start -->\n${marker}\n<!-- ${fence}-end -->`;
      const result = applyMarkers(`${history}\n${marker}`, facts);
      expect(result.updated).toBe(`${history}\n<!-- fact:migration-count -->16<!-- /fact -->`);
      expect(result.frozen).toEqual([{ line: 2, name: "migration-count" }]);
    },
  );
});

it("retains an outer frozen fence when an inner historical fence ends", () => {
  const source = `<!-- docs-facts:frozen-start -->\n<!-- docs-script-refs:historical-start -->\n${marker}\n<!-- docs-script-refs:historical-end -->\n${marker}\n<!-- docs-facts:frozen-end -->`;
  expect(applyMarkers(source, facts).updated).toBe(source);
  expect(applyMarkers(source, facts).frozen).toHaveLength(2);
});
it.each([
  "<!-- docs-facts:frozen-start -->",
  "<!-- docs-facts:frozen-end -->",
  "<!-- docs-facts:frozen-start --><!-- docs-script-refs:historical-start --><!-- docs-facts:frozen-end --><!-- docs-script-refs:historical-end -->",
])("refuses malformed evidence boundaries without updating live markers: %s", (fence) => {
  const source = `${fence}\n${marker}`;
  const result = applyMarkers(source, facts);
  expect(result.malformed.length).toBeGreaterThan(0);
  expect(result.updated).toBe(source);
});
it("check and write reject an offending file and preserve its exact bytes", () => {
  const root = mkdtempSync(join(tmpdir(), "ward-frozen-facts-"));
  const put = (file: string, text: string) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  };
  try {
    put(
      "backend/ward-flow/config.mjs",
      'const d = env.WARD_DATABASE_PROVIDER || "supabase"; env.WARD_AUTH_PROVIDER || "supabase";',
    );
    put("backend/ward-flow/migrations/001-a.sql", "");
    put("src/app/ward-flow/page.tsx", "");
    put("src/app/page.tsx", "");
    put("docs/ward-flow/decisions.md", "## D-1. First\n");
    put("package.json", JSON.stringify({ engines: { node: ">=24" } }));
    put("docs/retired-terms.json", readFileSync(new URL("../docs/retired-terms.json", import.meta.url), "utf8"));
    const source = `Current  :  ${marker}\n<!-- docs-facts:frozen-start -->\n${marker}\n<!-- docs-facts:frozen-end -->\n`;
    put("docs/proof.md", source);
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root });
    execFileSync("git", ["add", "docs/proof.md"], { cwd: root });
    for (const write of [false, true]) {
      expect(run({ root, write }).errors.some((error: string) => error.includes("frozen or fixed-revision"))).toBe(
        true,
      );
      expect(readFileSync(join(root, "docs/proof.md"), "utf8")).toBe(source);
    }
  } finally {
    removePathSync(root, { recursive: true });
  }
});

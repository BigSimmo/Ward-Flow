import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import selectors from "./ward-stress-test-selectors.json";

/**
 * R-STRUCT-20 (14 Nov 2026 master stress test). The stress-test and live-test scripts find controls
 * by test id and by a few visible names. They were written against one build and the redesign pull
 * requests then moved the controls, so a script failed on test day instead of on the day the control
 * moved. This test keeps the list of those selectors in the repository and checks every one against
 * the current source, so a redesign that removes or renames one fails here and updates
 * `ward-stress-test-selectors.json` in the same pull request.
 *
 * Reads source only. No browser, no network, no provider. Synthetic ids only.
 */

const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(path, out);
    else if (/\.(tsx?|mjs)$/.test(entry.name)) out.push(path);
  }
  return out;
}

const sources = sourceFiles(SRC).map((file) => readFileSync(file, "utf8"));
const allSource = sources.join("\n");
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("stress-test selectors still exist in the source (R-STRUCT-20)", () => {
  it("keeps the list non-trivial", () => {
    expect(selectors.testIds.length).toBeGreaterThan(150);
    expect(selectors.testIdPrefixes.length).toBeGreaterThan(15);
  });

  it("finds every exact test id as a quoted string in src", () => {
    const missing = selectors.testIds.filter((id) => !new RegExp(`["'\`]${escape(id)}["'\`]`).test(allSource));
    expect(missing, "moved or renamed test ids: update tests/ward-stress-test-selectors.json in the same PR").toEqual(
      [],
    );
  });

  it("finds every built test id family (prefix followed by a template value) in src", () => {
    const missing = selectors.testIdPrefixes.filter((prefix) => !allSource.includes(`${prefix}\${`));
    expect(
      missing,
      "moved or renamed test id families: update tests/ward-stress-test-selectors.json in the same PR",
    ).toEqual([]);
  });

  it("finds every visible name in the file it is listed against", () => {
    const missing = selectors.texts.filter(
      ({ text, file }) => !readFileSync(join(process.cwd(), file), "utf8").includes(text),
    );
    expect(missing).toEqual([]);
  });

  it("lists nothing as known-moved without a reason, and none is also in the live lists", () => {
    for (const entry of selectors.knownMoved as { id: string; reason: string }[]) {
      expect(entry.reason.length).toBeGreaterThan(10);
      expect(selectors.testIds).not.toContain(entry.id);
    }
  });
});

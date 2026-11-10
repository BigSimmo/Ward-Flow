import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { redactFindingValue, scanDiffText } from "../scripts/ward-ci-public/identifier-scan.mjs";

// D-122 item 7: hosted CI runs the same identifier scan as the local pre-commit hook. The hosted
// script reuses scanAddedLines, so these cases only prove the wiring: a PR diff is parsed the way
// the staged diff is, fixtures stay exempt, and nothing it logs repeats a matched value.

const root = path.resolve(import.meta.dirname, "..");

// Synthetic, checksum-valid shapes (precommit-scan: allow). Built at run time so the scan of this
// test file's own diff never sees a literal identifier.
const medicare = ["2123", "45670", "1"].join(" ");

function diffAdding(file: string, line: string) {
  return [
    `diff --git a/${file} b/${file}`,
    "index 0000000..1111111 100644",
    `--- a/${file}`,
    `+++ b/${file}`,
    "@@ -0,0 +1 @@",
    `+${line}`,
    "",
  ].join("\n");
}

describe("hosted identifier scan (D-122 item 7)", () => {
  it("flags a real-looking Medicare number added outside fixtures", () => {
    const findings = scanDiffText(diffAdding("lib/example.ts", `const medicare = "${medicare}";`));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: "lib/example.ts", line: 1 });
  });

  it("keeps fixtures and synthetic UMnnnnnn URNs exempt, as the hook does", () => {
    expect(scanDiffText(diffAdding("tests/example.test.ts", `const medicare = "${medicare}";`))).toEqual([]);
    expect(scanDiffText(diffAdding("lib/example.ts", `umrn: "UM100002"`))).toEqual([]);
  });

  it("flags a labelled non-synthetic URN but never repeats the value in its log text", () => {
    const findings = scanDiffText(diffAdding("lib/example.ts", ["URN", ": ", "A", "1234567"].join("")));
    expect(findings).toHaveLength(1);
    const logged = redactFindingValue(findings[0].why);
    expect(logged).not.toContain("1234567");
    expect(logged).toContain("[redacted]");
  });

  it("runs in the main Ward Flow workflow against the PR base", () => {
    const workflow = readFileSync(path.join(root, ".github/workflows/ward-flow.yml"), "utf8");
    expect(workflow).toMatch(
      /- name: Scan added lines for secrets and patient identifiers\n\s+env:\n\s+WARD_BASE_SHA: .+\n\s+run: node scripts\/ward-ci-public\/identifier-scan\.mjs/u,
    );
  });
});

// Audit M132: the pre-commit patient-identifier rules also run on a pull request's diff in CI.
// Every identifier below is generated at runtime from obviously synthetic digits, so this file
// never holds a literal the scanner would block.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { isLuhnValid, isValidMedicare } from "../scripts/pre-commit-checks.mjs";
import {
  main,
  pullRequestDiff,
  scanDiffForPatientIdentifiers,
} from "../scripts/ward-flow/check-patient-identifiers.mjs";

/** A checksum-valid Medicare number built from the synthetic stem 2111 1111, issue 1. */
function syntheticValidMedicare(): string {
  const stem = "21111111";
  const weights = [1, 3, 7, 9, 1, 3, 7, 9];
  const check = weights.reduce((sum, weight, index) => sum + weight * Number(stem[index]), 0) % 10;
  const digits = `${stem}${check}1`;
  expect(isValidMedicare(digits)).toBe(true);
  return `${digits.slice(0, 4)} ${digits.slice(4, 9)} ${digits.slice(9)}`;
}

function syntheticValidIhi(): string {
  const stem = "800360111111111";
  for (let digit = 0; digit <= 9; digit += 1) if (isLuhnValid(stem + digit)) return stem + digit;
  throw new Error("unreachable");
}

const diffAdding = (file: string, line: string) =>
  [`diff --git a/${file} b/${file}`, "--- a/" + file, "+++ b/" + file, "@@ -0,0 +1 @@", `+${line}`].join("\n");

describe("scanDiffForPatientIdentifiers", () => {
  it("fails a checksum-valid Medicare number added outside fixtures", () => {
    const findings = scanDiffForPatientIdentifiers(
      diffAdding("src/components/ward-management/x.tsx", `medicare: "${syntheticValidMedicare()}",`),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: "src/components/ward-management/x.tsx", line: 1 });
  });

  it("fails a checksum-valid IHI and a non-synthetic labelled URN", () => {
    expect(scanDiffForPatientIdentifiers(diffAdding("docs/note.md", `IHI ${syntheticValidIhi()}`))).toHaveLength(1);
    expect(scanDiffForPatientIdentifiers(diffAdding("src/a.tsx", `umrn: "UM${"1234567"}"`))).toHaveLength(1);
  });

  it("keeps the pre-commit exemptions: fixtures, the allow marker and synthetic URNs", () => {
    const medicare = syntheticValidMedicare();
    expect(scanDiffForPatientIdentifiers(diffAdding("tests/ward-x.test.ts", `medicare: "${medicare}"`))).toEqual([]);
    expect(
      scanDiffForPatientIdentifiers(diffAdding("src/a.tsx", `medicare: "${medicare}" // precommit-scan: allow`)),
    ).toEqual([]);
    expect(scanDiffForPatientIdentifiers(diffAdding("src/a.tsx", `umrn: "UM100002"`))).toEqual([]);
  });
});

describe("pullRequestDiff on a real git history", () => {
  let root = "";
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = "";
  });

  it("finds a Medicare number added by a later commit, and only the added line", () => {
    root = mkdtempSync(path.join(os.tmpdir(), "ward-identifier-scan-"));
    const git = (...args: string[]) =>
      execFileSync("git", ["-c", "user.name=Synthetic", "-c", "user.email=synthetic@example.invalid", ...args], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    git("init", "--quiet", "--initial-branch=main");
    mkdirSync(path.join(root, "src"));
    writeFileSync(path.join(root, "src/patient.ts"), "export const name = 'Synthetic';\n");
    git("add", "--", "src/patient.ts");
    git("commit", "--quiet", "-m", "base");
    const base = git("rev-parse", "HEAD");

    expect(scanDiffForPatientIdentifiers(pullRequestDiff(base, root))).toEqual([]);

    writeFileSync(
      path.join(root, "src/patient.ts"),
      `export const name = 'Synthetic';\nexport const medicare = "${syntheticValidMedicare()}";\n`,
    );
    git("commit", "--quiet", "-am", "add identifier");
    const findings = scanDiffForPatientIdentifiers(pullRequestDiff(base, root));
    expect(findings).toEqual([
      { file: "src/patient.ts", line: 2, why: "checksum-valid Medicare number (real-looking patient identifier)" },
    ]);
  });
});

describe("main", () => {
  it("refuses a bare --base instead of silently passing", () => {
    const errors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((message: string) => void errors.push(message));
    try {
      expect(main(["--base"], { NODE_ENV: "test" })).toBe(1);
      expect(main(["--base", "--verbose"], { NODE_ENV: "test" })).toBe(1);
    } finally {
      spy.mockRestore();
    }
    expect(errors.join("\n")).toMatch(/--base needs a revision/u);
  });
});

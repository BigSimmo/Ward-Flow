import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(__dirname, "..");
const configurations = ["tsconfig.json", "tsconfig.typecheck.json"] as const;
const backupFiles = [
  "mockup-backup-2026-11-01/broken.ts",
  "mockup-backup-2026-11-02/nested/broken.tsx",
  "mockup-backup-2026-11-02/broken.mts",
];
const intendedFiles = [
  "src/current.ts",
  "src/mockup-backup-active/current.ts",
  "mockup-backup-active/current.ts",
  "mockups/current-preview.tsx",
  "scripts/current.mts",
  "mockup-backup-note.ts",
  "mockup-backup-2026-11-01.ts",
];

let fixtureRoot: string;

beforeEach(() => {
  fixtureRoot = mkdtempSync(path.join(tmpdir(), "ward-typecheck-backup-"));
  for (const configuration of configurations) {
    copyFileSync(path.join(repositoryRoot, configuration), path.join(fixtureRoot, configuration));
  }
  for (const file of [...intendedFiles, ...backupFiles]) {
    const destination = path.join(fixtureRoot, file);
    mkdirSync(path.dirname(destination), { recursive: true });
    // Broken backups must not become source inputs simply because they are inside the checkout.
    writeFileSync(destination, backupFiles.includes(file) ? "export const unfinished = (" : "export {};\n");
  }
});

afterEach(() => {
  rmSync(fixtureRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function sourceFiles(configuration: string): string[] {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    path.join(fixtureRoot, configuration),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
      },
    },
  );
  expect(parsed).toBeDefined();
  expect(parsed!.errors).toEqual([]);
  return parsed!.fileNames.map((file) => path.relative(fixtureRoot, file).split(path.sep).join("/"));
}

describe.each(configurations)("%s source scope", (configuration) => {
  it("excludes dated root backup folders, including nested TSX and MTS files", () => {
    const files = sourceFiles(configuration);
    for (const file of backupFiles) expect(files).not.toContain(file);
  });

  it("retains active source, genuine mockups, MTS scripts and similarly named source", () => {
    const files = sourceFiles(configuration);
    for (const file of intendedFiles) expect(files).toContain(file);
  });
});

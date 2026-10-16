import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { removePathSync } from "../scripts/retryable-fs.mjs";

// Importing the CLI starts servers. Execute its actual pure function without the CLI side effects.
const runnerPath = path.resolve(__dirname, "../scripts/run-playwright.mjs");
const source = ts.createSourceFile(runnerPath, readFileSync(runnerPath, "utf8"), ts.ScriptTarget.Latest, true);
const declaration = source.statements.find(
  (statement): statement is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(statement) && statement.name?.text === "deriveIsolatedRunExclude",
);
if (!declaration) throw new Error("The isolated Playwright config helper must remain covered by these tests.");
const deriveExclude = vm.runInNewContext(`(${declaration.getText(source)})`, { path, ts, readFileSync }) as (
  root: string,
  extra: string[],
) => string[];

const roots: string[] = [];
function configRoot(exclude: unknown): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "ward-playwright-exclude-"));
  roots.push(root);
  writeFileSync(path.join(root, "tsconfig.json"), `// Synthetic JSONC config\n${JSON.stringify({ exclude })}\n`);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) removePathSync(root, { recursive: true });
});

describe("isolated Playwright TypeScript excludes", () => {
  it("preserves hidden-directory exclusions added by PR371 and the isolated build exclusion", () => {
    const excludes = ["node_modules", "tmp/**", ".worktrees/**", ".claude/**", ".next-playwright/**"];
    const root = configRoot(excludes);
    const extra = ["../../.next/**"];
    expect(deriveExclude(root, extra)).toEqual([
      "../../node_modules",
      "../../tmp/**",
      "../../.worktrees/**",
      "../../.claude/**",
      "../../.next-playwright/**",
      "../../.next/**",
    ]);
    expect(extra).toEqual(["../../.next/**"]);
    expect(readFileSync(path.join(root, "tsconfig.json"), "utf8")).toContain('".worktrees/**"');
  });

  it.each([
    "/outside/**",
    "\\outside\\**",
    "C:/outside/**",
    "C:\\outside\\**",
    "C:outside/**",
    "\\\\server\\share\\**",
    ".",
    "..",
    "./src/**",
    "../outside/**",
    "safe/../outside/**",
    "safe/./nested/**",
    "safe\\..\\outside\\**",
    "",
    null,
    1,
  ])("refuses non-root-relative exclusion %j", (exclude) => {
    expect(() => deriveExclude(configRoot([exclude]), [])).toThrow("not a plain root-relative pattern");
  });

  it.each([[], undefined, "node_modules"])("refuses missing or invalid exclusion lists %j", (exclude) => {
    expect(() => deriveExclude(configRoot(exclude), [])).toThrow('has no non-empty "exclude" array');
  });
});

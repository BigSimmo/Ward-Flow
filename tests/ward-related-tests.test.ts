import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve(__dirname, "../scripts/ward-flow/related-tests.mjs");

function select(changedFile: string) {
  const root = mkdtempSync(path.join(tmpdir(), "ward-related-selection-"));
  const write = (file: string, content: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  };
  write("src/value.ts", "export const value = 1;");
  write("src/use-value.ts", 'export { value } from "./value";');
  write("tests/value.test.ts", 'import { value } from "../src/use-value";');
  write("tests/helper.ts", "export const helper = 1;");
  write("tests/helper-owner.test.ts", 'import { helper } from "./helper";');
  const git = (args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      timeout: 10000,
      stdio: ["ignore", "pipe", "pipe"],
    });
  git(["init", "--quiet"]);
  git(["add", "src", "tests"]);
  git(["-c", "user.name=Ward Test", "-c", "user.email=ward@example.invalid", "commit", "--quiet", "-m", "fixture"]);
  write(changedFile, "// changed fixture\n");
  // Count actual directory walks in the child; do not infer the optimisation from source text.
  const harness = `
    import fs from "node:fs";
    import { syncBuiltinESMExports } from "node:module";
    import { pathToFileURL } from "node:url";
    const walk = fs.readdirSync;
    let walks = 0;
    fs.readdirSync = function (...args) { walks++; return walk.apply(this, args); };
    syncBuiltinESMExports();
    process.on("exit", () => console.log("GRAPH_WALKS=" + walks));
    process.argv = [process.execPath, ${JSON.stringify(script)}, "--base", "HEAD", "--dry-run"];
    await import(pathToFileURL(${JSON.stringify(script)}).href);
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", harness], {
    cwd: root,
    encoding: "utf8",
    timeout: 15000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return {
    selected: result.stdout.split(/\r?\n/).filter((line) => line.startsWith("  tests/")),
    walks: Number(result.stdout.match(/GRAPH_WALKS=(\d+)/)?.[1]),
  };
}

describe("related-test selection without unnecessary graph work", () => {
  it("does not walk source directories for documentation-only changes", () => {
    expect(select("README.md")).toEqual({ selected: [], walks: 0 });
  });

  it("still selects a changed test without walking source directories", () => {
    expect(select("tests/value.test.ts")).toEqual({ selected: ["  tests/value.test.ts"], walks: 0 });
  });

  it("retains transitive source-to-test selection", () => {
    const result = select("src/value.ts");
    expect(result.selected).toEqual(["  tests/value.test.ts"]);
    expect(result.walks).toBeGreaterThan(0);
  });

  it("still walks the graph for shared test helpers", () => {
    const result = select("tests/helper.ts");
    expect(result.selected).toEqual(["  tests/helper-owner.test.ts"]);
    expect(result.walks).toBeGreaterThan(0);
  });
});

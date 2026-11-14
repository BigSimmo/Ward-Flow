import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { removePathSync } from "../scripts/retryable-fs.mjs";
import { prepareMainTree } from "../scripts/ward-ci-public/budget-gate.mjs";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.email=t@example.test", "-c", "user.name=t", ...args], {
    cwd,
    encoding: "utf8",
  }).trim();

describe("budget gate: measuring main alone (Deep-DP5-6)", () => {
  it("builds main in a clean worktree: shared packages, never the checkout's saved webpack cache", () => {
    const directory = mkdtempSync(join(tmpdir(), "ward-budget-main-tree-"));
    try {
      const root = join(directory, "checkout");
      mkdirSync(join(root, "node_modules"), { recursive: true });
      git(directory, "init", "-q", root);
      writeFileSync(join(root, "marker.txt"), "main");
      git(root, "add", "marker.txt");
      git(root, "commit", "-q", "-m", "main");
      const mainSha = git(root, "rev-parse", "HEAD");
      // The merged build leaves a webpack cache that records this checkout's absolute paths.
      mkdirSync(join(root, ".next/cache/webpack"), { recursive: true });
      writeFileSync(join(root, ".next/cache/webpack/pack.gz"), "paths of the outer checkout");

      const tree = join(directory, "out/main-tree");
      prepareMainTree(root, mainSha, tree);

      expect(readFileSync(join(tree, "marker.txt"), "utf8")).toBe("main");
      expect(lstatSync(join(tree, "node_modules")).isSymbolicLink()).toBe(true);
      // A copied cache made Next load src/instrumentation-client.ts from the outer checkout, so main
      // alone never built and every over-budget route failed.
      expect(existsSync(join(tree, ".next"))).toBe(false);
    } finally {
      removePathSync(directory, { recursive: true, force: true });
    }
  });

  it("says loudly, as an annotation, when main alone cannot be built", () => {
    const source = readFileSync(join(process.cwd(), "scripts/ward-ci-public/budget-gate.mjs"), "utf8");
    expect(source).toContain("::error title=Ward budget main build failed::Main alone did not build");
    expect(source).not.toMatch(/cpSync\(/u);
  });
});

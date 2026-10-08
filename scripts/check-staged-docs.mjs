#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stagedSourceTree } from "./staged-source-tree.mjs";

export function selectedDocChecks(files, wardIndexes = false) {
  const specs = wardIndexes
    ? [
        [
          "scripts/ward-flow/screen-map.mjs",
          /^(?:docs\/ward-flow\/mockups\/|src\/app\/mockups\/ward-flow\/|docs\/ward-flow\/SCREEN-MAP\.md$|scripts\/ward-flow\/(?:screen-pairs|screen-map)\.mjs$)/u,
        ],
        [
          "scripts/ward-flow/rules-index.mjs",
          /^(?:docs\/ward-flow\/lessons\/|docs\/ward-flow\/RULES\.md$|scripts\/ward-flow\/rules-index\.mjs$)/u,
        ],
        [
          "scripts/ward-flow/owner-rulings-index.mjs",
          /^(?:docs\/ward-flow\/(?:archive\/dated-notes\/)?owner-.*\.md$|docs\/ward-flow\/(?:decisions|OWNER-RULINGS)\.md$|scripts\/ward-flow\/owner-rulings-index\.mjs$)/u,
        ],
        [
          "scripts/ward-flow/mockup-manifest.mjs",
          /^(?:docs\/ward-flow\/mockups\/|scripts\/ward-flow\/mockup-manifest\.mjs$)/u,
        ],
        [
          "scripts/ward-flow/screen-verification.mjs",
          /^(?:docs\/ward-flow\/(?:screen-verification\.json|SCREEN-VERIFICATION\.md)$|scripts\/ward-flow\/(?:screen-pairs|screen-verification|screen-verification-lib)\.mjs$|docs\/ward-flow\/mockups\/MANIFEST\.json$)/u,
        ],
      ]
    : [
        [
          "scripts/generate-site-map.ts",
          /^(?:src\/app\/|mockups\/|scripts\/generate-site-map\.ts$|docs\/site-map\.md$)/u,
        ],
        ["scripts/update-docs-inventory.mjs", /^(?:scripts\/|package\.json$|docs\/scripts-index\.md$)/u],
        [
          "scripts/check-codebase-index-coverage.mjs",
          /^(?:src\/app\/|src\/lib\/|\.design\/|design\/|docs\/codebase-index\.md$|scripts\/check-codebase-index-coverage\.mjs$)/u,
        ],
      ];
  return specs.filter(([, pattern]) => files.some((file) => pattern.test(file))).map(([script]) => script);
}

/** @param {{root?: string, wardIndexes?: boolean, strict?: boolean, run?: (command: string, args: string[], options: {cwd: string, env: NodeJS.ProcessEnv, encoding: "utf8", timeout: number, maxBuffer: number}) => {status: number|null, error?: Error, stderr?: string, stdout?: string, signal?: NodeJS.Signals|null}}} [options] */
export function checkStagedDocs({
  root = process.cwd(),
  wardIndexes = false,
  strict = process.env.PRECOMMIT_DOCS_SYNC_STRICT === "1",
  run = spawnSync,
} = {}) {
  const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 30_000 });
  if (existsSync(git(["rev-parse", "--git-path", "MERGE_HEAD"]).trim())) return 0;
  const files = git(["diff", "--cached", "--name-only", "-z"]).split("\0").filter(Boolean);
  const checks = selectedDocChecks(files, wardIndexes);
  if (!checks.length) return 0;
  const tree = stagedSourceTree(root);
  let failed = false;
  try {
    const env = {
      ...process.env,
      GIT_DIR: git(["rev-parse", "--absolute-git-dir"]).trim(),
      GIT_WORK_TREE: tree.root,
      GIT_INDEX_FILE: git(["rev-parse", "--path-format=absolute", "--git-path", "index"]).trim(),
    };
    for (const script of checks) {
      if (!existsSync(path.join(tree.root, script))) {
        console.warn(`[pre-commit] Index snapshot lacks ${script}; check unavailable.`);
        failed = true;
        continue;
      }
      const args = script.endsWith(".ts")
        ? ["--import", pathToFileURL(path.join(tree.root, "node_modules/tsx/dist/loader.mjs")).href, script, "--check"]
        : [script, "--check"];
      const result = run(process.execPath, args, {
        cwd: tree.root,
        env,
        encoding: "utf8",
        timeout: 60_000,
        maxBuffer: 8 * 1024 * 1024,
      });
      if (result.status !== 0) {
        failed = true;
        console.warn(
          `[pre-commit] ${script} index check failed (${result.status ?? result.error?.message ?? result.signal}).`,
        );
        console.warn(result.stderr || result.stdout || "No completed verdict.");
      }
    }
  } finally {
    tree.cleanup();
  }
  if (!failed)
    console.log(
      "[pre-commit] Selected generated-document checks passed against the index snapshot; working files untouched.",
    );
  else
    console.warn(
      `[pre-commit] Generated-document state is unverified/stale; ${wardIndexes || strict ? "commit blocked" : "advisory; run owned documentation update and review its staged outputs"}.`,
    );
  return failed && (wardIndexes || strict) ? 1 : 0;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = checkStagedDocs({ wardIndexes: process.argv.includes("--ward-indexes") });
  } catch (error) {
    console.error(`[pre-commit] Staged-document check unavailable: ${error.message}`);
    process.exitCode =
      process.argv.includes("--ward-indexes") || process.env.PRECOMMIT_DOCS_SYNC_STRICT === "1" ? 1 : 0;
  }
}

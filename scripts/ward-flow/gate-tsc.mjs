#!/usr/bin/env node
// Ward Flow gate type check: the full `tsc -p tsconfig.typecheck.json --noEmit`, made incremental
// with a per-worktree build-info file that is seeded from the last passing run on this PC.
//
//   node scripts/ward-flow/gate-tsc.mjs           owners: incremental, seeded
//   node scripts/ward-flow/gate-tsc.mjs --clean   the fold gate: a full, clean run (no build info)
//   add --ward to use tsconfig.ward-gate.json (Ward Flow code and tests plus everything they import;
//   R34): the fold gate runs --clean --ward, and the night shift runs the full app with --clean.
//
// Same config, same files, same result as a cold run: TypeScript re-checks every file whose content
// or dependencies changed and throws the cache away if the options differ. What it saves is
// re-checking the files that did not change.
//
// Why a file in the worktree root and not the config's node_modules/.cache path: Ward Flow worktrees
// share one node_modules through a junction, so that path is shared by every worktree at once.
// The seed lives outside git in ward-flow-logs/tsc-cache/ and is refreshed after each passing run.
// Build-info paths are relative to the file, so a copy placed at another worktree's root still fits.
import { execFileSync } from "node:child_process";
import { acquireHeavyRunLock } from "../test-run-lock.mjs";
import { runOwnedChild } from "../owned-child.mjs";
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const CACHE_DIR = process.env.WARD_TSC_CACHE_DIR ?? "D:/Repos/ward-flow-logs/tsc-cache";
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const admission = acquireHeavyRunLock({ projectRoot: root, mode: "shared", command: "gate-tsc" });
try {
  const local = path.join(
    root,
    process.argv.includes("--ward") ? ".ward-gate-ward.tsbuildinfo" : ".ward-gate.tsbuildinfo",
  );
  const seed = path.join(CACHE_DIR, process.argv.includes("--ward") ? "latest-ward.tsbuildinfo" : "latest.tsbuildinfo");

  const clean = process.argv.includes("--clean");
  const config = process.argv.includes("--ward") ? "tsconfig.ward-gate.json" : "tsconfig.typecheck.json";
  if (!clean && !existsSync(local) && existsSync(seed)) {
    copyFileSync(seed, local);
    console.log("gate-tsc: seeded the build info from the last passing run.");
  }

  const freshInfo = path.join(os.tmpdir(), `ward-gate-clean-${process.pid}-${Date.now()}.tsbuildinfo`);
  const started = Date.now();
  const result = await runOwnedChild(
    process.execPath,
    [
      path.join(root, "node_modules/typescript/bin/tsc"),
      "-p",
      config,
      "--noEmit",
      "--incremental",
      "--tsBuildInfoFile",
      // --clean: a brand-new build-info file nobody has written, so nothing is reused.
      clean ? freshInfo : local,
    ],
    { cwd: root, stdio: "inherit", env: admission.environment },
  );
  const code = result.status ?? 1;
  console.log(
    `gate-tsc (${config}${clean ? ", clean" : ""}): exit ${code} in ${Math.round((Date.now() - started) / 1000)}s`,
  );

  if (!clean && code === 0 && existsSync(local)) {
    mkdirSync(CACHE_DIR, { recursive: true });
    const temporary = `${seed}.${process.pid}.tmp`;
    copyFileSync(local, temporary);
    renameSync(temporary, seed);
  }
  if (clean) rmSync(freshInfo, { force: true });
  process.exitCode = code;
} finally {
  admission.release();
}

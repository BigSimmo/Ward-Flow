import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, symlinkSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { removePathSync } from "./retryable-fs.mjs";

/** Disposable index snapshot. Working/untracked source is never copied. */
export function stagedSourceTree(root) {
  const git = (args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024 });
  if (git(["ls-files", "--unmerged", "-z"]))
    throw new Error("Unresolved merge stages: staged source graph cannot be established.");
  // Tracked source symlinks could resolve outside the snapshot. Refuse rather than read disk.
  if (
    git(["ls-files", "--stage", "-z"])
      .split("\0")
      .some((entry) => entry.startsWith("120000 "))
  )
    throw new Error("Tracked symlink requires explicit staged graph support.");
  const directory = mkdtempSync(path.join(os.tmpdir(), "ward-index-"));
  const cleanup = () => removePathSync(directory, { recursive: true });
  try {
    git(["checkout-index", "--all", `--prefix=${directory.replaceAll("\\", "/")}/`]);
    if (existsSync(path.join(root, "node_modules")))
      symlinkSync(path.join(root, "node_modules"), path.join(directory, "node_modules"), "junction");
    return { root: directory, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

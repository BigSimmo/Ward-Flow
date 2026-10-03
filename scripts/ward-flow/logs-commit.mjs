#!/usr/bin/env node
// Commit any change to the shared Ward Flow notes (D:/Repos/ward-flow-logs), so an emptied or
// damaged file can always be brought back from history (26 September 2026: a clean-up emptied the
// old notes folder, which had no history and no backup).
//
//   node scripts/ward-flow/logs-commit.mjs "<why>" <exact-owned-file> [<exact-owned-file> ...]
//
// Explicit operator action only. Refuse missing ownership scope or a pre-existing staged index;
// never commit another task's staged notes or stage a directory wholesale.
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LOGS = process.env.WARD_FLOW_LOGS ?? "D:/Repos/ward-flow-logs";
const TRACKED = ["fold-queue.md", "sign-out.md", "gate-running.md", "AGENT-RULES.md", "README.md", "drafts", "rebuild"];

/** @param {string} [reason] @param {{logs?:string,ownedFiles?:string[]}} [options] */
export function commitLogs(reason = "manual", { logs = LOGS, ownedFiles = [] } = {}) {
  if (!ownedFiles.length) return "refused: name exact owned files explicitly";
  if (!existsSync(path.join(logs, ".git"))) return "no history in the notes folder";
  const git = (...args) =>
    execFileSync("git", ["-C", logs, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (git("diff", "--cached", "--name-only").trim()) return "refused: notes index already contains staged work";
  for (const file of ownedFiles) {
    if (
      path.isAbsolute(file) ||
      file.includes("\\") ||
      file.split("/").some((part) => part === ".." || !part) ||
      !TRACKED.some((name) => file === name || file.startsWith(`${name}/`))
    )
      throw new Error("Only exact owned shared-note paths can be committed");
    if (existsSync(path.join(logs, file)) && !statSync(path.join(logs, file)).isFile())
      throw new Error("Shared-note directories cannot be staged wholesale");
  }
  git("add", "--", ...ownedFiles);
  if (git("diff", "--cached", "--name-only").trim() === "") return "no change";
  git("commit", "-q", "-m", `notes: ${reason}`);
  return "committed";
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = commitLogs(process.argv[2] ?? "manual", { ownedFiles: process.argv.slice(3) });
    console.log(`logs-commit: ${result}`);
    if (result.startsWith("refused:")) process.exitCode = 1;
  } catch (error) {
    console.log(`logs-commit: skipped (${error instanceof Error ? error.message.split("\n")[0] : error})`);
    process.exitCode = 1;
  }
}

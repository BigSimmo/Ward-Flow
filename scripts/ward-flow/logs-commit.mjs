#!/usr/bin/env node
// Commit any change to the shared Ward Flow notes (D:/Repos/ward-flow-logs), so an emptied or
// damaged file can always be brought back from history (26 September 2026: a clean-up emptied the
// old notes folder, which had no history and no backup).
//
//   node scripts/ward-flow/logs-commit.mjs ["<why>"]
//
// Called automatically after every run-slot run and every fold-lock release. Never fails its caller:
// any problem is printed and the process exits 0. Stages only the shared files and folders by name,
// never the caches (they are git-ignored), and never rewrites history.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LOGS = process.env.WARD_FLOW_LOGS ?? "D:/Repos/ward-flow-logs";
const TRACKED = ["fold-queue.md", "sign-out.md", "gate-running.md", "AGENT-RULES.md", "README.md", "drafts", "rebuild"];

export function commitLogs(reason = "auto") {
  if (!existsSync(path.join(LOGS, ".git"))) return "no history in the notes folder";
  const git = (...args) => execFileSync("git", ["-C", LOGS, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const present = TRACKED.filter((name) => existsSync(path.join(LOGS, name)));
  if (present.length === 0) return "nothing to stage";
  git("add", "--", ...present);
  if (git("diff", "--cached", "--name-only").trim() === "") return "no change";
  git("commit", "-q", "-m", `notes: ${reason}`);
  return "committed";
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(`logs-commit: ${commitLogs(process.argv[2] ?? "manual")}`);
  } catch (error) {
    console.log(`logs-commit: skipped (${error instanceof Error ? error.message.split("\n")[0] : error})`);
  }
}

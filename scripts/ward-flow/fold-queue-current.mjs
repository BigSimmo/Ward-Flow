#!/usr/bin/env node
// Show the queue's current READY commits. The append-only notes remain the history.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LINE = "codex/task-ward-flow-live-state-20260831";
const QUEUE = "D:/Repos/ward-flow-logs/fold-queue.md";
const READY = /^READY(?:-FAST(?:-ENGINE)?)?$/;
const WITHDRAWN = /^(?:NOT READY|PARKED|HOLD|DEFERRED)(?:\b|\s)/;

export function currentReadyEntries(queueText) {
  const latest = new Map();
  for (const [index, line] of queueText.split(/\r?\n/).entries()) {
    const fields = line.split("|").map((field) => field.trim());
    const lane = fields[0];
    if (!READY.test(lane) && !WITHDRAWN.test(lane)) continue;
    const branch = /^ward\/[\w./-]+/.exec(fields[2] ?? "")?.[0];
    if (!branch) continue;
    if (!READY.test(lane)) {
      latest.set(branch, null);
      continue;
    }
    const sha = /^(?:[0-9a-f]{7,40})$/i.test(fields[3] ?? "") ? fields[3] : null;
    latest.set(branch, sha ? { lane, branch, sha, index } : null);
  }
  return [...latest.values()]
    .filter(Boolean)
    .sort((a, b) => a.index - b.index)
    .map(({ index, ...entry }) => entry);
}

export function activeStewardClaims(queueText) {
  const attempts = new Map();
  const unscoped = new Set();
  for (const raw of queueText.split(/\r?\n/)) {
    const fields = raw
      .replace(/^`n(?=STEWARD )/, "")
      .split("|")
      .map((field) => field.trim());
    if ((fields[0] === "STEWARD RELEASED" || fields[0] === "FREE") && fields[1]) {
      unscoped.delete(fields[1]);
      for (const [branch, owners] of attempts) {
        const active = owners.filter((owner) => owner !== fields[1]);
        if (active.length) attempts.set(branch, active);
        else attempts.delete(branch);
      }
    }
    if (fields[0] !== "STEWARD IN PROGRESS" || !fields[1]) continue;
    const branches = (fields[2] ?? "").split(/[,\s]+/).filter((value) => /^ward\/[\w./-]+$/.test(value));
    if (branches.length === 0) unscoped.add(fields[1]);
    for (const branch of branches) {
      const owners = attempts.get(branch) ?? [];
      if (!owners.includes(fields[1])) attempts.set(branch, [...owners, fields[1]]);
    }
  }
  return {
    claims: [...attempts].map(([branch, [owner]]) => ({ branch, owner })),
    conflicts: [...attempts].flatMap(([branch, owners]) =>
      owners.slice(1).map((later) => ({ branch, first: owners[0], later })),
    ),
    unscoped: [...unscoped],
  };
}

const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
if (process.argv[1] && same(process.argv[1], fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
  const queue = option("--queue", QUEUE);
  const line = option("--line", LINE);
  if (!queue || !line) {
    console.error("Usage: fold-queue-current.mjs [--queue <file>] [--line <ref>] [--json]");
    process.exit(2);
  }
  const git = (argv) => execFileSync("git", argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const branches = new Map(
    git(["for-each-ref", "--format=%(refname:short)%09%(objectname)", "refs/heads/ward/"])
      .split("\n")
      .filter(Boolean)
      .map((entry) => entry.split("\t")),
  );
  const folded = new Set(
    git(["for-each-ref", `--merged=${line}`, "--format=%(refname:short)", "refs/heads/ward/"])
      .split("\n")
      .filter(Boolean),
  );
  const queueText = readFileSync(queue, "utf8");
  const claimState = activeStewardClaims(queueText);
  const claimOwners = new Map(claimState.claims.map(({ branch, owner }) => [branch, owner]));
  const ready = [];
  const skipped = [];
  for (const entry of currentReadyEntries(queueText)) {
    const tip = branches.get(entry.branch);
    const reason = !tip
      ? "branch missing"
      : !tip.startsWith(entry.sha)
        ? "branch moved after READY"
        : folded.has(entry.branch)
          ? "already folded"
          : null;
    (reason ? skipped : ready).push(
      reason ? { ...entry, reason } : { ...entry, steward: claimOwners.get(entry.branch) ?? null },
    );
  }
  if (args.includes("--json"))
    console.log(
      JSON.stringify({ ready, skipped, claimConflicts: claimState.conflicts, unscopedClaims: claimState.unscoped }),
    );
  else {
    for (const entry of ready)
      console.log(
        `${entry.lane} | ${entry.branch} | ${entry.sha}${entry.steward ? ` | steward: ${entry.steward}` : ""}`,
      );
    console.log(
      `Current READY: ${ready.length}; stale or folded: ${skipped.length}; overlapping claims: ${claimState.conflicts.length}; unscoped claims: ${claimState.unscoped.length}.`,
    );
  }
}

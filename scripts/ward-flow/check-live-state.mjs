#!/usr/bin/env node

/**
 * Report-only Ward Flow live-state checker.
 *
 * This script reads docs/ward-flow/live-state.json and compares its local Git
 * assertions with the current machine. It never fetches, writes, stages,
 * commits, cleans, or contacts a provider.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.argv.length !== 2) {
  console.error("[ward-flow-state] REFUSED: this checker accepts no arguments.");
  process.exit(2);
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
const statePath = path.join(repositoryRoot, "docs", "ward-flow", "live-state.json");
const state = JSON.parse(readFileSync(statePath, "utf8"));
const drift = [];
const information = [];

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).replace(/[\r\n]+$/, "");
}

function lines(text) {
  if (!text) return [];
  return text.replaceAll("\r", "").split("\n").filter(Boolean).sort();
}

function compare(label, actual, expected) {
  if (actual !== expected) {
    drift.push(label + ": expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
  }
}

function compareList(label, actual, expected) {
  const actualText = JSON.stringify([...actual].sort());
  const expectedText = JSON.stringify([...expected].sort());
  if (actualText !== expectedText) {
    drift.push(label + ": expected " + expectedText + ", got " + actualText);
  }
}

/**
 * A checkout that is GONE is DRIFT — named, counted, and it makes the run non-clean.
 *
 * 🔴 WHAT THIS REPLACES, AND WHY THE OLD BEHAVIOUR WAS WORSE THAN A CRASH THAT SAID SO.
 * `execFileSync("git", args, { cwd })` with a `cwd` that no longer exists makes Node report
 * ENOENT naming the COMMAND — so the script died with "spawnSync git ENOENT" and BLAMED GIT.
 * Git is fine. Anyone reading that message goes looking for a broken toolchain, and the real
 * finding — that five of this snapshot's eight asserted paths are gone — was never reported at
 * all, because the first one killed the run.
 *
 * ⚠️ AND THE OBVIOUS FIX IS THE WRONG ONE: swallow the error and carry on. A checker that
 * SKIPS a path it cannot reach reports CLEAN over ground it never walked, which is the defect
 * this whole file exists to detect. So a missing checkout is pushed as drift and its remaining
 * assertions are recorded as UNVERIFIED — never as passed, and never as absent.
 */
function checkoutMissing(label, checkout) {
  if (existsSync(checkout)) return false;
  drift.push(
    label +
      ": the checkout is GONE from disk — " +
      checkout +
      " does not exist, so every assertion about it is UNVERIFIED rather than passed",
  );
  return true;
}

function checkoutStatus(checkout) {
  const output = git(checkout, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const statusLines = lines(output);
  return {
    tracked: statusLines.filter((line) => !line.startsWith("?? ")),
    untracked: statusLines.filter((line) => line.startsWith("?? ")),
  };
}

try {
  const anchor = state.repository.anchorCheckout;
  const anchorGone = checkoutMissing("repository anchor checkout", anchor);
  if (anchorGone) {
    // 🔴 EVERY REMAINING ASSERTION READS THROUGH THE ANCHOR. Without it nothing below can be
    // checked, so the run reports what it could not walk and stops — rather than continuing and
    // reporting a clean tail over ground it never reached.
    console.error("[ward-flow-state] DRIFT: " + drift.length + " assertion(s) changed.");
    for (const item of drift) console.error("[ward-flow-state] - " + item);
    console.error("[ward-flow-state] UNVERIFIED: every other assertion, because the anchor checkout is gone.");
    process.exit(1);
  }
  compare(
    "local origin working-branch ref",
    git(anchor, ["rev-parse", "origin/claude/ward-flow-phases-6-7-design"]),
    state.localRemoteEvidence.originWorkingBranchRef,
  );

  const working = state.workingLine;
  const workingGone = checkoutMissing("working line", working.checkout);
  if (!workingGone) {
    compare("working-line branch", git(working.checkout, ["branch", "--show-current"]), working.branch);
    compare("working-line HEAD", git(working.checkout, ["rev-parse", "HEAD"]), working.head);
    const workingStatus = checkoutStatus(working.checkout);
    compareList("working-line tracked status", workingStatus.tracked, working.status.tracked);
    compare("working-line untracked count", workingStatus.untracked.length, working.status.untrackedCount);
    const wardDocumentCount = lines(git(anchor, ["ls-tree", "-r", "--name-only", working.head, "--", "docs"])).filter(
      (entry) => /ward-flow|ward_management|ward-management/i.test(entry),
    ).length;
    compare("working-line Ward document count", wardDocumentCount, working.wardDocumentCount);
  }

  const originBranchRelation = git(anchor, [
    "rev-list",
    "--left-right",
    "--count",
    "origin/claude/ward-flow-phases-6-7-design..." + working.branch,
  ])
    .split(/\s+/)
    .map(Number);
  compare(
    "origin working-branch left-only count",
    originBranchRelation[0],
    working.originWorkingBranchRelation.leftOnly,
  );
  compare(
    "local working-line right-only count",
    originBranchRelation[1],
    working.originWorkingBranchRelation.rightOnly,
  );

  for (const checkout of state.checkouts) {
    if (checkoutMissing(checkout.id, checkout.checkout)) continue;
    compare(checkout.id + " branch", git(checkout.checkout, ["branch", "--show-current"]), checkout.branch);
    compare(checkout.id + " HEAD", git(checkout.checkout, ["rev-parse", "HEAD"]), checkout.head);
    const status = checkoutStatus(checkout.checkout);
    compareList(checkout.id + " tracked status", status.tracked, checkout.trackedStatus);
    compare(checkout.id + " untracked count", status.untracked.length, checkout.untrackedCount);

    const relation = git(anchor, ["rev-list", "--left-right", "--count", working.branch + "..." + checkout.branch])
      .split(/\s+/)
      .map(Number);
    compare(checkout.id + " working-only commits", relation[0], checkout.relationFromWorkingLine.workingOnly);
    compare(checkout.id + " checkout-only commits", relation[1], checkout.relationFromWorkingLine.checkoutOnly);
  }

  for (const directory of state.chatDirectories) {
    /*
     * 🔴 A VANISHED DIRECTORY IS REPORTED AS VANISHED, NOT AS A COUNT THAT CAME OUT WRONG.
     *
     * This used to substitute -1 for the entry count when the directory was gone, so the drift
     * line read "expected 0, got -1". ⚠️ A reader learns that a COUNT is wrong; they do not learn
     * that a FOLDER no longer exists — and -1 is not a number of entries, it is a sentinel wearing
     * one. **That is the same defect the rest of this pass exists to remove**, where an absent
     * path produced an error naming git: the report pointed at the wrong thing.
     *
     * Found by Ward Verifier checking this work rather than reading it, after I had fixed the
     * checkout loop and left this one — the sample treated as the population, one more time.
     */
    if (!existsSync(directory.path)) {
      drift.push(
        directory.chat +
          ": the chat directory is GONE from disk — " +
          directory.path +
          " does not exist, so its Git metadata and entry count are UNVERIFIED rather than wrong",
      );
      continue;
    }
    const hasGitMetadata = existsSync(path.join(directory.path, ".git"));
    compare(directory.chat + " Git metadata", hasGitMetadata, directory.expectedGitMetadata);
    compare(
      directory.chat + " directory entry count",
      readdirSync(directory.path).length,
      directory.expectedEntryCount,
    );
  }

  for (const document of state.sourceDocuments) {
    const entry = git(anchor, ["ls-tree", document.ref, "--", document.path]);
    const fields = entry.split(/\s+/);
    compare(document.purpose + " blob", fields[2] ?? "", document.blob);
  }

  const audit = state.priorProcessAudit;
  const auditPath = path.isAbsolute(audit.path) ? audit.path : path.join(repositoryRoot, ...audit.path.split("/"));
  if (!existsSync(auditPath)) {
    drift.push("prior process audit: missing " + auditPath);
  } else {
    compare("prior process audit byte count", statSync(auditPath).size, audit.bytes);
    const auditHash = createHash("sha256").update(readFileSync(auditPath)).digest("hex").toUpperCase();
    compare("prior process audit SHA-256", auditHash, audit.sha256);
    information.push("Prior process audit is durably available at " + auditPath + ".");
  }
} catch (error) {
  console.error("[ward-flow-state] ERROR: " + (error instanceof Error ? error.message : String(error)));
  process.exit(2);
}

console.log("[ward-flow-state] REPORT ONLY — no files, refs, worktrees, or providers were changed.");
console.log("[ward-flow-state] Snapshot: " + state.capturedAt + ".");
for (const item of information) console.log("[ward-flow-state] INFO: " + item);

if (drift.length > 0) {
  console.error("[ward-flow-state] DRIFT: " + drift.length + " assertion(s) changed.");
  for (const item of drift) console.error("[ward-flow-state] - " + item);
  process.exit(1);
}

console.log(
  "[ward-flow-state] PASS: the integration line, " +
    state.checkouts.length +
    " auxiliary Git checkouts, and the empty Referrals chat directory match the snapshot.",
);

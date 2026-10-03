#!/usr/bin/env node
// Explicit, transactional exact-file claims in the existing sign-out log. No takeover or release automation.
import {
  appendFileSync,
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  realpathSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { isPublicWardFlowCheckout, signOutConflicts, unsignedWardFiles } from "../pre-commit-checks.mjs";

export function validateClaimPaths(root, files) {
  if (!files.length || new Set(files).size !== files.length) throw new Error("Name unique exact files");
  const physicalRoot = realpathSync(root);
  for (const file of files) {
    if (
      path.isAbsolute(file) ||
      /[\\,;:|\s*?]/u.test(file) ||
      file.startsWith("-") ||
      /^\.git(?:\/|$)/u.test(file) ||
      file.split("/").some((part) => !part || part === "." || part === "..")
    )
      throw new Error("Unsafe claim path");
    let parent = path.join(root, file);
    if (existsSync(parent) && !statSync(parent).isFile()) throw new Error("Claim exact files, never directories");
    while (!existsSync(parent)) parent = path.dirname(parent);
    const relative = path.relative(physicalRoot, realpathSync(parent));
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
      throw new Error("Claim leaves the physical checkout");
  }
}

const PROTECTED_BRANCHES = /^(?:main|master|develop|release\/.*)$/u;

export function claimFiles({ root, branch, owner, files, log, currentBranch = "" }) {
  validateClaimPaths(root, files);
  if (
    !/^[\w./-]+$/u.test(branch) ||
    !owner ||
    /[|\r\n]/u.test(owner) ||
    /Josh approved scoped (?:overlap|takeover) in this chat/iu.test(owner)
  )
    throw new Error("Invalid claim identity; this helper cannot encode takeover approval");
  if (PROTECTED_BRANCHES.test(branch)) throw new Error("Claims need a task branch, not a protected branch");
  if (!isPublicWardFlowCheckout(root)) throw new Error("Verified dedicated Ward Flow checkout required");
  const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 30_000 }).trim();
  if ((currentBranch || git(["branch", "--show-current"])) !== branch) throw new Error("Claim branch is not current");
  const lock = `${log}.claim-lock`;
  const descriptor = openSync(lock, "wx"); // Busy locks are never reclaimed by age.
  const identity = JSON.stringify({
    pid: process.pid,
    token: randomUUID(),
    branch,
    createdAt: new Date().toISOString(),
  });
  try {
    writeFileSync(descriptor, identity);
    const text = readFileSync(log, "utf8");
    if (!text.includes("## Active sign-outs") && !/^Open sign-outs only\b/mu.test(text))
      throw new Error("Unknown sign-out format; do not append invisible claims");
    if (text.includes("## Active sign-outs") && text.indexOf("\n## ", text.indexOf("## Active sign-outs") + 1) >= 0)
      throw new Error("Active section is not append-only at the end; owner must maintain the log");
    const conflicts = signOutConflicts(files, text, branch, root);
    if (conflicts.length)
      throw new Error(`Active ownership conflict: ${conflicts.map((item) => item.file).join(", ")}`);
    const missing = unsignedWardFiles(files, text, branch, root);
    if (!missing.length) return { claimed: [], alreadyOwned: files };
    execFileSync(process.execPath, [path.join(root, "scripts/ward-flow/sign-out-check.mjs"), ...missing], {
      cwd: root,
      env: { ...process.env, WARD_SIGNOUT_FILE: log },
      timeout: 60_000,
      stdio: "pipe",
    });
    // Manual writers do not share the lock. Reject detected concurrent changes.
    if (readFileSync(log, "utf8") !== text)
      throw new Error("Sign-out changed during inspection; retry against fresh state");
    appendFileSync(
      log,
      `\n- ${new Date().toISOString()} | ${owner} | ${branch} | ${root.replaceAll("\\", "/")} | ${missing.join(", ")}. repo=BigSimmo/Ward-Flow. Exact checked claims; no takeover.\n`,
    );
    return { claimed: missing, alreadyOwned: files.filter((file) => !missing.includes(file)) };
  } finally {
    closeSync(descriptor);
    // Never remove a replacement lock installed by another writer/operator.
    if (existsSync(lock) && readFileSync(lock, "utf8") === identity) unlinkSync(lock);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
    const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
    const files = process.argv.slice(2);
    console.log(
      JSON.stringify(
        claimFiles({
          root,
          branch,
          files,
          owner: "Codex exact-file claim",
          log: process.env.WARD_SIGNOUT_FILE ?? "D:/Repos/ward-flow-logs/sign-out.md",
        }),
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

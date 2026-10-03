#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { childProcessExitCode } from "./child-process-result.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Does this path decide Prettier's verdict for files other than itself?
 * Mirrors `scripts/guard-push.mjs` so CI and the pre-push hook escalate the same
 * policy-file set (a changed-paths-only check cannot see tree-wide drift).
 */
function carriesPrettierField(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")).prettier !== undefined;
  } catch {
    // Unparseable: assume it is policy rather than assume it is not.
    return true;
  }
}

export function isPrettierPolicyFile(filePath, root = projectRoot) {
  const base = path.basename(filePath);
  if (/^(?:\.prettierrc(?:\..+)?|prettier\.config\.(?:js|cjs|mjs|ts)|\.prettierignore|\.editorconfig)$/.test(base)) {
    return true;
  }
  if (base !== "package.json") return false;
  return carriesPrettierField(path.join(root, filePath));
}

/** Include removals and old package policy, even when the new file has no policy field. */
export function formatPolicyChanged(files, root = projectRoot, base = "origin/main") {
  return files.some((file) => {
    if (isPrettierPolicyFile(file, root)) return true;
    if (path.basename(file) !== "package.json") return false;
    try {
      const previous = execFileSync("git", ["show", `${base}:${file}`], {
        cwd: root,
        encoding: "utf8",
        timeout: 30_000,
      });
      return JSON.parse(previous).prettier !== undefined;
    } catch {
      return true;
    } // Unknown old policy must not evade the broad check.
  });
}

const git = (root, args) => execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 30_000 });
const paths = (output) => output.split("\0").filter(Boolean);
export function validateFormatPaths(files, root = projectRoot) {
  return [...new Set(files)].map((file) => {
    if (
      !file ||
      file.startsWith("-") ||
      file.includes("\0") ||
      path.isAbsolute(file) ||
      file.split(/[\\/]/u).includes("..")
    )
      throw new Error(`Invalid format path: ${file}`);
    const normal = file.replaceAll("\\", "/").replace(/^\.\//u, "");
    if (!path.resolve(root, normal).startsWith(`${path.resolve(root)}${path.sep}`))
      throw new Error(`Format path escapes repository: ${file}`);
    const absolute = path.resolve(root, normal);
    if (
      existsSync(absolute) &&
      (!statSync(absolute).isFile() || !realpathSync(absolute).startsWith(`${realpathSync(root)}${path.sep}`))
    )
      throw new Error(`Format scope must be an existing in-repository file: ${file}`);
    return normal;
  });
}
export function changedFormatPaths(root = projectRoot, base = "origin/main") {
  const committed = paths(git(root, ["diff", "--name-only", "-z", `${base}...HEAD`, "--"]));
  const working = paths(git(root, ["diff", "--name-only", "-z", "HEAD", "--"]));
  const untracked = paths(git(root, ["ls-files", "--others", "--exclude-standard", "-z"]));
  return validateFormatPaths([...committed, ...working, ...untracked], root);
}
export function changedFormatFiles(root = projectRoot, base = "origin/main") {
  return changedFormatPaths(root, base).filter((file) => existsSync(path.join(root, file)));
}
export function partialStagedFiles(root, files) {
  const staged = new Set(paths(git(root, ["diff", "--cached", "--name-only", "-z", "--"])));
  const unstaged = new Set(paths(git(root, ["diff", "--name-only", "-z", "--"])));
  return files.filter((file) => staged.has(file) && unstaged.has(file));
}
export async function main(args = process.argv.slice(2), root = projectRoot) {
  const write = args.includes("--write");
  let base = "origin/main";
  let explicitFiles;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--write") continue;
    if (args[index] === "--base") {
      base = args[++index];
      if (!base || base.startsWith("-")) throw new Error("--base requires a Git ref");
      continue;
    }
    if (args[index] === "--files") {
      explicitFiles = args.slice(index + 1);
      if (!explicitFiles.length) throw new Error("--files requires exact owned paths");
      break;
    }
    throw new Error(`Unknown formatting option: ${args[index]}`);
  }
  if (write && !explicitFiles)
    throw new Error("Write mode requires --files followed by exact owned paths; no whole-tree rewrite is implied.");
  const candidates = explicitFiles ? validateFormatPaths(explicitFiles, root) : changedFormatPaths(root, base);
  const files = candidates.filter((file) => existsSync(path.join(root, file)));
  const fullCheck = !write && formatPolicyChanged(candidates, root, base);
  if (!files.length && !fullCheck) {
    console.log("No existing candidate files require formatting.");
    return 0;
  }
  if (write) {
    const partial = partialStagedFiles(root, files);
    if (partial.length) throw new Error(`Refusing to rewrite partially staged files: ${partial.join(", ")}`);
    const { unsignedWardFiles, signOutConflicts } = await import("./pre-commit-checks.mjs");
    const log = process.env.WARD_SIGNOUT_FILE ?? "D:/Repos/ward-flow-logs/sign-out.md";
    if (!existsSync(log)) throw new Error("Formatting ownership cannot be established: sign-out log unavailable.");
    const claims = readFileSync(log, "utf8");
    const branch = git(root, ["branch", "--show-current"]).trim();
    const missing = unsignedWardFiles(files, claims, branch, root);
    const clashes = signOutConflicts(files, claims, branch, root);
    if (missing.length || clashes.length)
      throw new Error(
        `Formatting ownership not established: ${[...missing, ...clashes].map((value) => (typeof value === "string" ? value : JSON.stringify(value))).join("; ")}`,
      );
  }
  const prettierBin = path.join(root, "node_modules/prettier/bin/prettier.cjs");
  if (!existsSync(prettierBin)) throw new Error("Locked local Prettier unavailable; no network fallback.");
  const options = fullCheck
    ? ["--check", "--ignore-unknown", "."]
    : [write ? "--write" : "--check", "--ignore-unknown", "--", ...files];
  console.log(
    `Formatting ${write ? "owned working-tree" : "working-tree candidate"} files; staging remains explicit.${fullCheck ? " Policy changed: whole-tree check only." : ""}`,
  );
  return childProcessExitCode(
    spawnSync(process.execPath, [prettierBin, ...options], { cwd: root, stdio: "inherit", timeout: 120_000 }),
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`[format:changed] ${error.message}`);
      process.exitCode = 1;
    });
}

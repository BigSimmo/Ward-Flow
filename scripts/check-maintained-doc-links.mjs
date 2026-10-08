#!/usr/bin/env node
/** Offline links/anchors in maintained sections of every Git-tracked Markdown file.
 * Reuses the Ward parser's root/symlink checks and explicit history exclusion.
 * Importing this module does not enumerate files or run Git. */
import { execFileSync } from "node:child_process";
import { extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { main as checkLinks } from "./ward-flow/check-doc-links.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

export function checkMaintainedDocLinks(root = ROOT) {
  const files = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  })
    .split("\0")
    .filter((file) => file && extname(file).toLowerCase() === ".md");
  if (!files.length) throw new Error("No tracked Markdown files: maintained documentation scope is unavailable.");
  // In-process arguments preserve names with spaces/newlines and avoid shell/ARG_MAX limits.
  return checkLinks(["--anchors", ...files.flatMap((file) => ["--file", file])], root);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv.length !== 2) throw new Error("Usage: check-maintained-doc-links.mjs");
    process.exitCode = checkMaintainedDocLinks();
  } catch (error) {
    console.error(`maintained doc-link check failed: ${error.message}`);
    process.exitCode = 1;
  }
}

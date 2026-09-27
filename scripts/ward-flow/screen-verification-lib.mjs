#!/usr/bin/env node
/**
 * 🔴 **WF-35 — a screen reading "CURRENT" when only its DRAWING is unchanged.**
 *
 * `screen-verification.mjs`'s old `statusFor` compared the mockup's hash to
 * `docs/ward-flow/mockups/MANIFEST.json` and, on a match, printed the word "CURRENT". That word
 * was read as a claim about the BUILT screen — but a drawing hash match only proves the drawing
 * has not moved since somebody looked at it. It says nothing about `src/components/ward-management/`,
 * which nothing here compared at all. Several rows in `SCREEN-VERIFICATION.md` carried "deviates"
 * next to "CURRENT" at the same time — a screen KNOWN not to match its drawing, reported current.
 *
 * This module pulls that comparison apart into two separate, honestly-named questions, each with
 * its own pure function so both are independently testable:
 *
 *   - **`drawingStatus`** — has the DRAWING moved since the last look? The word "CURRENT" is
 *     retired entirely; a hash match is `"DRAWING UNCHANGED since look"`, never a claim the
 *     screen is right.
 *   - **`implementationFiles` / `implementationSha256` / `implementationStatus`** — has the
 *     BUILT SCREEN moved since the last look? This is new: nothing before this hashed the
 *     component/page source at all. Deliberately NOT written into any generated file the
 *     pre-commit hook watches — an implementation hash is only ever computed on demand
 *     (`--report`, `--hash <mockup>`) so that editing a component can never make a generated
 *     document stale. Only the JSON record (hand-edited by whoever looked) can pin one down.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, sep } from "node:path";

/**
 * How the DRAWING for `mockup` compares to what was on record the last time somebody looked.
 *
 * @param {{ mockupSha256?: string, [key: string]: unknown } | null | undefined} verified - this
 *   screen's JSON `verified` entry, or `null`/`undefined` if nobody has looked yet. The real entry
 *   (see `screen-verification.mjs`) also carries `date`, `who`, `widths`, `themes` and `verdict`;
 *   this function reads only `mockupSha256` and tolerates whatever else the object carries, so the
 *   type says so rather than rejecting a real entry as an unknown shape.
 * @param {string | null | undefined} manifestHash - the mockup's CURRENT hash, looked up by the
 *   caller from `docs/ward-flow/mockups/MANIFEST.json`. Pass `null` when the manifest file
 *   itself does not exist or could not be parsed — that is a different fact from "this mockup
 *   has no entry in an available manifest", which is `undefined` and falls through to STALE,
 *   matching the previous behaviour.
 * @returns {"NOT YET LOOKED AT" | "UNAGEABLE - no hash recorded" | "MANIFEST NOT AVAILABLE" |
 *   "DRAWING UNCHANGED since look" | "🔴 STALE - the drawing changed since"}
 */
export function drawingStatus(verified, manifestHash) {
  if (verified === null || verified === undefined) return "NOT YET LOOKED AT";
  if (!verified.mockupSha256) return "UNAGEABLE - no hash recorded";
  if (manifestHash === null) return "MANIFEST NOT AVAILABLE";
  return manifestHash === verified.mockupSha256 ? "DRAWING UNCHANGED since look" : "🔴 STALE - the drawing changed since";
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

/**
 * Every source file that makes up a screen's BUILT implementation: the whole component folder
 * plus its page file. Read `scripts/ward-flow/screen-pairs.mjs` before calling this for a
 * mockup not already in the roster — `folder` and `route` come from there, and the folder for
 * one roster row (`sign-in-third-edition.html`) is the relative escape `"../ward-flow-sign-in"`,
 * deliberately outside `ward-management/`.
 *
 * @param {string} root - repo root (`process.cwd()` in the CLI).
 * @param {string | null | undefined} folder - the screen folder, third element of a `PAIRS` row;
 *   resolved under `src/components/ward-management/`.
 * @param {string | null | undefined} route - the screen route, second element of a `PAIRS` row.
 * @returns {string[]} absolute file paths, sorted.
 */
export function implementationFiles(root, folder, route) {
  const files = new Set();
  if (folder) {
    for (const file of walk(join(root, "src", "components", "ward-management", folder))) {
      files.add(file);
    }
  }
  if (route) {
    const pageFile = route.startsWith("/mockups/")
      ? join(root, "src", "app" + route, "page.tsx")
      : join(root, "src", "app", "mockups", "ward-flow" + route, "page.tsx");
    if (existsSync(pageFile)) files.add(pageFile);
  }
  return [...files].sort();
}

/**
 * One hash over every file in `files`: for each (sorted, forward-slash relative path), the path,
 * a newline, then its content with CRLF normalised to LF — same "sha256-lf" idea as
 * `scripts/ward-flow/mockup-manifest.mjs`, so a checkout that changes line endings alone cannot
 * flip a screen to CHANGED. `files` in a different order still returns the same hash: this sorts.
 *
 * @param {string} root - the same root `implementationFiles` was called with, so paths are
 *   relative to it rather than absolute (and so the hash is stable across machines/worktrees).
 * @param {string[]} files - absolute file paths.
 * @returns {string | null} lowercase hex sha256, or `null` for an empty file set — there is
 *   nothing to hash, which `implementationStatus` treats as its own loud state rather than
 *   silently agreeing with whatever the record says.
 */
export function implementationSha256(root, files) {
  if (!files || files.length === 0) return null;
  const hash = createHash("sha256");
  for (const file of [...files].sort()) {
    const relativePath = relative(root, file).split(sep).join("/");
    const raw = readFileSync(file);
    const normalized = Buffer.from(raw.toString("binary").split("\r\n").join("\n"), "binary");
    hash.update(relativePath, "utf8");
    hash.update("\n", "utf8");
    hash.update(normalized);
    hash.update("\n", "utf8");
  }
  return hash.digest("hex");
}

/**
 * How the BUILT screen compares to what was on record the last time somebody looked. An empty
 * file set (a folder/route mapping that resolved nothing) is reported before anything else —
 * "nothing found to hash" is a configuration problem worth seeing even for a screen nobody has
 * looked at yet, not something that should quietly read the same as "not recorded".
 *
 * @param {{ implementationSha256?: string, [key: string]: unknown } | null | undefined} verified -
 *   the real entry also carries `mockupSha256`, `date`, `who`, `widths`, `themes` and `verdict`
 *   (see `drawingStatus` above); this function reads only `implementationSha256` and tolerates
 *   whatever else the object carries.
 * @param {string | null} hash - this screen's current implementation hash, from
 *   `implementationSha256`.
 * @returns {"NO SOURCE FOUND" | "NOT RECORDED" | "UNCHANGED since look" | "CHANGED since look"}
 */
export function implementationStatus(verified, hash) {
  if (hash === null || hash === undefined) return "NO SOURCE FOUND";
  const recorded = verified && typeof verified === "object" ? verified.implementationSha256 : undefined;
  if (!recorded) return "NOT RECORDED";
  return recorded === hash ? "UNCHANGED since look" : "CHANGED since look";
}

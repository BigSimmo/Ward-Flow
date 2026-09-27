#!/usr/bin/env node
/**
 * 🔴 **160+ ACCUMULATED LESSONS LIVE ONLY ON ONE MACHINE, WITH NO GIT HISTORY BEHIND THEM.** This
 * keeps a versioned copy in step with the working store, the same way `rules-index.mjs` keeps
 * `RULES.md` in step — read that script first, this one follows its shape.
 *
 * The lesson store (`~/.claude/projects/D--Repos-Database/memory/`) is the WORKING source. Every
 * lesson is edited there, not in the repo. This script only ever copies store -> repo.
 *
 *     node scripts/ward-flow/sync-lessons.mjs            # copy store -> repo
 *     node scripts/ward-flow/sync-lessons.mjs --check    # exit 1 if they differ, naming the files
 *
 * ⚠️ **`--check` IS THE POINT**, exactly as for `rules-index.mjs` — a copy that is merely
 * regenerable still rots if nobody remembers to regenerate it. A gate can run `--check`; nothing
 * can make a human re-run the plain command on a schedule.
 *
 * 🔴 **THIS SCRIPT NEVER DELETES FROM THE REPOSITORY COPY.** The repo copy is the backup. A file
 * present in the repo but gone from the store is reported under "only in repo" and left exactly
 * where it is — that is precisely the moment the backup exists to cover. Deleting it here would
 * make the backup only as durable as the thing it is backing up.
 *
 * ✅ **Comparison is by CONTENT, not timestamp.** A copied file gets a new mtime the instant it is
 * copied; only the bytes say whether the two sides agree. Files are read as raw buffers, never as
 * text, so this is safe for the two lesson files that carry literal NUL bytes as their subject
 * matter — a text-mode read/write can silently reinterpret or strip those.
 *
 * ✅ **If the store does not exist on this machine, this exits 0 with a message and does nothing.**
 * The repository copy must stay usable — readable, diffable, groppable — on a machine that has
 * never had the store. `--check` also treats a missing store as nothing-to-check, since there is
 * nothing on this machine to compare the repo copy against.
 *
 * This proves only that the two trees matched at the moment the script last ran. Exactly like
 * `RULES.md`, it does not prove any lesson is still current — see the store's own first theme.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const STORE = join(
  process.env.USERPROFILE ?? process.env.HOME ?? "",
  ".claude",
  "projects",
  "D--Repos-Database",
  "memory",
);
const REPO_DIR = join(process.cwd(), "docs", "ward-flow", "lessons");

/** Files that live in the repo copy but are never mirrored from the store. */
const REPO_ONLY = new Set(["README.md"]);

function listLessonFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !REPO_ONLY.has(f))
    .sort();
}

function main() {
  const check = process.argv.includes("--check");

  if (!existsSync(STORE)) {
    console.log(
      `lesson store not found at ${STORE} — nothing to sync on this machine.\n` +
        `The versioned copy at docs/ward-flow/lessons/ is unaffected and stays usable as-is.`,
    );
    process.exit(0);
  }

  const storeFiles = listLessonFiles(STORE);
  const storeSet = new Set(storeFiles);

  if (!existsSync(REPO_DIR)) {
    if (check) {
      console.error(`repo copy missing entirely: ${REPO_DIR} does not exist.`);
      console.error(`Run: node scripts/ward-flow/sync-lessons.mjs`);
      process.exit(1);
    }
    mkdirSync(REPO_DIR, { recursive: true });
  }

  const repoFiles = listLessonFiles(REPO_DIR);
  const repoSet = new Set(repoFiles);

  const onlyInStore = storeFiles.filter((f) => !repoSet.has(f));
  const onlyInRepo = repoFiles.filter((f) => !storeSet.has(f));
  const differing = [];
  const matching = [];

  for (const f of storeFiles) {
    if (!repoSet.has(f)) continue;
    const a = readFileSync(join(STORE, f));
    const b = readFileSync(join(REPO_DIR, f));
    if (a.equals(b)) matching.push(f);
    else differing.push(f);
  }

  if (check) {
    let failing = false;

    if (onlyInStore.length) {
      failing = true;
      console.error(`ONLY IN STORE — new lesson(s) not yet copied into the repo (${onlyInStore.length}):`);
      for (const f of onlyInStore) console.error(`  ${f}`);
    }

    if (differing.length) {
      failing = true;
      console.error(`DIFFERING CONTENT — repo copy is stale for (${differing.length}):`);
      for (const f of differing) console.error(`  ${f}`);
    }

    if (onlyInRepo.length) {
      // Not a failure. Reported, never deleted — see the header.
      console.log(
        `ONLY IN REPO — no longer present in the store, kept as-is, NOT deleted (${onlyInRepo.length}):`,
      );
      for (const f of onlyInRepo) console.log(`  ${f}`);
    }

    if (failing) {
      console.error(`\nRun: node scripts/ward-flow/sync-lessons.mjs`);
      process.exit(1);
    }

    console.log(
      `lesson copy is current — ${matching.length} lesson(s) match byte-for-byte` +
        (onlyInRepo.length ? `, ${onlyInRepo.length} kept in repo only (listed above).` : "."),
    );
    process.exit(0);
  }

  // Sync mode: copy store -> repo. Never touch onlyInRepo.
  let copied = 0;
  for (const f of [...onlyInStore, ...differing]) {
    writeFileSync(join(REPO_DIR, f), readFileSync(join(STORE, f)));
    copied += 1;
  }

  if (onlyInRepo.length) {
    console.log(
      `NOTE — ${onlyInRepo.length} file(s) exist in the repo copy but not in the store. Kept, not deleted:`,
    );
    for (const f of onlyInRepo) console.log(`  ${f}`);
  }

  console.log(
    `synced ${copied} file(s) from store to repo (${matching.length} already matched). ` +
      `store has ${storeFiles.length} lessons; repo now has ${listLessonFiles(REPO_DIR).length}.`,
  );
}

main();

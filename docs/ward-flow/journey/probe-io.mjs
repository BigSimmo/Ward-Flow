/*
 * SAFE FILE HANDLING FOR THE PROBES — added 2026-09-22, after they destroyed real work.
 *
 * Every proof in this folder does the same thing: read a real source file, deliberately break it,
 * check the build refuses, put it back. All of them already wrapped the restore in `finally`, which
 * is the obvious precaution and is not enough, because THE RESTORE ITSELF CAN FAIL.
 *
 * 🔴 WHAT ACTUALLY HAPPENED. On this Windows machine `fs.writeFileSync` intermittently throws
 * `UNKNOWN (errno -4094)` — a transient lock, from an indexer or a scanner, lasting under a second.
 * When it lands on the restore inside `finally`, the `finally` has already done its job and the
 * broken version stays on disk. The next proof then reads that broken file as ITS baseline, breaks
 * it further, and "restores" the damage. Three proofs in a row failed on contamination they were
 * preserving for each other, and one of them silently reverted a day's edits to `rebuild-map.mjs` —
 * which looked exactly like the edits never having been made.
 *
 * ⚠️ A GENERATED ARTEFACT IS NEVER ITS OWN RESTORE POINT, and a restore that can fail silently is
 * not a restore. Two things close it:
 *
 *   `guardClean` — refuse to START if the file already carries a probe's marker. A dirty file means
 *   an earlier run was interrupted; adopting it as a baseline is how the damage becomes permanent.
 *
 *   `restore` — retry the write through a transient lock, and if it truly cannot be written, say so
 *   as loudly as possible and name the file, because at that moment the repository is damaged and
 *   the person at the keyboard is the only thing that can fix it.
 */
import fs from "node:fs";

/** Lock-shaped failures worth retrying. Anything else is a real error and is rethrown at once. */
const TRANSIENT = new Set(["UNKNOWN", "EBUSY", "EPERM", "EACCES", "EMFILE"]);

/**
 * Put a file back, surviving a transient lock. Never swallows a failure: if every attempt fails the
 * process exits non-zero with the file named, because a proof that leaves the tree broken and exits
 * 0 is worse than one that never ran.
 */
export function restore(file, contents, attempts = 12) {
  for (let i = 1; i <= attempts; i++) {
    try {
      fs.writeFileSync(file, contents);
      return;
    } catch (e) {
      if (!TRANSIENT.has(e.code) || i === attempts) {
        console.error(
          `\n🔴 COULD NOT PUT ${file} BACK — the probe's change is still on disk and the repository is damaged.\n` +
            `   ${e.code}: ${e.message}\n` +
            `   Restore it from git before doing anything else, then run \`npm run ward:journey\`.\n`,
        );
        process.exit(1);
      }
      // Busy-wait briefly: this is a sub-second lock and the alternative is an async rewrite of
      // every probe for a case that resolves faster than a timer would fire.
      const until = Date.now() + 120;
      while (Date.now() < until) {
        /* wait */
      }
    }
  }
}

/**
 * The same stubborn write, under the name that reads correctly when a probe is BREAKING a file
 * rather than putting it back. Both directions need it: a lock that lands on the injection aborts
 * the run just as surely, and an aborted run is a proof nobody saw pass.
 */
export const writeStubbornly = restore;

/**
 * Refuse to start when the file already carries something only a probe writes. `markers` are exact
 * substrings; naming them here is what makes the check honest — a probe that cannot say what its
 * own damage looks like cannot detect it.
 */
export function guardClean(file, markers) {
  const onDisk = fs.readFileSync(file, "utf8");
  const found = markers.filter((m) => onDisk.includes(m));
  if (!found.length) return onDisk;
  console.error(
    `REFUSING TO PROVE — ${file} already contains ${found.join(" and ")}, which only a probe writes.\n` +
      "  An earlier run was interrupted between breaking the file and putting it back, so what is on\n" +
      "  disk is damaged. Taking it as a baseline would make the damage permanent and would quietly\n" +
      "  discard any real edit made since.\n" +
      "  Restore this file from git, run `npm run ward:journey`, then prove again.",
  );
  process.exit(1);
}

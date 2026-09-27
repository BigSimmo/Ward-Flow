#!/usr/bin/env node
/**
 * Ratchet: the count of `--text-3xs` and `--text-2xs` uses in ward CSS may FALL, never RISE.
 *
 * WHY THIS EXISTS (owner ruling D-3, `docs/ward-flow/owner-decisions-2026-09-1x.md`, 2026-09-10).
 *
 * The ward design standard says nothing on screen is set below 12px. The app's type scale reaches
 * 10px (`--text-3xs`, defined in `src/app/globals.css`) and 11px (`--text-2xs`) — both below that
 * floor — and `scripts/check-type-scale.mjs` calls 10px the floor in its own comment. A builder
 * obeying the standard and a builder obeying the linter have been obeying different rules, and only
 * the linter was checked. Hundreds of existing declarations already sit below 12px.
 *
 * 🔴 THE OWNER REFUSED A SWEEP. Changing every one of them at once would relayout every ward screen
 * simultaneously — text that fits today would stop fitting (wrapped headings, clipped labels,
 * overflowing counts) — trading a legibility problem that can be SEEN for a breakage problem that
 * cannot. Instead: no NEW sub-12px declarations from now on, and the existing ones are raised
 * screen by screen as each of the sixteen ward screens is rebuilt (near-zero cost at that moment,
 * because the rebuild re-lays the screen out anyway; high cost at any other).
 *
 * That is a RATCHET, not a floor check: it must never redden on the hundreds of pre-existing uses
 * (a guard that fails on day one over work nobody is touching gets switched off within the hour —
 * this is the same lesson `check-source-control-chars.mjs` and `check-errata-freshness.mjs` in this
 * directory are built around), and it must redden the moment a NEW one is added anywhere the sweep
 * below can see.
 *
 * WHAT THIS SCRIPT COUNTS, PRECISELY — read this before trusting the number.
 *
 *   population   every file matching `src/components/ward-management/**\/*.module.css` that
 *                `git ls-files` reports (tracked files only — this deliberately will not see an
 *                untracked scratch file, matching how every other measurement in this repo works
 *                off the committed tree).
 *   counted      every substring occurrence of `--text-3xs` or `--text-2xs` in each file's text —
 *                a `font-size: var(--text-3xs)` declaration counts once; the same string inside a
 *                COMMENT counts too, and all of them are included in the baseline below.
 *
 *                ⚠️ NO NUMBER IS GIVEN HERE, DELIBERATELY, AND THAT IS THE SECOND REPAIR OF THIS
 *                LINE IN ONE DAY. It first said "there is exactly one such comment in the tree
 *                today", naming one file — true when written, silently false later. It was then
 *                corrected to "FOUR, across TWO files". THAT WAS ALSO WRONG. The true figure at the
 *                time of writing was FIVE across two files, and it will be wrong again by the time
 *                you read this, which is the point: counting these means masking every CSS comment
 *                span and counting the occurrences that fall inside it, and any sentence here
 *                stating the answer is a pin that invalidates itself in silence. Re-derive it; do
 *                not quote this paragraph.
 *
 *                🔴 TWO CHATS MEASURED IT AND BOTH GOT FOUR, AND ONLY ONE OF THOSE FOURS WAS A
 *                MISTAKE. Mine was: I matched lines that LOOK like comments and missed a token on
 *                a continuation line starting with neither a slash-star nor a star. The other
 *                chat's four was CORRECT — for ITS tree. The occurrence it "missed" in a second
 *                file did not exist there: the comment carrying it was committed later, and git
 *                confirms the introducing commit is not an ancestor of the tree it measured.
 *
 *                ⚠️ SO THE DISAGREEMENT WAS NEVER ABOUT METHOD. It was two correct measurements of
 *                two different trees, argued as if one of us had counted badly — and it escalated
 *                to "you misclassified live declarations as prose", which nobody had done. 🔴 WHEN
 *                TWO COUNTS OF "THE SAME THING" DIFFER, NAME THE TREE BEFORE DISPUTING THE METHOD.
 *                A figure here is a claim about one commit, and this file changes nightly.
 *
 *                ⚠️ And the totals agreed at four while their compositions did not, which is the
 *                more dangerous half — an agreeing total from a different composition is a
 *                coincidence rather than a corroboration, and a disagreement at least gets
 *                investigated.
 *
 *                🔴 THE CONTROL IS THE REUSABLE PART. The settled figure came from masking comment
 *                spans by character index and reconciling against this script's own total: live
 *                declarations plus in-comment occurrences must equal what the ratchet reports. A
 *                count of things inside comments has no natural check, so give it one by making it
 *                agree with a number measured another way.
 *
 *                🔴 THE OWNER RULED ON THIS 2026-09-12: comments are NOT special-cased, and D-3 is
 *                NOT to be documented inside ward CSS — the explanation lives in THIS script. A
 *                ratchet that skipped comments would need its own test proving it still catches a
 *                declaration disguised as one, which is how a guard learns to miss the thing it
 *                exists for.
 *
 *                ⚠️ AND THE FIRST FILE THE PER-FILE ARM EVER CAUGHT WAS AN HONEST COMMENT, NOT A
 *                SLOPPY DECLARATION — a newly built Alerts screen carrying ZERO sub-floor
 *                declarations turned this red at `0 → 2`, because its author had documented D-3
 *                correctly and named both tokens in order to explain them. Repaired by DESCRIBING
 *                the tokens instead of naming them. (Relayed by Ward Lead from a branch not in this
 *                tree — recorded here as reported, not as something this tree can show you. The
 *                mechanism above is what IS measurable here, and it is what makes the story
 *                possible.) The cost of the ruling is paid by authors in good faith, so the reason
 *                for it needs to be findable, and this is where it is findable.
 *   NOT counted  anything outside `src/components/ward-management/` — this excludes the flow-map
 *                mockups under `docs/ward-flow/mockups/`, which D-3 explicitly leaves unchanged
 *                (its 10.5/11.5px stands, and it is a drawing rather than shipped ward CSS to begin
 *                with, so it was never in this population). It also excludes every other CSS module
 *                in the app outside ward-management, `check-type-scale.mjs`'s Tailwind-arbitrary-
 *                value sweep, and any raw `10px`/`11px` written without going through the token.
 *
 * Measured against this tree on 2026-09-10: 393 occurrences across 39 files. That is the SAME
 * figure D-3 records as "393 across 39" (one of the two honest counts it lists, neither called
 * authoritative) — reproduced here by running exactly the sweep documented above, not copied from
 * the ruling. The other figure the ruling names, 389 across 50, comes from a different sweep this
 * script does not attempt to reproduce; whichever population is right, "no new ones" holds for both,
 * and this ratchet pins the one it actually measures.
 *
 * ⚠️ WHAT A PASS MEANS, AND WHAT IT DOES NOT. A pass means the count has not risen above the pinned
 * baseline — nothing more. It does NOT mean any of these screens are legible, it does NOT mean the
 * 12px floor is met anywhere, and it does NOT catch a new sub-12px size written as a raw `10px` or
 * `11px` instead of through the `--text-3xs`/`--text-2xs` tokens, or written outside this directory.
 * Screen-by-screen legibility is a rebuild decision, not something this script can verify.
 *
 * ⚠️ A GROUPED SELECTOR COUNTS ONCE FOR THE WHOLE GROUP, NOT ONCE PER CLASS IT COVERS. `.a, .b {
 * font-size: var(--text-3xs); }` is one occurrence of the string, even though it sets two classes
 * 🔴 **REBUILT 2026-09-12 AS A PER-FILE RATCHET, BECAUSE THE TOTAL-ONLY VERSION WAS DEMONSTRABLY
 * DEFEATED.** It printed `fileCount` and never compared it, and it compared only the TOTAL — so a file
 * LEAVING the population donated its whole count as headroom. **Measured, not argued: the baseline
 * said 393 across 39 files; the tree had drifted to 384 across 37. Nine occurrences of headroom. I
 * appended NINE new `var(--text-3xs)` declarations — exactly what D-3 forbids — and this script
 * printed `difference 0` and `Not risen`.** The probe was then reverted.
 *
 * ⚠️ **A rename does that as surely as a deletion**, and nothing about it looks like a change to this
 * guard's number. The three repairs below come from `docs/ward-flow/scanner-floor-survey-2026-09-12.md`,
 * which surveyed 63 ward guards for exactly this shape:
 *
 *   tier 1   a FLOOR ON THE WALK — an empty or broken sweep now REFUSES rather than reporting a fall.
 *            Before: a glob that matched nothing printed "Not risen" and exited 0.
 *   tier 2   a POSITIVE CONTROL ON THE MATCHER — the token pattern is run against a specimen it must
 *            match before any file is counted. A broken pattern used to count zero everywhere and pass.
 *   tier 3   NAME WHAT LEFT — files that were in the baseline and are no longer swept are reported by
 *            name. They no longer silently become headroom, because there is no shared pool to absorb
 *            them: **no individual file's count may rise, and a new file carrying any is a rise.**
 *
 * ✅ **Population widened the same day** to the two ward stylesheets that sat outside the old glob —
 * `src/components/ward-flow-sign-in/` and `src/app/mockups/ward-flow/`. **Both carry zero occurrences,
 * so this cost nothing and closed two holes**; a new ward screen in a new top-level folder was
 * previously invisible to the ruling it is subject to.
 *
 * 🔴 **AND "SIGN-IN IS OUTSIDE THE POPULATION" IS A TRUE SENTENCE ABOUT A DIFFERENT GATE. It is
 * FALSE about this one, and three chats believed it on 2026-09-12.**
 *
 *     TRUE   the ROUTE tally in `tests/ward-nav.test.ts` counts the ward-flow SUBTREE, so
 *            `src/app/mockups/ward-flow-sign-in` is a SIBLING directory and its page.tsx is
 *            genuinely outside the 40.
 *     FALSE  this ratchet. `src/components/ward-flow-sign-in/**` is glob #2 below and has been
 *            swept since the widening above.
 *
 * ⚠️ **Two populations, one word, one claim true and one false — and the true one is repeated
 * often enough to lend the false one its credibility.** The measurement that settles it is the
 * script's own first lines, which print the glob count and the swept count on every run.
 *
 * 🔴 **AND A STALE CLAIM THAT A GUARD HAS A GAP IS MORE DANGEROUS THAN A STALE CLAIM THAT IT HAS
 * COVERAGE, because the first one PROMPTS ACTION** — somebody builds a second guard over defended
 * ground, or adds sub-floor text believing nothing is watching. The claim above was withdrawn by the
 * lane that made it, which had merged the very fix that falsified it an hour earlier: running the
 * gate once is what stopped it being run again.
 *
 * ⚠️ **THE COMMENT QUESTION IS STATED, NOT SOLVED, AND THAT IS DELIBERATE.** This script counts the
 * token string wherever it appears, INCLUDING inside a CSS comment — so documenting D-3 inside ward
 * CSS raises the count, and this header can only live in a `.mjs` file for that reason.
 * **Special-casing comments is NOT done here**, because a comment-blind counter must then prove it
 * still catches a declaration disguised as one, and that proof is the whole cost.
 * `tests/ward-text-size-ratchet.test.ts` pins the current behaviour and holds the specimen that would
 * have to keep failing. **Somebody may rule for comment-blindness later; it is a decision, not a tidy.**
 *
 * Confirmed the day this ratchet was built: raising `.syntheticNotice` off a rule it
 * shared with `.allNotRecorded` / `.bandLimitation` (D-3's own jump-the-queue exception) did NOT
 * move this script's count, because the override was added as a later, separate rule rather than by
 * editing the shared declaration — the token stayed in the file for the sibling class, which is
 * still legitimately below 12px until its own screen is rebuilt. So a `.syntheticNotice`-sized fix
 * can be entirely real and still show as a difference of zero here. Read the CSS, not just the
 * number, when a change is supposed to have raised something.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

/**
 * 🔴 **`--root` AND `--baseline` EXIST SO THIS SCRIPT'S OWN PROTECTIONS CAN BE PROVEN AGAINST A
 * THROWAWAY FIXTURE INSTEAD OF THE REAL TREE.**
 *
 * ⚠️ **They are test-only, and the reason they exist is a correction rather than a convenience.** The
 * three protections below — the walk floor, the matcher control, the per-file comparison — were first
 * proven BY HAND and their exit codes written into this header. **A peer named the residue exactly:
 * exit codes recorded in a header are a claim nobody re-runs.** The protections stayed live; the
 * proofs that they BITE decayed into prose, and a later change removing one would leave this header
 * still asserting it had been verified.
 *
 * ✅ **`tests/ward-text-size-ratchet.test.ts` now drives both flags against a temporary git repository
 * it builds and throws away**, so nothing in the real tree moves — which is what the original declared
 * trade was protecting.
 *
 * 🔴 **THE FIXTURE IS A REAL GIT REPOSITORY, AND THAT IS NOT INCIDENTAL.** This script enumerates
 * with `git ls-files`, and tonight's own lesson is that **the enumeration METHOD is the boundary**. A
 * fixture swept by a plain directory walk would prove a code path that does not run in production —
 * the guard would be green against a method nobody uses.
 */
function flagValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : undefined;
}

const rootOverride = flagValue("--root");
const baselinePath = flagValue("--baseline") ?? join(scriptDir, "text-size-floor-baseline.json");

const repo = rootOverride ?? execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();

const SWEEP_GLOBS = [
  "src/components/ward-management/**/*.module.css",
  // Widened 2026-09-12. Both carry zero occurrences today, so this changed no number — it closed the
  // hole a new ward screen in a NEW top-level folder had already walked through unguarded.
  "src/components/ward-flow-sign-in/**/*.module.css",
  "src/app/mockups/ward-flow/**/*.css",
];
const TOKEN_PATTERN = /--text-3xs|--text-2xs/g;

/**
 * 🔴 TIER 1 — THE FLOOR ON THE WALK. Below this, the sweep is broken, not the tree.
 *
 * Chosen well under the tracked population so ordinary deletion never trips it, and far above zero
 * so a glob that matches nothing cannot report a fall. Before this existed, a broken sweep printed
 * "Not risen" and exited 0 — the guard's own success message.
 *
 * ⚠️ NO POPULATION FIGURE IS QUOTED HERE ON PURPOSE. This comment previously said "~68 files
 * actually tracked"; the sweep reports 70 today, so it had already drifted. The number a reader
 * needs is printed by this script on EVERY run, on the `swept` line, beside this floor — so the
 * comparison is on screen at the moment it matters instead of parked in prose that nothing
 * re-checks. That is the general repair for a count in a comment: point at the thing that prints
 * it, or at the guard that enforces it. A count naming neither is the one to hunt.
 */
const MINIMUM_FILES_SWEPT = 30;

/**
 * 🔴 TIER 2 — THE POSITIVE CONTROL. The matcher is run against text it MUST match, before anything is
 * counted.
 *
 * A pattern that matches nothing counts zero in every file and passes silently, which is
 * indistinguishable from a clean tree. ⚠️ Written inline rather than read from a fixture so the
 * control cannot itself go missing — a positive control that lives in a file the sweep might lose is
 * the same defect one level up.
 */
const MATCHER_SPECIMEN = ".probe { font-size: var(--text-3xs); border: 0; font-size: var(--text-2xs); }";
const MATCHER_SPECIMEN_EXPECTED = 2;

/**
 * 🔴 TIER 2b — THE POSITIVE CONTROL FOR THE COMMENT STRIP, AND IT IS MOSTLY ABOUT THE STRIP GOING
 * TOO FAR RATHER THAN NOT FAR ENOUGH.
 *
 * **Why the strip exists:** this script counts DECLARATIONS. A stylesheet comment that NAMES the
 * two smallest tokens — to say a file uses neither of them, which is exactly the comment a newly
 * raised screen wants — was counted as two of them. ⚠️ The screen was clean and the gate went red
 * by two, which reads EXACTLY like two new sub-floor declarations. **A wrong answer wearing the
 * shape of a right one is worse than an unhelpful one.**
 *
 * 🔴 **AND THE DANGEROUS DIRECTION IS THE OPPOSITE ONE.** A strip that swallows a real declaration
 * does not redden — it makes the count FALL, and this ratchet WELCOMES a fall as "a rebuilt screen
 * raised its text". **A broken strip reports an improvement.** So the four cases below pin an
 * EXACT expected count, never "fewer than before", and three of them are declarations the strip
 * must NOT eat:
 *
 *   1. a mention inside a comment                      must NOT be counted
 *   2. a declaration on the SAME LINE after a comment  must be counted
 *   3. a declaration BETWEEN two comments              must be counted
 *   4. an unterminated comment                         REFUSED outright — see `stripCssComments`
 */
const STRIP_SPECIMEN = [
  "/* this file uses neither of the two smallest tokens: --text-3xs, --text-2xs */",
  ".a { /* leading note */ font-size: var(--text-3xs); }",
  "/* before */",
  ".b { font-size: var(--text-2xs); }",
  "/* after, mentioning --text-3xs again */",
].join("\n");
const STRIP_SPECIMEN_EXPECTED = 2;

function trackedWardCssFiles() {
  // git ls-files respects .gitignore and only reports files actually in the tree — the same
  // "tracked, not the working directory's stray files" discipline scripts/check-type-scale.mjs
  // uses for its own sweep. The `:(glob)` pathspec magic is required for `**` to cross directory
  // levels — without it, git's default pathspec matching left 25 of the 62 real files unmatched
  // (measured while writing this script), which would have silently shrunk the population.
  const output = execFileSync("git", ["ls-files", "--", ...SWEEP_GLOBS.map((glob) => `:(glob)${glob}`)], {
    cwd: repo,
    encoding: "utf8",
  });
  return output.split("\n").filter(Boolean).sort();
}

/**
 * 🔴 REFUSES AN UNBALANCED COMMENT RATHER THAN STRIPPING TO THE END OF THE FILE.
 *
 * A naive strip on an unterminated opener eats everything after it, so every declaration below that
 * point silently stops being counted. ⚠️ **The count FALLS, and a fall is what this ratchet treats
 * as good news.** So an unbalanced file is an error, not a quietly smaller number: the sweep is
 * broken there, not the tree.
 *
 * 🔴 AND THE FIRST VERSION OF THIS CHECK WAS WRONG IN THE EXACT WAY THIS WHOLE CHANGE IS ABOUT.
 * It compared the NUMBER of comment openers with the number of closers, and refused
 * `statistics-v4.module.css` at 27 against 26. **That file is fine.** One of its comments MENTIONS
 * a comment opener in its prose — and CSS comments do not nest, so the file is balanced while a
 * naive tally is not. ⚠️ **A guard against counting a mention as a use, defeated by counting a
 * mention as a use.** Fourth instance in one night.
 *
 * ✅ The test now is exact rather than statistical: strip every properly closed comment, and if an
 * opener still remains, that one is genuinely unterminated. A mention inside a comment body is
 * consumed with its body and cannot be mistaken for anything.
 */
function stripCssComments(text, relPath) {
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, "");
  if (stripped.includes("/*")) {
    throw new Error(
      `[text-size-floor] REFUSED: ${relPath} has a comment that is never closed. ` +
        `An unterminated comment makes the strip swallow the rest of the file, which LOWERS this ` +
        `count — and a falling count is the one thing this ratchet does not question. Fix the stylesheet.`,
    );
  }
  return stripped;
}

function countIn(text) {
  const matches = text.match(TOKEN_PATTERN);
  return matches ? matches.length : 0;
}

/**
 * ⚠️ COMMENTS ARE STRIPPED BEFORE COUNTING. This script counts DECLARATIONS — its own output says
 * so — and a token NAMED in a comment is never one. Ward Lead's ruling, 2026-09-12, on the false
 * red described at `STRIP_SPECIMEN` above.
 */
function countFile(relPath) {
  return countIn(stripCssComments(readFileSync(join(repo, relPath), "utf8"), relPath));
}

const applyBaseline = process.argv.includes("--update-baseline");

// ── TIER 2 runs FIRST: a broken matcher makes every other number in this script meaningless. ──
const strippedProof = countIn(stripCssComments(STRIP_SPECIMEN, "<strip specimen>"));
if (strippedProof !== STRIP_SPECIMEN_EXPECTED) {
  console.error(
    `[text-size-floor] REFUSED: the comment strip left ${strippedProof} occurrence(s) in a specimen ` +
      `containing exactly ${STRIP_SPECIMEN_EXPECTED} real declarations. ` +
      (strippedProof < STRIP_SPECIMEN_EXPECTED
        ? "It is EATING declarations, which makes every file's count fall — and a fall is what this " +
          "ratchet welcomes, so the damage would never redden."
        : "It is not removing commented mentions, which is the false red this strip exists to end.") +
      " Fix stripCssComments — do not re-baseline.",
  );
  process.exit(2);
}

const proved = countIn(MATCHER_SPECIMEN);
if (proved !== MATCHER_SPECIMEN_EXPECTED) {
  console.error(
    `[text-size-floor] REFUSED: the token matcher found ${proved} occurrences in a specimen containing ` +
      `${MATCHER_SPECIMEN_EXPECTED}. The pattern is broken, so a count of zero anywhere would mean ` +
      `nothing. Fix TOKEN_PATTERN — do not re-baseline.`,
  );
  process.exit(2);
}

const files = trackedWardCssFiles();

// ── TIER 1: an empty or collapsed sweep is a REFUSAL, never a pass. ──────────────────────────
if (files.length < MINIMUM_FILES_SWEPT) {
  console.error(
    `[text-size-floor] REFUSED: the sweep found ${files.length} ward stylesheet(s), fewer than the ` +
      `${MINIMUM_FILES_SWEPT} this ratchet expects. That is a broken glob or a moved directory, not a ` +
      `clean tree — and a fall measured over nothing is not a fall. Globs: ${SWEEP_GLOBS.join(", ")}`,
  );
  process.exit(2);
}

const perFile = files.map((file) => ({ file, count: countFile(file) })).filter((entry) => entry.count > 0);
const total = perFile.reduce((sum, entry) => sum + entry.count, 0);
const currentByFile = new Map(perFile.map((entry) => [entry.file, entry.count]));

if (!existsSync(baselinePath)) {
  console.error(`[text-size-floor] REFUSED: no baseline at ${baselinePath}. This ratchet cannot run without one.`);
  process.exit(2);
}
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const baselineByFile = new Map(Object.entries(baseline.perFile ?? {}));

if (baselineByFile.size === 0 && !applyBaseline) {
  console.error(
    "[text-size-floor] REFUSED: the baseline carries no per-file counts. This ratchet compares each file " +
      "against its own baseline; a total-only baseline would let one file's fall pay for another's rise. " +
      "Re-record it with --update-baseline, deliberately.",
  );
  process.exit(2);
}

console.log("Ward text-size floor ratchet — --text-3xs / --text-2xs uses in ward CSS\n");
console.log(`  sweep      ${SWEEP_GLOBS.length} glob(s), git-tracked files only`);
console.log(`  swept      ${files.length} stylesheet(s)  (refuses below ${MINIMUM_FILES_SWEPT})`);
console.log(`  matcher    proved on a specimen: ${proved}/${MATCHER_SPECIMEN_EXPECTED}`);
console.log(`  current    ${total} occurrences across ${perFile.length} files`);
console.log(
  `  baseline   ${baseline.count} occurrences across ${baseline.fileCount} files (pinned ${baseline.measuredOn})`,
);
console.log(`  difference ${total - baseline.count > 0 ? "+" : ""}${total - baseline.count}\n`);

if (applyBaseline) {
  /*
   * 🔴 **A RE-BASELINE IS HOW A RATCHET LAUNDERS A BREACH — SO IT NAMES WHAT IT IS ABSORBING.**
   *
   * ⚠️ **Flagged 2026-09-12 after a real near-miss.** The baseline was re-recorded at 384/37 on the day
   * two new ward stylesheets landed. **Both happened to carry zero sub-floor tokens, so nothing was
   * absorbed — but nobody had looked, and this is the step at which it would have been invisible.**
   *
   * **This does not refuse.** The flag exists to record a deliberate decision, and a ratchet that
   * cannot be re-baselined gets deleted. ✅ **But it now prints every file whose count would RISE, by
   * name and delta, so the act of absorbing is stated rather than silent** — and whoever runs it has
   * the list in front of them for the commit message this script's own message already asks for.
   */
  const absorbing = [];
  for (const { file, count } of perFile) {
    const was = baselineByFile.get(file);
    if (was === undefined) absorbing.push(`${file}: 0 → ${count}  (new file)`);
    else if (count > was) absorbing.push(`${file}: ${was} → ${count}`);
  }
  if (absorbing.length > 0) {
    console.log("🔴 THIS RE-BASELINE ABSORBS A RISE. Each line below becomes the new permitted normal:\n");
    for (const line of absorbing) console.log(`  ${line}`);
    console.log("\n⚠️  If any of these is NEW ward code, D-3 forbids it and the fix is the CSS, not this");
    console.log("    baseline. Re-baselining is for a count that legitimately moved — say which and why in");
    console.log("    the commit message.\n");
  }

  const updated = {
    ...baseline,
    count: total,
    fileCount: perFile.length,
    measuredOn: new Date().toISOString().slice(0, 10),
    perFile: Object.fromEntries(perFile.map((entry) => [entry.file, entry.count])),
  };
  writeFileSync(baselinePath, JSON.stringify(updated, null, 2) + "\n");
  console.log(`[text-size-floor] Baseline rewritten: ${total} across ${perFile.length} files, recorded PER FILE.`);
  console.log("Commit it deliberately — this flag records numbers; it does not judge the change that produced");
  console.log("them, and it will happily pin a rise somebody did not mean to make.\n");
  process.exit(0);
}

/*
 * 🔴 THE RATCHET IS PER FILE, AND THAT IS THE WHOLE REPAIR.
 *
 * A total-only comparison lets one file's fall pay for another's rise, and lets a file LEAVING the
 * population pay for a rise anywhere at all. Neither is something D-3 permits: it permits an existing
 * screen's count to FALL as that screen is rebuilt, and never permits a new sub-12px declaration.
 */
const risen = [];
for (const { file, count } of perFile) {
  const was = baselineByFile.get(file);
  if (was === undefined) risen.push({ file, was: 0, now: count, why: "new file carrying sub-12px text" });
  else if (count > was) risen.push({ file, was, now: count, why: "count rose in an existing file" });
}

/*
 * ⚠️ TIER 3 — NAME WHAT LEFT, rather than absorbing it.
 *
 * A baseline file no longer swept is either a legitimate deletion or rebuild, or a RENAME that moved
 * it out of the globs. It is not a failure — but it must be SAID, because under the old total-only
 * rule its whole count silently became headroom for new declarations elsewhere, and a rename looks
 * like nothing at all in a diff of this guard's number.
 */
const left = [...baselineByFile.keys()].filter((file) => !currentByFile.has(file));

if (left.length > 0) {
  console.log("⚠️  In the baseline, no longer swept. Check each is a deletion or a rebuild — not a rename that");
  console.log("    moved a file out of the globs above:\n");
  for (const file of left) console.log(`  ${String(baselineByFile.get(file)).padStart(4)}  ${file}`);
  console.log("\n    Under the previous total-only ratchet these counts became invisible headroom. They no");
  console.log("    longer do: every file is compared against its own baseline.\n");
}

if (risen.length > 0) {
  console.log("🔴 RISEN. Owner ruling D-3 permits the count to fall as screens are rebuilt, never to rise.\n");
  for (const entry of risen) console.log(`  ${entry.file}: ${entry.was} → ${entry.now}  (${entry.why})`);
  console.log("\nIf this is NEW ward code: it must not be below 12px — use var(--text-xs) (12px) or larger, not");
  console.log("--text-3xs (10px) or --text-2xs (11px). That is the standard's floor, not a token choice.");
  console.log(
    "\nCOMMENTS ARE NOT COUNTED. Since 2026-09-12 this sweep strips comments before matching, so a " +
      "token merely NAMED in prose — including a note saying a file uses neither of them — cannot " +
      "produce this red. Every occurrence above is a real declaration: do not go looking for a sentence.\n",
  );
  console.log("\nIf you legitimately RAISED existing sub-12px text while rebuilding a screen, that file's count");
  console.log("should have FALLEN, not risen — re-check what you added. A deliberate baseline correction is");
  console.log("`node scripts/ward-flow/check-text-size-floor.mjs --update-baseline`, committed with a message");
  console.log("stating how many and why.\n");
  console.log("⚠️  A pass here would not mean these screens are legible — only that this class of shrink did not");
  console.log("    grow. See this script's header for exactly what population it does and does not cover.\n");
  process.exit(1);
}

console.log("Not risen in any file. (Falling is welcome — it means a rebuilt screen raised existing text.)\n");
console.log("⚠️  This is a ratchet, not a floor check: a pass means no file's count rose above its OWN pinned");
console.log("    baseline, nothing more. It does not mean these screens are legible, it does not enforce the");
console.log("    12px floor anywhere, and it cannot see a new sub-12px size written as a raw 10px/11px instead");
console.log("    of through --text-3xs/--text-2xs, or written outside the globs above.\n");
process.exit(0);

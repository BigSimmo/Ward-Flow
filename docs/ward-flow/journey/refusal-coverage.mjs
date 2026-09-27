/*
 * WHICH REFUSALS NO TEST EVER REACHES.
 *
 * A refusal is where somebody's intended route stops. The engine has 313 of them. Whether each one
 * has ever been executed by a test is the difference between a safeguard that is known to work and
 * one that is merely present, and on a path where the refusal is what stops a patient being
 * collected without legal authority, that difference is the whole point.
 *
 * ⚠️ THE CHEAP VERSION OF THIS MEASURE IS WORTHLESS, AND IT LOOKS FINE. Every one of the 71 actions
 * is named by some ward test, so "is it tested" answers yes for all of them. And only 23 of 298
 * refusal messages are quoted in any test, so grepping for the message answers no for 275 that are
 * in fact exercised. Both measures are confident and wrong in opposite directions. Only running the
 * tests and reading which lines executed can say.
 *
 * So this reads a coverage report. IF THERE IS NO REPORT, IT WRITES NOTHING AND SAYS SO — the page
 * then shows no coverage at all, which is the honest state. It must never fall back to a guess,
 * because a wrong "nothing tests this" on a clinical map sends somebody to fix a safeguard that is
 * fine, and a wrong "tested" hides one that is not.
 *
 * 🔴 TWO REPORT FORMATS, AND THE CHOICE IS NOT COSMETIC. This originally read `coverage-final.json`
 * only. The repository's vitest config emits `text` and `lcov` — NOT json — so that file never
 * existed, and three separate runs produced no measurement while looking like they had run. Worse,
 * adding `--coverage.reporter=json` on the command line to force it silently disabled coverage
 * altogether AND swallowed the test filter that came after it: the suite ran for seventeen minutes
 * and wrote nothing at all. So this now reads `lcov.info`, which is what the project actually
 * produces from its own `npm run test:coverage`, and keeps the json reader for anyone who asks for
 * that reporter deliberately.
 *
 * 🔴 AND A LINE NUMBER IS A DIFFERENT NUMBER IN EVERY TREE. Coverage measured in one worktree maps
 * onto a reducer in another only if the two files are byte-for-byte the same. They frequently are
 * not — that is the normal state of two live branches. Pointing this at an outside report therefore
 * REQUIRES naming the reducer that report was measured against, and it refuses outright unless that
 * file matches this one exactly. Line 4310 in one tree is a different statement in the other, and
 * the answer would be wrong in the most convincing possible way: specific, per-action, and silent.
 *
 *   WARD_COVERAGE_REPORT   a coverage-final.json or lcov.info produced elsewhere
 *   WARD_COVERAGE_SOURCE   the ward-flow-reducer.ts that report was measured against
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const repoRoot = path.resolve(here, "../../..");
const REDUCER = path.join(repoRoot, "src/components/ward-management/ward-flow-reducer.ts");
const OUT = path.join(here, "refusal-coverage.json");

const reducerText = fs.readFileSync(REDUCER, "utf8");
const digest = (text) => crypto.createHash("sha256").update(text.split("\r\n").join("\n")).digest("hex");

/*
 * Where the report comes from, and what vouches for its line numbers.
 *
 * An in-repo report is measured against this very file, so nothing needs to vouch for it. An
 * outside one is only usable with the source it was measured against, and that is checked, not
 * asserted.
 */
let report = null;
let vouched = "this worktree's own report";
const external = process.env.WARD_COVERAGE_REPORT;
if (external) {
  if (!fs.existsSync(external)) {
    console.error(`REFUSING — WARD_COVERAGE_REPORT names a file that does not exist: ${external}`);
    process.exit(1);
  }
  const source = process.env.WARD_COVERAGE_SOURCE;
  if (!source) {
    console.error(
      "REFUSING — an outside coverage report was named without WARD_COVERAGE_SOURCE, so nothing can\n" +
        "  vouch that its line numbers belong to this reducer. Line 4310 is a different statement in\n" +
        "  every tree, and the per-action answer would be wrong while looking precise.",
    );
    process.exit(1);
  }
  if (!fs.existsSync(source)) {
    console.error(`REFUSING — WARD_COVERAGE_SOURCE names a file that does not exist: ${source}`);
    process.exit(1);
  }
  const theirs = digest(fs.readFileSync(source, "utf8"));
  const ours = digest(reducerText);
  if (theirs !== ours) {
    console.error(
      "REFUSING — the reducer that report was measured against is NOT the reducer in this worktree.\n" +
        `  measured: ${source}\n  here:     ${REDUCER}\n` +
        "  Every line number in the report would land on a different statement. Re-run coverage against\n" +
        "  this tree, or fold the two lines together first.",
    );
    process.exit(1);
  }
  report = external;
  vouched = `${path.basename(source)} matches this worktree byte for byte`;
} else {
  const CANDIDATES = [
    path.join(repoRoot, "coverage/coverage-final.json"),
    path.join(repoRoot, "coverage/lcov.info"),
    path.join(repoRoot, "coverage-wardmap/coverage-final.json"),
    path.join(repoRoot, "coverage-wardmap/lcov.info"),
  ];
  report = CANDIDATES.find((f) => fs.existsSync(f)) || null;
}

if (!report) {
  // Leave any previous answer alone rather than replacing it with silence, but never invent one.
  console.log("no coverage report found — refusal coverage not measured this run (the page will show none)");
  process.exit(0);
}

/*
 * Read whichever format this is, and return one thing: for each line of the reducer the report can
 * speak for, how many times it ran. A line the report does not mention is ABSENT from this map, and
 * absent means unknown — never zero. Collapsing those two is the whole failure this measure exists
 * to avoid.
 */
const hitsByLine = new Map();
const isLcov = /\.info$/i.test(report);

if (isLcov) {
  const lines = fs.readFileSync(report, "utf8").split("\n");
  let inside = false;
  let seenFile = false;
  for (const raw of lines) {
    const row = raw.trim();
    if (row.startsWith("SF:")) {
      const file = row.slice(3).split("\\").join("/");
      inside = file.endsWith("src/components/ward-management/ward-flow-reducer.ts");
      if (inside) seenFile = true;
      continue;
    }
    if (row === "end_of_record") {
      inside = false;
      continue;
    }
    if (!inside || !row.startsWith("DA:")) continue;
    const [lineNo, count] = row.slice(3).split(",");
    const n = Number(lineNo);
    const c = Number(count);
    if (!Number.isFinite(n) || !Number.isFinite(c)) continue;
    // Several records can land on one line; the line ran if any of them did.
    hitsByLine.set(n, Math.max(hitsByLine.get(n) ?? 0, c));
  }
  if (!seenFile) {
    console.log(`coverage report ${path.basename(report)} does not include the reducer — not measured`);
    process.exit(0);
  }
} else {
  const cov = JSON.parse(fs.readFileSync(report, "utf8"));
  const key = Object.keys(cov).find((k) => k.split("\\").join("/").endsWith("ward-flow-reducer.ts"));
  if (!key) {
    console.log(`coverage report ${path.basename(report)} does not include the reducer — not measured`);
    process.exit(0);
  }
  const entry = cov[key];
  const stmts = Object.entries(entry.statementMap || {}).map(([id, m]) => ({
    hits: entry.s[id] || 0,
    from: m.start.line,
    to: m.end.line,
  }));
  if (!stmts.length) {
    console.error(
      "REFUSING — the coverage report holds no statements for the reducer; it would read as 'nothing is tested'.",
    );
    process.exit(1);
  }
  // A statement whose span contains the line. v8 reports ranges, so a refusal spanning several
  // lines is covered by whichever statement starts at or before it and ends at or after it.
  for (const s of stmts) {
    for (let line = s.from; line <= s.to; line++) {
      hitsByLine.set(line, Math.max(hitsByLine.get(line) ?? 0, s.hits));
    }
  }
}

if (!hitsByLine.size) {
  console.error(
    "REFUSING — the report names the reducer but records no executable lines for it, so every refusal\n" +
      "  would read as 'never reached'. That is a broken report, not a finding.",
  );
  process.exit(1);
}

const src = reducerText.split("\n");
const rejectLines = [];
for (let i = 0; i < src.length; i++) if (/return reject\(/.test(src[i])) rejectLines.push(i + 1);
if (!rejectLines.length) {
  console.error("REFUSING — found no refusals in the reducer, so any coverage figure would be meaningless.");
  process.exit(1);
}

const rows = rejectLines.map((line) => {
  // No record for the line at all means the report cannot speak for it — that is UNKNOWN, not
  // "never reached". The two must not be collapsed.
  const known = hitsByLine.has(line);
  return { line, known, hits: known ? hitsByLine.get(line) : null };
});

/*
 * Bucket each refusal into the reducer case it sits in, so the answer can be given per action
 * rather than as one number for the whole file. The case a line belongs to is the nearest
 * `case "EVENT":` above it, and the bucket ends where the next one begins.
 */
const caseStarts = [];
for (let i = 0; i < src.length; i++) {
  const m = src[i].match(/^\s{2,10}case "([A-Z][A-Z0-9_]*)":/);
  if (m) caseStarts.push({ event: m[1], line: i + 1 });
}
if (caseStarts.length < 40) {
  console.error(
    `REFUSING — only ${caseStarts.length} reducer cases were found, so the per-action figures would be wrong.`,
  );
  process.exit(1);
}
const eventAt = (line) => {
  let found = null;
  for (const c of caseStarts) {
    if (c.line <= line) found = c.event;
    else break;
  }
  return found;
};
const byEvent = {};
for (const r of rows) {
  const ev = eventAt(r.line);
  if (!ev) continue;
  byEvent[ev] = byEvent[ev] || { refusals: 0, unknown: 0, neverReached: 0 };
  byEvent[ev].refusals++;
  if (!r.known) byEvent[ev].unknown++;
  else if (r.hits === 0) byEvent[ev].neverReached++;
}

const measured = rows.filter((r) => r.known);
const never = measured.filter((r) => r.hits === 0);

/*
 * 🔴 THE INPUT'S IDENTITY, RECORDED BESIDE THE ANSWER — ADDED 2026-09-19 BECAUSE THE
 * ANSWER WAS QUOTABLE WITHOUT BEING REPRODUCIBLE.
 *
 * `coverage/lcov.info` is UNTRACKED: a local artefact of whenever tests last happened to run with
 * coverage on that disk. So this file — which IS committed — depended on an input that is not,
 * and two people on the same commit got different numbers with neither of them wrong. It happened:
 * folding this branch moved `spokenFor` from 313 to 129 with no code change at all, and the only
 * way to tell that apart from a real regression was to go and stat the report by hand.
 *
 * ⚠️ Tracking the report is not the fix — the repository forbids committing `coverage/`,
 * and a coverage artefact is large, machine-specific and stale the moment anything changes. The fix
 * is that the committed answer CARRIES ITS INPUT'S IDENTITY, so a reader can say whether their
 * number should match this one, and regenerate it deterministically when it should not.
 *
 * ✅ `reportSha256` is the whole discriminator: same report, same reducer, same answer. Different
 * report, and the difference is explained rather than mysterious.
 */
const reportText = fs.readFileSync(report);
const reportStat = fs.statSync(report);
const input = {
  reportSha256: crypto.createHash("sha256").update(reportText).digest("hex"),
  reportBytes: reportStat.size,
  reportModifiedAt: reportStat.mtime.toISOString(),
  /* The reducer the lines in that report are indexed against. A line number is a different number
   * in every tree, so this is what makes the mapping meaningful rather than coincidental. */
  reducerSha256: digest(reducerText),
  /* ⚠️ PARTIAL REPORTS ARE THE NORMAL CASE, NOT AN ERROR. A report produced by a focused
   * run speaks for only the lines that run touched, so `spokenFor` drops without anything being
   * wrong. Stated here so nobody reads a smaller number as a regression. */
  coversWholeReducer: measured.length === rows.length,
  /*
   * 🔴 `--coverage.reportOnFailure=true` IS NOT OPTIONAL, AND LEAVING IT OFF IS WHY THIS ANSWER
   * LOOKED IRREPRODUCIBLE IN THE FIRST PLACE. Vitest's `coverage.reportOnFailure` defaults to
   * FALSE, and on a run with any failing test it writes the report and then DELETES the directory
   * again. Verified in this version's own source: `reportOnFailure: false` in
   * `node_modules/vitest/dist/chunks/defaults.*.js`, and
   * `if (!this.options.reportOnFailure) await this.cleanAfterRun()` in `coverage.*.js`.
   *
   * ⚠️ The ward suite has failing tests, so a plain `npm run test:coverage` prints "Coverage
   * enabled with v8", runs for half an hour, prints an entirely ordinary summary, exits — and
   * leaves no `coverage/` directory at all. **The run looks identical whether it measured
   * everything or nothing.** Four such runs across two sessions measured nothing before anybody
   * thought to stat the directory rather than read the exit status. (This note said three when it
   * was written; a fourth had already happened elsewhere — see ledger 7.19.7.)
   *
   * A number taken from an artefact that the next failing run silently removes is irreproducible
   * BY CONSTRUCTION, not by anybody's error.
   */
  regenerateWith:
    "npm run test:coverage -- --coverage.reportOnFailure=true  (writes coverage/lcov.info even when tests fail), then npm run ward:journey",
};

const out = {
  input,
  measuredFrom:
    path.isAbsolute(report) && report.startsWith(repoRoot)
      ? path.relative(repoRoot, report).split("\\").join("/")
      : report.split("\\").join("/"),
  vouchedBy: vouched,
  measuredAt: new Date().toISOString(),
  refusals: rows.length,
  spokenFor: measured.length,
  neverReached: never.map((r) => r.line),
  byEvent,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));

console.log(
  `refusal coverage: ${measured.length} of ${rows.length} refusals the report can speak for; ` +
    `${never.length} of those were never reached by a test`,
);
if (measured.length < rows.length)
  console.log(
    `  ${rows.length - measured.length} refusal(s) the report says nothing about — reported as unknown, not as untested`,
  );

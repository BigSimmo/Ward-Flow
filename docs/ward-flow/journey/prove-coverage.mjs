/*
 * The probe for a measurement that is confident and wrong.
 *
 * Four ways this measure could produce a per-action answer that reads as precise and is not:
 *
 *  1. An outside report used with nothing vouching for its line numbers.
 *  2. An outside report measured against a DIFFERENT copy of the reducer — the worst of the four,
 *     because every figure lands on a real action and none of them are about that action.
 *  3. A report that names the reducer but records no lines, which would read as "nothing is tested"
 *     for all 313 refusals at once.
 *  4. A report that simply does not mention a line, which must read as unknown and never as
 *     "no test ever reaches this".
 *
 * Each is fed in deliberately here, and the measure must refuse the first three and stay honest on
 * the fourth. Nothing is asserted about the real coverage figures — that is not what this proves.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const repoRoot = path.resolve(here, "../../..");
const REDUCER = path.join(repoRoot, "src/components/ward-management/ward-flow-reducer.ts");
const MEASURE = path.join(here, "refusal-coverage.mjs");
const OUT = path.join(here, "refusal-coverage.json");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ward-refusal-proof-"));
const had = fs.existsSync(OUT);
const before = had ? fs.readFileSync(OUT, "utf8") : null;

const reducer = fs.readFileSync(REDUCER, "utf8");
const srcLines = reducer.split("\n");
const refusalLines = [];
for (let i = 0; i < srcLines.length; i++) if (/return reject\(/.test(srcLines[i])) refusalLines.push(i + 1);

const lcov = (records) =>
  ["TN:", "SF:src/components/ward-management/ward-flow-reducer.ts", ...records, "end_of_record", ""].join("\n");

const run = (env) => {
  try {
    return { code: 0, out: execFileSync("node", [MEASURE], { encoding: "utf8", env: { ...process.env, ...env } }) };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stderr || "") + (e.stdout || "") };
  }
};

const findings = [];
const check = (name, ok, detail) => {
  findings.push({ name, ok, detail });
};

/* 1 — an outside report with nothing vouching for its line numbers. */
{
  const f = path.join(tmp, "unvouched.info");
  fs.writeFileSync(f, lcov(refusalLines.slice(0, 3).map((l) => `DA:${l},1`)));
  const r = run({ WARD_COVERAGE_REPORT: f, WARD_COVERAGE_SOURCE: "" });
  check("an outside report with no source named is refused", r.code !== 0 && /vouch/i.test(r.out), r.out.slice(0, 200));
}

/* 2 — measured against a different copy of the reducer. One added line is enough: from there on,
       every line number in the report is off by one, and every answer is about the wrong statement. */
{
  const other = path.join(tmp, "ward-flow-reducer.ts");
  fs.writeFileSync(other, "// a line that does not exist in the other tree\n" + reducer);
  const f = path.join(tmp, "shifted.info");
  fs.writeFileSync(f, lcov(refusalLines.slice(0, 3).map((l) => `DA:${l},1`)));
  const r = run({ WARD_COVERAGE_REPORT: f, WARD_COVERAGE_SOURCE: other });
  check(
    "a report measured against a different reducer is refused",
    r.code !== 0 && /NOT the reducer in this worktree/.test(r.out),
    r.out.slice(0, 200),
  );
}

/* 3 — the reducer is named, but no line is recorded. */
{
  const f = path.join(tmp, "empty.info");
  fs.writeFileSync(f, lcov([]));
  const r = run({ WARD_COVERAGE_REPORT: f, WARD_COVERAGE_SOURCE: REDUCER });
  check(
    "a report with no lines for the reducer is refused, not read as 'nothing is tested'",
    r.code !== 0 && /records no executable lines/.test(r.out),
    r.out.slice(0, 200),
  );
}

/* 4 — a partial report. Three refusals spoken for, one of them never reached; every other refusal
       is absent from the report and must come back as unknown, never as untested. */
{
  const [a, b, c] = refusalLines;
  const f = path.join(tmp, "partial.info");
  fs.writeFileSync(f, lcov([`DA:${a},7`, `DA:${b},0`, `DA:${c},2`]));
  const r = run({ WARD_COVERAGE_REPORT: f, WARD_COVERAGE_SOURCE: REDUCER });
  let json = null;
  try {
    json = JSON.parse(fs.readFileSync(OUT, "utf8"));
  } catch {
    /* handled by the check below */
  }
  const honest =
    r.code === 0 &&
    json &&
    json.spokenFor === 3 &&
    json.refusals === refusalLines.length &&
    json.neverReached.length === 1 &&
    json.neverReached[0] === b;
  check(
    "a line the report never mentions is unknown, not untested",
    honest,
    json
      ? `spokenFor ${json.spokenFor} of ${json.refusals}, neverReached ${JSON.stringify(json.neverReached)}`
      : r.out.slice(0, 200),
  );
}

/* Put back whatever was there before, so proving something never changes the answer on the page. */
if (had) fs.writeFileSync(OUT, before);
else if (fs.existsSync(OUT)) fs.rmSync(OUT);
fs.rmSync(tmp, { recursive: true, force: true });

const failed = findings.filter((f) => !f.ok);
for (const f of findings) console.log(`${f.ok ? "  ok  " : "  NO  "} ${f.name}`);
if (failed.length) {
  for (const f of failed) console.error(`\nNOT PROVEN — ${f.name}\n${f.detail}`);
  process.exit(1);
}
console.log(
  "PROVEN: the refusal measure refuses a report it cannot trust, and never calls an unmeasured line untested.",
);

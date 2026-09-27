/*
 * The one command. Runs the whole chain in order and stops at the first step that refuses.
 *
 * 🔴 EVERY STEP HERE CAN REFUSE, AND REFUSING IS THE POINT. This tooling exists to make a claim —
 * "this is everything the ward journey can do" — and a drawing that quietly omits something is
 * worse than no drawing, because somebody will trust it. So each builder checks its own output
 * and exits non-zero rather than writing a file that is wrong. If this command fails, read what
 * it names; it names the box, the line or the action, not a line number.
 *
 * Run it with `npm run ward:journey`. It needs nothing installed — plain Node, no dependencies.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

const STEPS = [
  ["extract-vocab.mjs", "read every word list straight out of the engine"],
  ["rebuild-map.mjs", "lay the route map out from its edge specification"],
  ["build-explorer.mjs", "build the explorer page and check every claim on it"],
  ["build-bpmn.mjs", "emit the pathway as BPMN 2.0"],
  ["make-inventory.mjs", "write the plain-text inventory a reviewer diffs against source"],
  ["refusal-coverage.mjs", "say which refusals no test ever reaches"],
  ["what-changed.mjs", "report what moved since the last run"],
];

// The proofs run only when asked. Each one deliberately breaks an input, checks the build refuses
// and names the offender, then puts the input back — so they must not run beside a normal build.
const PROOFS = [
  "prove-overlap.mjs",
  "prove-check.mjs",
  "prove-legend.mjs",
  "prove-data.mjs",
  "prove-inventory.mjs",
  "prove-coverage.mjs",
  "prove-screen.mjs",
];

const run = (file) =>
  execFileSync(process.execPath, [path.join(here, file)], {
    cwd: here,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const proving = process.argv.includes("--prove");
const list = proving ? PROOFS.map((f) => [f, "prove a check actually fails"]) : STEPS;

let failed = 0;
for (const [file, what] of list) {
  try {
    const out = run(file).trim();
    console.log(`✓ ${what}`);
    for (const line of out.split("\n").filter(Boolean)) console.log(`    ${line}`);
  } catch (e) {
    failed++;
    const output = ((e.stderr || "") + (e.stdout || "")).trim();
    console.error(`✗ ${what} — ${file} refused:`);
    for (const line of output.split("\n")) console.error(`    ${line}`);
    // A Windows file lock (an indexer or scanner, under a second) surfaces as UNKNOWN errno -4094
    // inside a write the probe did not wrap — usually the rebuild's own page write. That is the
    // machine, not the check: nothing here changed. Say so, so it is not "fixed" by weakening a
    // check. A red with no lock signature is a real failure and must be read.
    if (/errno:? -4094|\bUNKNOWN\b.*(open|write)|\bEBUSY\b/.test(output))
      console.error(
        "\n    ⚠️ This looks ENVIRONMENTAL: a transient Windows file lock, not a check failing.\n" +
          "    Run `git status docs/ward-flow/journey` — only generated files should differ — then run again.",
      );
    break; // a later step would read what this one did not write
  }
}

if (failed) {
  console.error(`\nNothing was published. Fix what is named above and run it again.`);
  process.exit(1);
}
console.log(
  proving
    ? `\nEvery check above was shown failing on a deliberately broken input.`
    : `\nDone. Open the page with:  node ${path.relative(process.cwd(), path.join(here, "serve.mjs"))}`,
);

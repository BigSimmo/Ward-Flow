#!/usr/bin/env node
/**
 * Every LOCAL `composes:` in a CSS Module, checked against where the class it names is declared.
 *
 * WHY THIS EXISTS RATHER THAN A GREP. A forward `composes` — a rule composing a class declared
 * BELOW it — returned 500 on every ward page once, and the reason it survived is that a presence
 * grep cannot see it. `grep composes` finds the line whether or not the ordering is legal, so a
 * green grep and a broken stylesheet look identical. The defect is not the PRESENCE of `composes`,
 * it is the ORDER of two lines, and only something that parses both can tell you.
 *
 * WHAT IT REPORTS
 *   FORWARD  — `composes: x` where `.x` is declared later in the same file (the 500 shape).
 *   MISSING  — `composes: x` where `.x` is not declared in the file at all.
 *
 * Cross-file `composes: x from "./y.module.css"` is deliberately NOT checked: it is a different
 * rule with different failure behaviour, and pretending one instrument covers both is how a guard
 * ends up reporting on a population it never walked.
 *
 * Run from the repository root:  node docs/ward-flow/tools/check-forward-composes.mjs
 * Exits 1 on any problem, 0 on none, and always prints the size of the population it walked —
 * "0 problems" over 0 files is not a pass, and the count is what tells the two apart.
 *
 * Verified 2026-09-08 at 05792e7a3f: 64 css modules, 20 local composes declarations, 0 problems.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const files = execSync('git ls-files "src/**/*.module.css"', { encoding: "utf8" }).split("\n").filter(Boolean);

let problems = 0;
let localComposes = 0;

for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");

  // First line on which each class name appears as a selector.
  const declaredOn = new Map();
  lines.forEach((line, index) => {
    for (const match of line.matchAll(/(^|[\s,>+~])\.([A-Za-z_][\w-]*)/g)) {
      if (!declaredOn.has(match[2])) declaredOn.set(match[2], index + 1);
    }
  });

  lines.forEach((line, index) => {
    const composes = line.match(/^\s*composes\s*:\s*([^;]+);/);
    if (!composes) return;
    const value = composes[1];
    if (/\bfrom\b/.test(value)) return; // cross-file: a different rule, see the doc comment
    localComposes += 1;

    for (const name of value.trim().split(/\s+/)) {
      const declaration = declaredOn.get(name);
      if (declaration === undefined) {
        console.log(`MISSING  ${file}:${index + 1}  composes: ${name}  -> no local .${name} declared`);
        problems += 1;
      } else if (declaration > index + 1) {
        console.log(
          `FORWARD  ${file}:${index + 1}  composes: ${name}  -> .${name} declared later at line ${declaration}`,
        );
        problems += 1;
      }
    }
  });
}

console.log(
  `\nscanned ${files.length} css modules, ${localComposes} local composes declarations, ${problems} problems`,
);
process.exit(problems ? 1 : 0);

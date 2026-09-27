import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const testsDir = path.join(projectRoot, "tests");
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(test|spec)\.tsx?$/u.test(entry.name)) files.push(full);
  }
};
walk(testsDir);
const chosen = new Set();
for (const file of files) {
  const relative = path.relative(projectRoot, file).split(path.sep).join("/");
  if (relative.startsWith("tests/ui-")) continue;
  if (/^tests\/ward-/u.test(relative)) {
    chosen.add(relative);
    continue;
  }
  const executable = readFileSync(file, "utf8")
    .split("\n")
    .some((line) => /ward-(management|flow)/u.test(line) && !/^\s*(\*|\/\/|\/\*)/u.test(line));
  if (executable) chosen.add(relative);
}
console.log(`population_files=${chosen.size}`);

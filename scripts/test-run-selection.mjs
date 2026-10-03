import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { isOfflineUnitTestFile } from "./unit-test-population.mjs";

const valueFlags = new Set([
  "--reporter",
  "-r",
  "--outputFile",
  "--outputFile.json",
  "--testNamePattern",
  "-t",
  "--project",
  "--bail",
  "--testTimeout",
  "--hookTimeout",
]);
const booleanFlags = new Set(["--run", "--passWithNoTests", "--no-file-parallelism", "--silent", "--hideSkippedTests"]);

/** @param {string[]} args
 * @param {{ root?: string, isFile?: (file: string) => boolean, population?: string[] }} [options]
 */
export function vitestLeaseMode(
  args,
  {
    root = process.cwd(),
    population,
    isFile = (file) => {
      try {
        return statSync(file).isFile();
      } catch {
        return false;
      }
    },
  } = {},
) {
  const start = args[0] === "run" ? 1 : 0;
  if (args[0] === "related") return "exclusive"; // Source import fan-out is not bounded by these arguments.
  const selected = [];
  let positionalOnly = false;
  for (let index = start; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--") {
      positionalOnly = true;
      continue;
    }
    if (!positionalOnly && argument.startsWith("-")) {
      const [flag, ...value] = argument.split("=");
      if (booleanFlags.has(flag) && value.length === 0) continue;
      if (!valueFlags.has(flag)) return "exclusive";
      if (value.length === 0 && (!args[index + 1] || args[++index].startsWith("-"))) return "exclusive";
      if (value.length && value.join("=") === "") return "exclusive";
      continue;
    }
    const absolute = path.resolve(root, argument);
    const relative = path.relative(root, absolute).replace(/\\/g, "/");
    if (!isOfflineUnitTestFile(relative) || !isFile(absolute)) return "exclusive";
    selected.push(relative);
  }
  if (selected.length === 0) return "exclusive";
  try {
    const files = population ?? offlinePopulation(root);
    // Installed Vitest matches case-insensitive substrings, including nested/prefix files.
    for (const selectedFile of selected) {
      const filter = selectedFile.toLocaleLowerCase();
      const matches = files.filter((file) => file.replace(/\\/g, "/").toLocaleLowerCase().includes(filter));
      if (matches.length !== 1 || matches[0].replace(/\\/g, "/") !== selectedFile) return "exclusive";
    }
    return "shared";
  } catch {
    return "exclusive";
  }
}

function offlinePopulation(root) {
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error("Unresolved test population link");
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) {
        const relative = path.relative(root, file).replace(/\\/g, "/");
        if (isOfflineUnitTestFile(relative)) files.push(relative);
      }
    }
  };
  walk(path.join(root, "tests"));
  return files;
}

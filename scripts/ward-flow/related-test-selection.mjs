import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { isOfflineUnitTestFile } from "../unit-test-population.mjs";

// These contracts inspect source bytes rather than importing the modules they protect.
// The appearance-key contract scans all src/: a second writer can be introduced anywhere.
export const SOURCE_READING_CONTRACTS = Object.freeze([
  { test: "tests/ward-referral-screen-boundary.test.ts", roots: ["src/components/ward-management/"] },
  { test: "tests/ward-no-invented-screen-figures.test.ts", roots: ["src/components/ward-management/"] },
  { test: "tests/ward-override-surfaces.test.ts", roots: ["src/components/ward-management/"] },
  { test: "tests/ward-one-appearance-key.test.ts", roots: ["src/"] },
]);

/** Read-only selection shared by both focused entry points. Capped import selections remain partial. */
export function selectRelatedTests({ root, changed, cap = 60, includeSourceGuards = true }) {
  const inputs = [...new Set(changed.map((file) => file.replaceAll("\\", "/")))];
  if (inputs.some((file) => path.posix.isAbsolute(file) || file.split("/").includes("..")))
    throw new Error("Related test inputs must stay inside the checkout");
  const isCode = (file) => /\.(tsx?|mjs|cjs|js|css)$/u.test(file);
  const changedTests = inputs.filter(isOfflineUnitTestFile);
  const sources = inputs.filter((file) => isCode(file) && !isOfflineUnitTestFile(file));
  const files = [];
  function walk(directory) {
    if (!existsSync(path.join(root, directory))) return;
    for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && !entry.name.startsWith(".")) walk(relative);
      } else if (entry.isFile() && /\.(tsx?|mjs|cjs|js)$/u.test(entry.name)) files.push(relative);
    }
  }
  if (sources.length) for (const directory of ["src", "scripts", "tests", "backend/ward-flow"]) walk(directory);

  const resolve = (from, specifier) => {
    const target = specifier.startsWith("@/")
      ? `src/${specifier.slice(2)}`
      : specifier.startsWith(".")
        ? path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier))
        : null;
    if (!target || target.split("/").includes("..")) return null;
    const candidates = [
      target,
      ...(target.endsWith(".js") ? [`${target.slice(0, -3)}.ts`, `${target.slice(0, -3)}.tsx`] : []),
      ...[".ts", ".tsx", ".mjs", ".cjs", ".js", "/index.ts", "/index.tsx", "/index.mjs", "/index.cjs", "/index.js"].map(
        (suffix) => `${target}${suffix}`,
      ),
    ];
    return (
      candidates.find(
        (candidate) => existsSync(path.join(root, candidate)) && statSync(path.join(root, candidate)).isFile(),
      ) ?? null
    );
  };
  const importers = new Map();
  for (const file of files) {
    const source = readFileSync(path.join(root, file), "utf8");
    for (const match of source.matchAll(/(?:from\s+|import\s*\(\s*|import\s+|require\(\s*)["']([^"']+)["']/gu)) {
      const target = resolve(file, match[1]);
      if (target) {
        if (!importers.has(target)) importers.set(target, new Set());
        importers.get(target).add(file);
      }
    }
  }
  const transitive = new Set(changedTests);
  const direct = new Set(changedTests);
  for (const source of sources) {
    const seen = new Set([source]);
    const queue = [source];
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      for (const importer of importers.get(current) ?? []) {
        if (seen.has(importer)) continue;
        seen.add(importer);
        if (isOfflineUnitTestFile(importer)) {
          transitive.add(importer);
          if (current === source) direct.add(importer);
        } else queue.push(importer);
      }
    }
  }
  let selected = [...transitive];
  const partial = selected.length > cap;
  if (partial) {
    selected = [...direct];
    if (selected.length > cap) {
      const stems = sources.map((source) => path.posix.basename(source).replace(/\.[^.]+$/u, ""));
      selected = [
        ...new Set(
          [...changedTests, ...direct].filter(
            (test) => changedTests.includes(test) || stems.some((stem) => path.posix.basename(test).startsWith(stem)),
          ),
        ),
      ];
    }
  }
  // Mandatory source-reading guards are appended after the fan-out cap. They cannot disappear
  // merely because a source module also has many runtime importers.
  const sourceGuards = SOURCE_READING_CONTRACTS.filter(
    (contract) =>
      inputs.some((file) => contract.roots.some((prefix) => file.startsWith(prefix))) &&
      existsSync(path.join(root, contract.test)),
  ).map((contract) => contract.test);
  if (includeSourceGuards) selected.push(...sourceGuards);
  selected = [...new Set(selected)].sort();
  return {
    selected,
    sourceGuards,
    deferredSourceGuards: includeSourceGuards ? [] : sourceGuards,
    partial: partial || (!includeSourceGuards && sourceGuards.length > 0),
    transitiveCount: transitive.size,
    directCount: direct.size,
    note: partial
      ? `fan-out capped: ${transitive.size} related, ${direct.size} direct; running ${selected.length} selected files. The batch gate covers the rest.`
      : `${selected.length} related test file(s) for ${inputs.length} changed file(s)`,
  };
}

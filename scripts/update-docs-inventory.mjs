#!/usr/bin/env node
/**
 * Keep the exact repository inventory in docs/scripts-index.md synchronized.
 *
 * The scripts index is intentionally curated rather than exhaustive, but its
 * headline counts are generated facts. Write mode refreshes those counts;
 * --check fails when they drift so verify:cheap and CI catch missed updates.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptsIndexPath = path.join(repoRoot, "docs", "scripts-index.md");
const packageJsonPath = path.join(repoRoot, "package.json");

const inventoryPattern =
  /Curated map of `scripts\/` \((?:~)?\d+ files\) and the `package\.json` script surface \((?:~)?\d+ entries\),/;
const inventoryMatchPattern =
  /Curated map of `scripts\/` \((?:~)?(\d+) files\) and the `package\.json` script surface \((?:~)?(\d+) entries\),/;

// Preserve the exported contract while making the permitted drift explicitly zero.
export const INVENTORY_TOLERANCE = 0;

export function parseScriptsInventoryCounts(markdown) {
  const match = inventoryMatchPattern.exec(markdown);
  if (!match) return null;
  return {
    scriptFileCount: parseInt(match[1], 10),
    npmScriptCount: parseInt(match[2], 10),
  };
}

/** Legacy export name retained for callers; the inventory now permits zero drift. */
export function isInventoryWithinTolerance(currentCounts, expectedCounts) {
  if (!currentCounts || !expectedCounts) return false;
  return (
    currentCounts.scriptFileCount === expectedCounts.scriptFileCount &&
    currentCounts.npmScriptCount === expectedCounts.npmScriptCount
  );
}

export function renderScriptsInventorySummary(scriptFileCount, npmScriptCount) {
  return `Curated map of \`scripts/\` (${scriptFileCount} files) and the \`package.json\` script surface (${npmScriptCount} entries),`;
}

export function updateScriptsInventoryText(markdown, scriptFileCount, npmScriptCount) {
  if (!inventoryPattern.test(markdown)) {
    throw new Error("docs/scripts-index.md is missing its generated repository inventory summary");
  }
  return markdown.replace(inventoryPattern, renderScriptsInventorySummary(scriptFileCount, npmScriptCount));
}

export function countTrackedScriptFiles(nullDelimitedPaths) {
  return nullDelimitedPaths.split("\0").filter((filePath) => filePath.startsWith("scripts/")).length;
}

export function collectRepositoryInventory() {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const trackedScripts = execFileSync("git", ["ls-files", "-z", "--", "scripts"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return {
    scriptFileCount: countTrackedScriptFiles(trackedScripts),
    npmScriptCount: Object.keys(packageJson.scripts ?? {}).length,
  };
}

function main() {
  const current = readFileSync(scriptsIndexPath, "utf8");
  const { scriptFileCount, npmScriptCount } = collectRepositoryInventory();
  const currentCounts = parseScriptsInventoryCounts(current);
  const check = process.argv.includes("--check");
  if (isInventoryWithinTolerance(currentCounts, { scriptFileCount, npmScriptCount })) {
    console.log(`Docs inventory current: ${scriptFileCount} script files, ${npmScriptCount} npm scripts.`);
    return;
  }

  if (check) {
    console.error(
      `docs/scripts-index.md inventory is stale. Run \`npm run docs:update\` ` +
        `(expected ${scriptFileCount} script files and ${npmScriptCount} npm scripts, current: ${currentCounts?.scriptFileCount ?? "unknown"} and ${currentCounts?.npmScriptCount ?? "unknown"}).`,
    );
    process.exitCode = 1;
    return;
  }

  const expected = updateScriptsInventoryText(current, scriptFileCount, npmScriptCount);
  writeFileSync(scriptsIndexPath, expected, "utf8");
  console.log(
    `Updated docs/scripts-index.md inventory: ${scriptFileCount} script files, ${npmScriptCount} npm scripts.`,
  );
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();

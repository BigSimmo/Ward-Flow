#!/usr/bin/env node

/**
 * Find local CSS-module composes declarations that refer to a class declared
 * later in the same module, or to a class that is not declared there.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const sourceRoot = path.join(repositoryRoot, "src");
const cssModules = [];

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(entryPath);
    else if (entry.isFile() && entry.name.endsWith(".module.css")) cssModules.push(entryPath);
  }
}

function lineNumber(text, offset) {
  return text.slice(0, offset).split("\n").length;
}

walk(sourceRoot);
cssModules.sort();
const problems = [];
let compositionCount = 0;

for (const file of cssModules) {
  const text = readFileSync(file, "utf8");
  const classes = [...text.matchAll(/\.([A-Za-z_][\w-]*)\s*\{/g)].map((match) => ({
    name: match[1],
    offset: match.index,
  }));
  const classOffsets = new Map(classes.map((entry) => [entry.name, entry.offset]));

  for (const match of text.matchAll(/\bcomposes:\s*([^;]+);/g)) {
    const value = match[1].trim();
    if (/\bfrom\s+/.test(value)) continue;
    const owner = classes.filter((entry) => entry.offset < match.index).at(-1);
    if (!owner) continue;
    for (const composed of value.split(/\s+/)) {
      compositionCount += 1;
      const targetOffset = classOffsets.get(composed);
      const location = `${path.relative(repositoryRoot, file)}:${lineNumber(text, match.index)}`;
      if (targetOffset === undefined) {
        problems.push(`MISSING ${location}: ${owner.name} composes ${composed}`);
      } else if (targetOffset > owner.offset) {
        problems.push(`FORWARD ${location}: ${owner.name} composes ${composed}`);
      }
    }
  }
}

console.log(`Walked ${cssModules.length} CSS modules and ${compositionCount} local composes declarations.`);
for (const problem of problems) console.error(problem);
process.exitCode = problems.length === 0 ? 0 : 1;

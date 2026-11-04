#!/usr/bin/env node
/** Offline inventory only by default. Enforce only after the owner reviews exact exceptions. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ALLOWED = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD"]);

/** A small SPDX expression evaluator; unsupported syntax fails closed. AND binds before OR. */
export function licenceAllowed(expression) {
  if (typeof expression !== "string" || !expression.trim()) return false;
  const tokens = expression.match(/[A-Za-z0-9.+-]+|[()]/g) ?? [];
  if (tokens.join("") !== expression.replace(/\s/g, "")) return false;
  let cursor = 0;
  function atom() {
    const token = tokens[cursor++];
    if (token === "(") {
      const result = disjunction();
      if (tokens[cursor++] !== ")") throw new Error("Unclosed SPDX expression");
      return result;
    }
    if (!token || [")", "AND", "OR", "WITH"].includes(token)) throw new Error("Missing SPDX licence");
    return ALLOWED.has(token);
  }
  function conjunction() {
    let result = atom();
    while (tokens[cursor] === "AND") {
      cursor++;
      const right = atom();
      result = result && right;
    }
    return result;
  }
  function disjunction() {
    let result = conjunction();
    while (tokens[cursor] === "OR") {
      cursor++;
      const right = conjunction();
      result = result || right;
    }
    return result;
  }
  try {
    const allowed = disjunction();
    return cursor === tokens.length && allowed;
  } catch {
    return false;
  }
}

export function licenceInventory(lock) {
  if (!lock?.packages || typeof lock.packages !== "object") throw new Error("Lockfile packages are missing");
  return Object.entries(lock.packages)
    .filter(([name, value]) => name && !value.dev && !value.devOptional)
    .map(([path, value]) => ({
      path,
      version: String(value.version ?? "unknown"),
      licence: value.license ?? "MISSING",
      allowed: licenceAllowed(value.license),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const enforce = args.includes("--enforce");
  if (args.some((argument) => argument !== "--enforce"))
    throw new Error("Usage: node scripts/check-licences.mjs [--enforce]");
  let exceptions = 0;
  for (const file of ["package-lock.json", "backend/ward-flow/package-lock.json"]) {
    const inventory = licenceInventory(JSON.parse(readFileSync(resolve(file), "utf8")));
    const review = inventory.filter((item) => !item.allowed);
    exceptions += review.length;
    console.log(
      JSON.stringify(
        { file, mode: enforce ? "enforce" : "inventory", productionPackages: inventory.length, review },
        null,
        2,
      ),
    );
  }
  console.log(
    `[licences] ${exceptions} package licences require owner review; ${enforce ? "enforcement requested" : "advisory inventory only"}.`,
  );
  if (enforce && exceptions) process.exitCode = 1;
}

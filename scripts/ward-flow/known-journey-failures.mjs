// The known-failing browser journeys list ("<file>:<line> | <title>" per line, "#" for comments),
// turned into the pattern playwright.config.ts uses to run them in their own fast-failing project.
import { existsSync, readFileSync } from "node:fs";

/** Titles from the list text. */
export function knownFailureTitles(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.includes("|") && !line.trimStart().startsWith("#"))
    .map((line) => line.slice(line.indexOf("|") + 1).trim())
    .filter(Boolean);
}

/** A RegExp matching any listed title literally, or null for an empty list. */
export function knownFailurePattern(text) {
  const titles = knownFailureTitles(text);
  if (titles.length === 0) return null;
  return new RegExp(titles.map((title) => title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"));
}

/** The pattern for the file named by WARD_JOURNEY_KNOWN_FAILURES, or null. */
export function knownFailurePatternFromEnvironment(environment = process.env) {
  const file = environment.WARD_JOURNEY_KNOWN_FAILURES;
  if (!file || !existsSync(file)) return null;
  return knownFailurePattern(readFileSync(file, "utf8"));
}

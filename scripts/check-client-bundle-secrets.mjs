#!/usr/bin/env node
// Guardrail: scans tracked source files under src/ for known credential patterns.
// This does not inspect built bundles or prove the absence of all exposed secrets.
//
// Usage:
//   node scripts/check-client-bundle-secrets.mjs
//   node scripts/check-client-bundle-secrets.mjs --strict

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const strict = process.argv.includes("--strict") || true;

const SECRET_PATTERNS = [
  { name: "OpenAI Secret Key", regex: /\bsk-[a-zA-Z0-9]{20,}\b/g },
  { name: "Anthropic API Key", regex: /\bsk-ant-[a-zA-Z0-9_-]{20,}\b/g },
  { name: "AWS Access Key", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "GitHub Personal Access Token", regex: /\bgh[pousr]_[a-zA-Z0-9]{36,}\b/g },
  { name: "Google API Key", regex: /\bAIza[0-9A-Za-z-_]{35}\b/g },
  {
    name: "Database URL with credentials",
    regex: /\b(?:postgres|postgresql|mysql|mongodb):\/\/[^:]+:[^@]+@[a-zA-Z0-9.-]+/g,
  },
  { name: "Private RSA/PEM Key Block", regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g },
];

// Eligible tracked source files; these can include server code as well as client code.
const files = execFileSync("git", ["ls-files", "-z", "--", "src"], { encoding: "utf8" })
  .split("\0")
  .filter((f) => f && /\.(tsx?|jsx?|json|css|mjs)$/.test(f))
  .filter((f) => !/\.test\.(tsx?|jsx?|mjs)$/.test(f));

const violations = [];
const unreadable = [];
let audited = 0;

for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    unreadable.push(file);
    continue;
  }

  // Skip files that test or validate synthetic secret patterns
  if (file.includes("synthetic-data-guard") || file.includes("secret-guard")) {
    continue;
  }
  audited += 1;

  const lines = text.split("\n");
  lines.forEach((line, index) => {
    // Ignore comment lines noting safe examples or dummy test keys
    if (line.includes("test-dummy") || line.includes("example-only") || line.includes("synthetic-only")) {
      return;
    }

    for (const pattern of SECRET_PATTERNS) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line)) {
        violations.push({
          file,
          line: index + 1,
          rule: pattern.name,
        });
      }
    }
  });
}

if (violations.length === 0 && unreadable.length === 0) {
  console.log(
    `[check-client-bundle-secrets] Clean: ${audited} tracked source files scanned for known credential patterns; ${files.length - audited} synthetic guard files excluded. No pattern matches found. Built bundles were not scanned.`,
  );
  process.exit(0);
} else {
  console.error(
    `[check-client-bundle-secrets] FAILED: ${violations.length} credential-pattern matches; ${unreadable.length} tracked source files unreadable:`,
  );
  for (const file of unreadable) console.error(`  - ${file} [unable to read tracked source]`);
  for (const v of violations) {
    console.error(`  - ${v.file}:${v.line} [${v.rule}] (value redacted)`);
  }
  process.exit(strict ? 1 : 0);
}

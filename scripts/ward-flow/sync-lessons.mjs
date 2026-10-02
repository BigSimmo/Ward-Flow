#!/usr/bin/env node
// Retired 2 October 2026: the former importer crossed the private Database boundary.
// Preserve the historical repository copy; this command performs no file access.
console.error(
  "Ward lesson import is retired. No private store was read and no files were written. " +
    "See docs/ward-flow/lessons/README.md; maintain only reviewed Ward-owned material.",
);
process.exitCode = 1;

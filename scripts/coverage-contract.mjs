/** Shared coverage inventory contract for Vitest and the post-run LCOV guard. */
export const COVERAGE_INCLUDE_GLOBS = Object.freeze(["src/**/*.{ts,tsx}", "scripts/**/*.{ts,mjs,cjs}"]);

export const COVERAGE_INVENTORY_ROOTS = Object.freeze(["src/", "scripts/"]);

// Declarations contain no executable statements; Vitest and the inventory exclude them explicitly.
export const COVERAGE_EXCLUDE_GLOBS = Object.freeze(["**/*.d.ts"]);

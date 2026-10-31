/** Shared coverage inventory contract for Vitest and the post-run LCOV guard. */
export const COVERAGE_INCLUDE_GLOBS = Object.freeze(["src/**/*.{ts,tsx}", "scripts/**/*.{ts,mjs,cjs}"]);

export const COVERAGE_INVENTORY_ROOTS = Object.freeze(["src/", "scripts/"]);

// Declarations contain no executable statements; Vitest and the inventory exclude them explicitly.
// The redesign mock-up fork copies (src/components/ward-redesign, D-89 and D-91) are design-only
// copies of real screens: blocked in production, untested by design, and each deleted when its page
// is built into ward-management, where coverage then counts it. About 176,000 lines, a third of the
// inventory, so counting them would sink the whole-inventory floor without saying anything about the
// real app. The real screens they copy stay counted, and no floor moves.
export const COVERAGE_EXCLUDE_GLOBS = Object.freeze(["**/*.d.ts", "src/components/ward-redesign/**"]);

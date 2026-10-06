import { vitestCacheDirectory } from "./scripts/test-cache-path.mjs";
import { COVERAGE_INCLUDE_GLOBS } from "./scripts/coverage-contract.mjs";
import { NODE_UNIT_TEST_GLOBS, DOM_UNIT_TEST_GLOBS, LIVE_UNIT_TEST_GLOBS } from "./scripts/unit-test-population.mjs";

const liveProviderTests = process.env.ALLOW_PROVIDER_TESTS === "true";

// Test files the Ward Flow gate skips (scripts/check-ward-expected-reds.mjs, WARD_GATE_SKIP_TOOLING),
// one repository-relative path per line. Vitest 4's CLI --exclude does not reach `projects`, so the
// gate hands its skip list over here instead of naming every other file on the command line.
const gateExcludedFiles = (process.env.WARD_GATE_EXCLUDE_FILES ?? "").split("\n").filter(Boolean);

const config = {
  // Codex worktrees commonly share node_modules through a junction. Keep Vite's
  // transform cache outside that shared dependency tree and unique per worktree.
  cacheDir: vitestCacheDirectory(process.cwd()),
  test: {
    // Route and RAG tests cold-import large Next.js module graphs inside the test
    // body. Give those transforms headroom on slower worktree filesystems while
    // retaining a finite timeout that still catches genuine hangs.
    testTimeout: 30_000,
    // CI runners and dev containers here have 4 cores / ~16 GB; the node suite is
    // CPU-bound (cold-imports large Next module graphs), so 2 workers left cores
    // idle. Scale to the host but cap so a smaller runner cannot oversubscribe,
    // and honour an explicit override for constrained environments.
    maxWorkers: process.env.VITEST_MAX_WORKERS ? Number(process.env.VITEST_MAX_WORKERS) : 4,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      // Inventory every executable TypeScript surface, including pages/layouts,
      // mockups, scripts, the worker, and Supabase Edge Functions. The existing
      // core threshold remains scoped to its historical files so expanding the
      // inventory cannot weaken that regression floor.
      include: [...COVERAGE_INCLUDE_GLOBS],
      thresholds: {
        // Whole-repository floors sit below the 2026-08-13 current-main measurement
        // (54.41/51.51/56.37/55.79) but close the previous no-global-floor gap.
        statements: 52,
        branches: 49,
        functions: 54,
        lines: 53,
        // Broad regression floor. Re-ratcheted 2026-07-29: the previous values
        // (48/38/43/50) had drifted 14-17pp below measured coverage
        // (63.99/55.29/57.6/66.19), so a change could delete a large amount of
        // coverage and still pass. Each floor now sits ~2pp under measured — enough
        // headroom for a PR that ships an uncovered surface, not enough to hide a
        // regression. Re-measure with `npm run test:coverage` and raise these when
        // the gap grows past ~5pp again; never lower them to make a red gate green.
        "src/{lib/**/*.ts,app/**/route.ts,components/**/*.{ts,tsx}}": {
          statements: 62,
          branches: 53,
          functions: 55,
          lines: 64,
        },
      },
    },
    // Two projects run under one `npm run test` invocation. `extends: true` makes
    // each inherit the shared root config above (coverage, timeouts, resolve.alias
    // below), so only the environment/include/setup differ.
    projects: [
      {
        extends: true,
        test: {
          // The long-standing suite: pure logic + route + SSR-string component tests.
          // Node environment, unchanged glob — existing tests behave exactly as before.
          name: "node",
          environment: "node",
          include: liveProviderTests ? LIVE_UNIT_TEST_GLOBS : NODE_UNIT_TEST_GLOBS,
          exclude: liveProviderTests ? [] : [...LIVE_UNIT_TEST_GLOBS, ...gateExcludedFiles],
        },
      },
      ...(!liveProviderTests
        ? [
            {
              extends: true,
              test: {
                // Interactive component tier: @testing-library/react under jsdom. Kept on a
                // distinct `*.dom.test.tsx` glob so it can never collect the node suite's
                // `*.test.ts` files (and vice versa).
                name: "jsdom",
                environment: "jsdom",
                include: DOM_UNIT_TEST_GLOBS,
                ...(gateExcludedFiles.length > 0 ? { exclude: gateExcludedFiles } : {}),
                setupFiles: ["tests/setup/jsdom.setup.ts"],
              },
            },
          ]
        : []),
    ],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "server-only": new URL("./tests/stubs/server-only.ts", import.meta.url).pathname,
    },
  },
};

// CI unit shards record coverage for their own slice only (WARD_COVERAGE_BLOB_DIR, see
// scripts/check-ward-expected-reds.mjs gateBatchArgs), which can never meet whole-suite floors. The
// coverage job merges every shard's blob report and applies the thresholds above, unchanged, to the
// whole suite. Every other run, including `npm run test:coverage`, applies them as before.
if (process.env.WARD_COVERAGE_BLOB_DIR) delete (config.test.coverage as { thresholds?: unknown }).thresholds;

export default config;

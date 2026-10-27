import { vitestCacheDirectory } from "./scripts/test-cache-path.mjs";
import { COVERAGE_INCLUDE_GLOBS, COVERAGE_EXCLUDE_GLOBS } from "./scripts/coverage-contract.mjs";
import { NODE_UNIT_TEST_GLOBS, DOM_UNIT_TEST_GLOBS, LIVE_UNIT_TEST_GLOBS } from "./scripts/unit-test-population.mjs";
import { UnitDurationSequencer } from "./scripts/ward-flow/unit-durations.mjs";

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
    // Vitest 5's persistent module cache is separate from Vite's cacheDir.
    // Keep generated transforms out of the integrity-stamped dependency tree.
    fsModuleCachePath: `${vitestCacheDirectory(process.cwd())}/modules`,
    // Route and RAG tests cold-import large Next.js module graphs inside the test
    // body. Give those transforms headroom on slower worktree filesystems while
    // retaining a finite timeout that still catches genuine hangs.
    testTimeout: 30_000,
    // Full-screen jsdom rendering and accessibility queries contend with imports on shared hosts.
    // Keep two workers by default; tune an explicit override from measurements on the target host.
    // This changes concurrency only: the test population, timeouts and coverage floors stay shared.
    maxWorkers: process.env.VITEST_MAX_WORKERS ? Number(process.env.VITEST_MAX_WORKERS) : 2,
    // CI runs (the unit shards and the related-tests step) start with no Vitest results cache, so run
    // their files longest first by measured cost; elsewhere Vitest orders by its own cached durations.
    ...(process.env.CI ? { sequence: { sequencer: UnitDurationSequencer } } : {}),
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      // Inventory every executable TypeScript surface, including pages/layouts,
      // mockups and scripts. The existing
      // core threshold remains scoped to its historical files so expanding the
      // inventory cannot weaken that regression floor.
      include: [...COVERAGE_INCLUDE_GLOBS],
      exclude: [...COVERAGE_EXCLUDE_GLOBS],
      thresholds: {
        // Re-ratcheted 27 Oct 2026 (CQ-09, H-0911). A full local `--coverage` run on main at
        // afed6b17 (1,638 test files) measured 82.43/79.18/83.15/83.91 for the whole inventory,
        // 88.81/82.46/85.99/90.65 for the core glob and 95.26/93.61/97.95/97.09 for the engine. Each
        // floor sits about 2 points under: enough headroom for a PR that ships an uncovered surface,
        // not enough to hide a regression. Re-measure with `npm run test:coverage` and raise these
        // when the gap grows past about 5 points; never lower them to make a red gate green.
        statements: 80,
        branches: 77,
        functions: 81,
        lines: 81,
        "src/{lib/**/*.ts,app/**/route.ts,components/**/*.{ts,tsx}}": {
          statements: 86,
          branches: 80,
          functions: 84,
          lines: 88,
        },
        // The engine the backend bundles (backend/ward-flow/engine.ts): the reducer, its slices, the
        // events and the rules they apply. It had no floor of its own.
        "src/components/ward-management/ward-flow-*.ts": {
          statements: 93,
          branches: 91,
          functions: 95,
          lines: 95,
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
          setupFiles: ["tests/setup/reducer-slices.setup.ts"],
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
                setupFiles: ["tests/setup/reducer-slices.setup.ts", "tests/setup/jsdom.setup.ts"],
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

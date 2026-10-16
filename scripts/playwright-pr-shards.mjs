#!/usr/bin/env node
/**
 * Duration-aware Production UI shard groups for required Chromium PR journeys.
 *
 * Playwright `--shard=i/N` balances by test *count* in collection (alphabetical)
 * order, which packs the slow phone-scroll family into one shard. Explicit
 * groups mix slow-per-test and faster mega-specs so wall time is closer across
 * runners. Every production `test:e2e:pr` file must appear in exactly one group
 * — its unit test failed closed on orphans/duplicates until it was retired with
 * PsychSift's design studies on 2026-09-25.
 *
 * Do not rename specs to game alphabetical sharding. Re-measure after suite
 * growth before changing group membership.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { childProcessExitCode } from "./child-process-result.mjs";

/** Matcher for Playwright specs collected by PR UI shards (api-csrf-proxy + 14 Ward Flow journeys). */
export const productionSpecFilePattern =
  /^(?:api-csrf-proxy|answer-progress-ui-smoke|dsm-ui-smoke|ui-(?:smoke|stress|accessibility|caring-contacts-workspace|clinical-ask|dictionary|document-canvas|tools|tools-show-all|ward-(?:management|chrome-header|coordinator|roles|discharges|capacity-morning-moved|referrals|forced-colors|full-journey|search|statistics-compare|statistics-journey|table-thresholds|responsive-audit)|overlap|universal-search|specifiers|sources|formulation(?:-result-cards)?|forms-section-nav|chrome-scroll|therapy-nav-scroll|therapy-pathways|mode-nav-density|phone-motion|phone-scroll(?:-[a-z0-9-]+)?|pwa|route-coverage|style-contract|token-layer-resolution|visual-artifacts|hydration))\.spec\.ts$/;

/**
 * One source of truth for shard membership across the 15 Playwright specs in Ward Flow
 * (`api-csrf-proxy.spec.ts` in `chromium` plus the 14 `ui-ward-*.spec.ts` journeys in
 * `chromium-mockups`).
 */
export const prUiSpecProfiles = Object.freeze([
  // Shard 1 (95.0s estimated)
  { file: "tests/api-csrf-proxy.spec.ts", shard: 1, fullSeconds: 2.0, criticalSeconds: 0 },
  {
    file: "tests/ui-ward-full-journey.spec.ts",
    shard: 1,
    fullSeconds: 45.0,
    criticalSeconds: 0,
    project: "chromium-mockups",
  },
  {
    file: "tests/ui-ward-chrome-header.spec.ts",
    shard: 1,
    fullSeconds: 18.0,
    criticalSeconds: 0,
    project: "chromium-mockups",
  },
  {
    file: "tests/ui-ward-capacity-morning-moved.spec.ts",
    shard: 1,
    fullSeconds: 15.0,
    criticalSeconds: 0,
    project: "chromium-mockups",
  },
  {
    file: "tests/ui-ward-forced-colors.spec.ts",
    shard: 1,
    fullSeconds: 15.0,
    criticalSeconds: 0,
    project: "chromium-mockups",
  },

  // Shard 2 (95.0s estimated)
  {
    file: "tests/ui-ward-management.spec.ts",
    shard: 2,
    fullSeconds: 35.0,
    criticalSeconds: 0,
    project: "chromium-mockups",
  },
  {
    file: "tests/ui-ward-referrals.spec.ts",
    shard: 2,
    fullSeconds: 25.0,
    criticalSeconds: 0,
    project: "chromium-mockups",
  },
  {
    file: "tests/ui-ward-discharges.spec.ts",
    shard: 2,
    fullSeconds: 15.0,
    criticalSeconds: 0,
    project: "chromium-mockups",
  },
  {
    file: "tests/ui-ward-search.spec.ts",
    shard: 2,
    fullSeconds: 10.0,
    criticalSeconds: 0,
    project: "chromium-mockups",
  },
  {
    file: "tests/ui-ward-table-thresholds.spec.ts",
    shard: 2,
    fullSeconds: 10.0,
    criticalSeconds: 0,
    project: "chromium-mockups",
  },

  // Shard 3 (95.0s estimated)
  {
    file: "tests/ui-ward-coordinator.spec.ts",
    shard: 3,
    fullSeconds: 25.0,
    criticalSeconds: 0,
    project: "chromium-mockups",
  },
  {
    file: "tests/ui-ward-roles.spec.ts",
    shard: 3,
    fullSeconds: 25.0,
    criticalSeconds: 0,
    project: "chromium-mockups",
  },
  {
    file: "tests/ui-ward-responsive-audit.spec.ts",
    shard: 3,
    fullSeconds: 15.0,
    criticalSeconds: 0,
    project: "chromium-mockups",
  },
  {
    file: "tests/ui-ward-statistics-compare.spec.ts",
    shard: 3,
    fullSeconds: 15.0,
    criticalSeconds: 0,
    project: "chromium-mockups",
  },
  {
    file: "tests/ui-ward-statistics-journey.spec.ts",
    shard: 3,
    fullSeconds: 15.0,
    criticalSeconds: 0,
    project: "chromium-mockups",
  },
]);

export const prUiShardGroups = Object.freeze(
  Object.fromEntries(
    [1, 2, 3].map((shard) => [
      shard,
      prUiSpecProfiles.filter((profile) => profile.shard === shard).map((profile) => profile.file),
    ]),
  ),
);

export function estimatedPrUiShardSeconds({ excludeCritical = false, profiles = prUiSpecProfiles } = {}) {
  const totals = { 1: 0, 2: 0, 3: 0 };
  for (const profile of profiles) {
    totals[profile.shard] += profile.fullSeconds - (excludeCritical ? profile.criticalSeconds : 0);
  }
  return totals;
}

export function listProductionSpecFiles(testsDir = path.join(process.cwd(), "tests")) {
  return readdirSync(testsDir)
    .filter((file) => productionSpecFilePattern.test(file))
    .map((file) => `tests/${file}`)
    .sort();
}

/** Every spec the required Production UI shards must cover. */
export function listPrUiSpecFiles(testsDir = path.join(process.cwd(), "tests")) {
  return listProductionSpecFiles(testsDir);
}

export function validatePrUiShardGroups(groups = prUiShardGroups, { listFiles = listPrUiSpecFiles } = {}) {
  const onDisk = listFiles();
  const assigned = [];
  const duplicates = [];
  for (const shard of Object.keys(groups).sort((a, b) => Number(a) - Number(b))) {
    const files = groups[shard];
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error(`PR UI shard ${shard} is empty — empty shards fail test:e2e:pr (no --pass-with-no-tests).`);
    }
    for (const file of files) {
      if (assigned.includes(file)) duplicates.push(file);
      assigned.push(file);
    }
  }
  const assignedSorted = [...assigned].sort();
  const missing = onDisk.filter((file) => !assigned.includes(file));
  const extra = assignedSorted.filter((file) => !onDisk.includes(file));
  return {
    ok: missing.length === 0 && extra.length === 0 && duplicates.length === 0,
    onDisk,
    assigned: assignedSorted,
    missing,
    extra,
    duplicates: [...new Set(duplicates)].sort(),
    shardCount: Object.keys(groups).length,
  };
}

export function filesForPrUiShard(shard, groups = prUiShardGroups) {
  const key = String(shard);
  const files = groups[key] ?? groups[Number(key)];
  if (!files?.length) {
    throw new Error(`Unknown or empty PR UI shard: ${shard}`);
  }
  return files;
}

/**
 * The projects a shard must select, in a stable order.
 *
 * A file list alone is not enough: Playwright collects a file only in a project whose `testMatch`
 * accepts it, so a spec assigned to a non-`chromium` project via a `prUiSpecProfiles` entry's
 * `project` field would contribute ZERO tests under a bare `--project=chromium` run, and the run
 * would still exit 0. Any such project is named alongside `chromium` here, and only when the shard
 * holds a file that needs it, so no other shard pays for a project it does not use.
 */
export function projectsForPrUiShard(shard, groups = prUiShardGroups, profiles = prUiSpecProfiles) {
  const files = filesForPrUiShard(shard, groups);
  const projects = ["chromium"];
  for (const profile of profiles) {
    if (profile.project && files.includes(profile.file) && !projects.includes(profile.project)) {
      projects.push(profile.project);
    }
  }
  return projects;
}

export function playwrightArgsForPrUiShard(shard, { excludeCritical = false } = {}) {
  // Ward journey specs belong to chromium-mockups and are intentionally tagged @mockup.
  // Do not exclude that tag or the mockup project shards collect no Ward tests.
  const grepInvert = excludeCritical ? "@critical|@quarantine" : "@quarantine";
  return [
    "scripts/run-playwright.mjs",
    ...filesForPrUiShard(shard),
    ...projectsForPrUiShard(shard).map((project) => `--project=${project}`),
    "--grep-invert",
    grepInvert,
  ];
}

function parseArgs(args) {
  const options = { shard: undefined, list: false, validate: false, excludeCritical: false };
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--list") {
      options.list = true;
      continue;
    }
    if (token === "--validate") {
      options.validate = true;
      continue;
    }
    if (token === "--exclude-critical") {
      options.excludeCritical = true;
      continue;
    }
    if (token === "--shard") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--shard requires a shard number (1..N).");
      options.shard = value;
      index += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      console.log(
        "Usage: node scripts/playwright-pr-shards.mjs --validate | --list | --shard N [--exclude-critical]\n" +
          "  --validate  Assert every production e2e:pr spec is in exactly one group.\n" +
          "  --list      Print shard membership.\n" +
          "  --shard N   Run test:e2e:pr for that explicit file group.\n" +
          "  --exclude-critical  Exclude @critical tests already proved by the fail-fast job.",
      );
      process.exit(0);
    }
    throw new Error(`Unknown option: ${token}`);
  }
  return options;
}

function isDirectRun() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  const options = parseArgs(process.argv.slice(2));
  if (options.validate || options.list) {
    const result = validatePrUiShardGroups();
    if (options.list) {
      for (const [shard, files] of Object.entries(prUiShardGroups)) {
        console.log(`shard ${shard} (${files.length} files):`);
        for (const file of files) console.log(`  ${file}`);
      }
    }
    if (!result.ok) {
      console.error(
        [
          "PR UI shard groups are out of sync with production specs.",
          result.missing.length ? `missing from groups: ${result.missing.join(", ")}` : null,
          result.extra.length ? `unknown in groups: ${result.extra.join(", ")}` : null,
          result.duplicates.length ? `duplicated: ${result.duplicates.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
      process.exit(1);
    }
    console.log(`PR UI shard parity OK: ${result.onDisk.length} production specs across ${result.shardCount} groups.`);
    process.exit(0);
  }

  if (!options.shard) {
    console.error("Provide --shard N, --validate, or --list.");
    process.exit(2);
  }

  const result = spawnSync(process.execPath, playwrightArgsForPrUiShard(options.shard, options), {
    stdio: "inherit",
    env: process.env,
  });
  process.exit(childProcessExitCode(result));
}

export const playwrightPrShardsInternals = { productionSpecFilePattern, prUiSpecProfiles, prUiShardGroups };

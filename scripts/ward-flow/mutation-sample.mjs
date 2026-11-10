#!/usr/bin/env node
// M87: a small, hand-picked mutation run on the engine's eligibility rules and the access scope.
// Plants one defect at a time, runs the tests that should catch it, and records killed or survived.
// No new tool: it uses the repository's own Vitest.
//
//   node scripts/ward-flow/mutation-sample.mjs --root <copy of the checkout> [--json <out.json>]
//
// It refuses to run on this checkout, because a planted defect would be visible to anyone else
// running tests in the same folder. Make a copy first (src, scripts, tests, data, docs, public,
// design, package.json, vitest.config.mts, tsconfig*.json, next-env.d.ts, and a node_modules link).
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = realpathSync(fileURLToPath(new URL("../..", import.meta.url)));
const ELIGIBILITY = "src/components/ward-management/ward-eligibility.ts";
const SCOPE = "src/components/ward-management/ward-access-scope.ts";
// Each mutant runs against every node unit test that imports its file directly (dom tests left out
// to keep the run small). Recorded with the score, so a later run can compare like with like.
function importers(root, file) {
  const stem = file.replace(/^src\//u, "").replace(/\.ts$/u, "");
  const dir = join(root, "tests");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".test.ts"))
    .filter((name) => {
      const text = readFileSync(join(dir, name), "utf8");
      return text.includes(`"@/${stem}"`) || text.includes(`/${stem.split("/").at(-1)}"`);
    })
    .map((name) => `tests/${name}`);
}

export const MUTANTS = [
  {
    id: "E1",
    file: ELIGIBILITY,
    what: "voluntary patients need an authorised (involuntary) bed",
    find: 'legalStatus?.trim() !== "Voluntary"',
    replace: 'legalStatus?.trim() === "Voluntary"',
  },
  {
    id: "E2",
    file: ELIGIBILITY,
    what: "a bed count is stale one minute early (boundary)",
    find: "now - unit.allocatable.confirmedAt <= unit.allocatable.staleAfterMinutes",
    replace: "now - unit.allocatable.confirmedAt < unit.allocatable.staleAfterMinutes",
  },
  {
    id: "E3",
    file: ELIGIBILITY,
    what: "a ward with 0 free beds is reported as having a bed (boundary)",
    find: "if (unit.allocatable.value <= 0) return",
    replace: "if (unit.allocatable.value < 0) return",
  },
  {
    id: "E4",
    file: ELIGIBILITY,
    what: "female-only and male-only wards swap",
    find: 'return designation === "Female only" ? sex === "Female" : sex === "Male";',
    replace: 'return designation === "Female only" ? sex === "Male" : sex === "Female";',
  },
  {
    id: "E5",
    file: ELIGIBILITY,
    what: "an undesignated ward refuses everyone",
    find: 'if (designation === "Undesignated") return true;',
    replace: 'if (designation === "Undesignated") return false;',
  },
  {
    id: "S1",
    file: SCOPE,
    what: "an expired break-glass grant still opens the record",
    find: "filter((grant) => grant.until > now)",
    replace: "filter((grant) => grant.until > now - 86_400_000)",
  },
  {
    id: "S2",
    file: SCOPE,
    what: "any ward-sent referral counts as this ward's own",
    find: " && unitIn(referral.originUnitId);",
    replace: ";",
  },
  {
    id: "S3",
    file: SCOPE,
    what: "other wards' waitlists leak into a scoped movement",
    find: "copy.waitlistedUnitIds = movement.waitlistedUnitIds.filter(unitIn);",
    replace: "copy.waitlistedUnitIds = movement.waitlistedUnitIds;",
  },
  {
    id: "S4",
    file: SCOPE,
    what: "a decided referral drops out at the window edge (boundary)",
    find: "(addressing.decidedAt ?? referral.raisedAt) <= window",
    replace: "(addressing.decidedAt ?? referral.raisedAt) < window",
  },
  {
    id: "S5",
    file: SCOPE,
    what: "a referral with no visible destination is kept instead of hidden",
    find: "if (destinations.length === 0 && !keepEmpty) return undefined;",
    replace: "if (destinations.length < 0 && !keepEmpty) return undefined;",
  },
];

function vitest(root, tests) {
  try {
    execFileSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--reporter=dot", ...tests], {
      cwd: root,
      stdio: "pipe",
      timeout: 600_000,
      env: { ...process.env, VITEST_MAX_WORKERS: "1" },
    });
    return "passed";
  } catch (error) {
    return error.killed ? "timeout" : "failed";
  }
}

function main(argv) {
  const rootAt = argv.indexOf("--root");
  if (rootAt === -1) throw new Error("--root <copy of the checkout> is required");
  const root = realpathSync(argv[rootAt + 1]);
  if (root === REPO) throw new Error("refusing to plant defects in the shared checkout; pass a copy");
  const jsonAt = argv.indexOf("--json");
  const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1].split(",") : null;

  const chosen = MUTANTS.filter((m) => !only || only.includes(m.id));
  const testsFor = new Map([...new Set(chosen.map((m) => m.file))].map((file) => [file, importers(root, file)]));
  const baseline = vitest(root, [...new Set([...testsFor.values()].flat())]);
  if (baseline !== "passed") throw new Error(`the chosen tests do not pass unmutated (${baseline})`);

  const results = [];
  for (const mutant of chosen) {
    const path = join(root, mutant.file);
    const original = readFileSync(path, "utf8");
    if (original.split(mutant.find).length !== 2) throw new Error(`${mutant.id}: target text not found exactly once`);
    writeFileSync(path, original.replace(mutant.find, mutant.replace));
    try {
      const outcome = vitest(root, testsFor.get(mutant.file));
      results.push({ id: mutant.id, file: mutant.file, what: mutant.what, killed: outcome !== "passed", outcome });
      console.log(`${mutant.id} ${outcome !== "passed" ? "killed" : "SURVIVED"}: ${mutant.what}`);
    } finally {
      writeFileSync(path, original);
    }
  }
  const killed = results.filter((r) => r.killed).length;
  const summary = {
    date: new Date().toISOString().slice(0, 10),
    killed,
    total: results.length,
    testFiles: Object.fromEntries([...testsFor].map(([file, tests]) => [file, tests.length])),
    results,
  };
  console.log(`score ${killed}/${results.length}`);
  if (jsonAt !== -1) writeFileSync(argv[jsonAt + 1], `${JSON.stringify(summary, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`mutation sample: ${error.message}`);
    process.exit(1);
  }
}

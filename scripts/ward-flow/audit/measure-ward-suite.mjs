/**
 * Same ward suite measurement as check-ward-expected-reds, but always prints
 * files / tests / failing counts even when the manifest comparison fails.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { compareFailingSet } from "../../check-ward-expected-reds.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const MANIFEST = path.join(projectRoot, "tests", "ward-expected-reds.json");

function wardPopulation() {
  const testsDir = path.join(projectRoot, "tests");
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(test|spec)\.tsx?$/u.test(entry.name)) files.push(full);
    }
  };
  walk(testsDir);
  const chosen = new Set();
  for (const file of files) {
    const relative = path.relative(projectRoot, file).split(path.sep).join("/");
    if (relative.startsWith("tests/ui-")) continue;
    if (/^tests\/ward-/u.test(relative)) {
      chosen.add(relative);
      continue;
    }
    const executable = readFileSync(file, "utf8")
      .split("\n")
      .some((line) => /ward-(management|flow)/u.test(line) && !/^\s*(\*|\/\/|\/\*)/u.test(line));
    if (executable) chosen.add(relative);
  }
  return [...chosen].sort();
}

const population = wardPopulation();
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const expected = new Map(manifest.expected.map((entry) => [entry.file, entry]));
const reportDir = mkdtempSync(path.join(tmpdir(), "ward-measure-"));
const reportPath = path.join(reportDir, "report.json");
const keptReport = path.join(
  projectRoot,
  "docs",
  "ward-flow",
  "audit-artefacts",
  "stabilisation-suite-report.json",
);

try {
  try {
    execFileSync(
      process.execPath,
      [
        path.join(projectRoot, "node_modules", "vitest", "vitest.mjs"),
        "run",
        "--pool=forks",
        "--reporter=json",
        `--outputFile=${reportPath}`,
        ...population,
      ],
      { cwd: projectRoot, stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, CI: "true" } },
    );
  } catch {
    // expected when reds exist
  }

  if (!existsSync(reportPath) || statSync(reportPath).size === 0) {
    console.error("MEASURE FAILED: no JSON report");
    process.exit(2);
  }

  // Keep a copy for this pass
  const reportRaw = readFileSync(reportPath, "utf8");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(keptReport, reportRaw);

  const report = JSON.parse(reportRaw);
  const totalTests = report.numTotalTests ?? 0;
  const suites = report.testResults ?? [];
  const failingFiles = [];
  let failingAssertions = 0;
  for (const suite of suites) {
    const relative = path.relative(projectRoot, suite.name).split(path.sep).join("/");
    const count = (suite.assertionResults ?? []).filter((result) => result.status === "failed").length;
    if (count > 0 || suite.status === "failed") {
      failingFiles.push({ file: relative, count: Math.max(count, 1) });
      failingAssertions += Math.max(count, 1);
    }
  }

  console.log(
    `MEASURE — ${population.length} files, ${totalTests} tests, ${failingFiles.length} failing files (${failingAssertions} failing assertions), suitesRan=${suites.length}`,
  );
  console.log(`failing files:\n${failingFiles.map((f) => `  ${f.file} (${f.count})`).join("\n")}`);

  const { unexpected, recovered, miscounted } = compareFailingSet({
    failing: failingFiles,
    expected: [...expected.values()],
  });
  console.log(
    `manifest compare: unexpected=${unexpected.length} recovered=${recovered.length} miscounted=${miscounted.length}`,
  );
  if (unexpected.length) console.log(`unexpected:\n${unexpected.map((f) => `  ${f}`).join("\n")}`);
  process.exit(unexpected.length || recovered.length || miscounted.length ? 1 : 0);
} finally {
  rmSync(reportDir, { recursive: true, force: true });
}

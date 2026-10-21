/** Refresh evidence from existing Playwright JSON only; never launches browsers or rewrites baselines. */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
export function journeyDurationsFromReports(reports) {
  const milliseconds = new Map();
  const seen = new Set();
  function walk(suite, parentFile = "") {
    const file = suite.file ?? parentFile;
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests ?? []) {
        if (test.projectName !== "chromium-mockups") continue;
        const name = path.posix.basename((spec.file ?? file).replaceAll("\\", "/"));
        const key = JSON.stringify([name, spec.id ?? spec.title, test.projectName, test.repeatEachIndex ?? 0]);
        if (seen.has(key)) throw new Error(`Duplicate browser timing evidence: ${name}`);
        seen.add(key);
        // Declared skip probes remain visible in browser verdicts but contribute no execution time.
        if (
          test.expectedStatus === "skipped" &&
          test.status === "skipped" &&
          (test.results ?? []).every((result) => result.status === "skipped")
        )
          continue;
        if (
          test.status !== "expected" ||
          test.expectedStatus !== "passed" ||
          !test.results?.length ||
          test.results.some(
            (result) => result.status !== "passed" || !Number.isFinite(result.duration) || result.duration < 0,
          )
        )
          throw new Error(`Browser timing evidence did not pass: ${name}`);
        milliseconds.set(
          name,
          (milliseconds.get(name) ?? 0) + test.results.reduce((sum, result) => sum + (result.duration ?? 0), 0),
        );
      }
    for (const child of suite.suites ?? []) walk(child, file);
  }
  for (const report of reports) {
    if (report.errors?.length) throw new Error("Browser timing report has errors");
    for (const suite of report.suites ?? []) walk(suite);
  }
  if (!milliseconds.size) throw new Error("No Chromium mockup timing evidence found");
  return Object.fromEntries(
    [...milliseconds]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, value]) => [file, Math.round(value / 100) / 10]),
  );
}
function reportPaths(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? reportPaths(path.join(directory, entry.name))
      : /^(journeys|shard-\d+)\.json$/u.test(entry.name)
        ? [path.join(directory, entry.name)]
        : [],
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] !== "--from-reports" || !process.argv[3])
      throw new Error(
        "usage: node scripts/ward-flow/journey-durations.mjs --from-reports <downloaded report directory>",
      );
    const files = reportPaths(process.argv[3]);
    const seconds = journeyDurationsFromReports(files.map((file) => JSON.parse(readFileSync(file, "utf8"))));
    const baseline = JSON.parse(readFileSync(new URL("./journey-durations.json", import.meta.url), "utf8")).seconds;
    console.log(
      JSON.stringify(
        {
          source:
            "Playwright JSON execution time (sum of passed test durations), seconds; compare before replacing wall-time baseline",
          seconds,
          comparison: Object.fromEntries(
            Object.entries(seconds).map(([file, measured]) => [
              file,
              {
                baseline: baseline[file] ?? null,
                measured,
                difference: baseline[file] === undefined ? null : Math.round((measured - baseline[file]) * 10) / 10,
              },
            ]),
          ),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

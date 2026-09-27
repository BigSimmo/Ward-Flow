// The verdict on a journeys run, read from Playwright's own JSON reports rather than trusted from
// exit codes alone.
//
// Why (26 September 2026): once the known-failures list was emptied, playwright.config.ts dropped
// the "chromium-mockups-known" project, the runner still asked for it, and Playwright reported
// "project not found", ran 0 tests and exited 0. The final-3 gate's journeys therefore never ran
// and still looked green. A run is now red when any of these holds, whatever the exit codes say:
//   - a shard left no readable report
//   - a report carries top-level errors (a config or project error, a crash)
//   - a requested --project is not among the projects the report ran with
//   - no test ran at all (nothing passed, failed or was flaky)

/** Project names the caller asked for, in either CLI spelling. */
export function requestedProjects(args) {
  const names = [];
  args.forEach((argument, index) => {
    if (argument.startsWith("--project=")) names.push(argument.slice("--project=".length));
    else if (argument === "--project" && args[index + 1]) names.push(args[index + 1]);
  });
  return names;
}

function countRan(report) {
  let ran = 0;
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (test.status === "expected" || test.status === "unexpected" || test.status === "flaky") ran++;
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report.suites ?? []) walk(suite);
  return ran;
}

/**
 * @param {{ label: string, code: number | null, report: object | null }[]} runs one per shard (or one)
 * @param {string[]} projects the --project names requested
 * @returns {{ ok: boolean, ran: number, problems: string[] }}
 */
export function journeyRunVerdict(runs, projects) {
  const problems = [];
  let ran = 0;
  for (const { label, code, report } of runs) {
    if (!report) {
      problems.push(`${label} left no readable report (exit ${code})`);
      continue;
    }
    for (const error of report.errors ?? []) {
      problems.push(`${label} reported an error: ${String(error?.message ?? error).split("\n")[0]}`);
    }
    const known = new Set((report.config?.projects ?? []).map((project) => project.name));
    for (const project of projects) {
      if (!known.has(project)) problems.push(`${label} did not run requested project "${project}"`);
    }
    ran += countRan(report);
  }
  if (ran === 0) problems.push("no test ran");
  return { ok: problems.length === 0, ran, problems };
}

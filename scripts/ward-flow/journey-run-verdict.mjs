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
//   - a required project executed no tests across the shards (or no test ran at all)

/** Project names the caller asked for, in either CLI spelling. */
export function requestedProjects(args) {
  const names = [];
  args.forEach((argument, index) => {
    if (argument.startsWith("--project=")) names.push(argument.slice("--project=".length));
    else if (argument === "--project" && args[index + 1]) names.push(args[index + 1]);
  });
  return names;
}

function countRan(report, byProject) {
  let ran = 0;
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (test.results?.some((result) => ["passed", "failed", "timedOut", "interrupted"].includes(result.status))) {
          ran++;
          byProject.set(test.projectName, (byProject.get(test.projectName) ?? 0) + 1);
        }
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
 * @param {{ optionalZeroProjects?: string[], passWithNoTests?: boolean }} options
 * @returns {{ ok: boolean, ran: number, problems: string[] }}
 */
export function journeyRunVerdict(runs, projects, { optionalZeroProjects = [], passWithNoTests = false } = {}) {
  const problems = [];
  let ran = 0;
  const byProject = new Map();
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
    ran += countRan(report, byProject);
  }
  // A project appearing in config proves selection only. Require actual execution across the
  // whole invocation, since an individual shard may legitimately have none for a project.
  // Only the runner's auxiliary known-failures selection may be empty by default. Callers must
  // opt into advisory empty selections explicitly; report/configuration errors still fail.
  if (!passWithNoTests) {
    for (const project of new Set(projects)) {
      if (!optionalZeroProjects.includes(project) && !byProject.get(project)) {
        problems.push(`no test ran for requested project "${project}"`);
      }
    }
    if (ran === 0) problems.push("no test ran");
  }
  return { ok: problems.length === 0, ran, problems };
}

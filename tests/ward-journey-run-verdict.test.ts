import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { journeyRunVerdict, requestedProjects } from "../scripts/ward-flow/journey-run-verdict.mjs";
import { knownFailurePatternFromEnvironment } from "../scripts/ward-flow/known-journey-failures.mjs";

// 26 September 2026: with the known-failures list emptied, the runner still asked for the
// "chromium-mockups-known" project, Playwright ran 0 tests and the gate's journeys looked green.
// Each way a run can "pass" without having run is proven red here.

const PROJECTS = [{ name: "chromium-mockups" }, { name: "chromium-mockups-known" }];
function report({
  statuses = ["expected"],
  projects = PROJECTS,
  projectName = "chromium-mockups",
  errors = [],
}: { statuses?: string[]; projects?: { name: string }[]; projectName?: string; errors?: unknown[] } = {}) {
  const suites: { title: string; specs: { tests: { status: string; projectName: string }[] }[]; suites: unknown[] }[] =
    [{ title: "a.spec.ts", specs: [{ tests: statuses.map((status) => ({ status, projectName })) }], suites: [] }];
  return {
    config: { projects },
    errors,
    suites,
  };
}

describe("journeyRunVerdict", () => {
  it("rejects a skipped required journey even when its project ran another passing test", () => {
    const requiredCase = {
      project: "release-gate-phone",
      file: "release-gate-journeys.spec.ts",
      title: "save and reload",
    };
    const partial = {
      config: { projects: [{ name: requiredCase.project }] },
      errors: [],
      suites: [
        {
          file: requiredCase.file,
          specs: [
            { title: "smoke", tests: [{ status: "expected", projectName: requiredCase.project }] },
            { title: requiredCase.title, tests: [{ status: "skipped", projectName: requiredCase.project }] },
          ],
        },
      ],
    };
    const verdict = journeyRunVerdict([{ label: "The run", code: 0, report: partial }], [requiredCase.project], {
      requiredCases: [requiredCase],
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.problems).toContain(
      "required journey did not pass: release-gate-phone / release-gate-journeys.spec.ts / save and reload",
    );
  });

  it("requires each case exactly once, passing rather than acknowledged as an expected failure", () => {
    const requiredCase = {
      project: "release-gate-desktop",
      file: "release-gate-journeys.spec.ts",
      title: "save and reload",
    };
    const makeReport = (tests: object[]) => ({
      config: { projects: [{ name: requiredCase.project }] },
      errors: [],
      suites: [{ file: `/checkout/tests/${requiredCase.file}`, specs: [{ title: requiredCase.title, tests }] }],
    });
    const passed = {
      status: "expected",
      expectedStatus: "passed",
      projectName: requiredCase.project,
      results: [{ status: "passed" }],
    };
    const verdict = (tests: object[]) =>
      journeyRunVerdict([{ label: "The run", code: 0, report: makeReport(tests) }], [requiredCase.project], {
        requiredCases: [requiredCase],
      });
    expect(verdict([passed]).ok).toBe(true);
    expect(verdict([]).ok).toBe(false);
    expect(verdict([passed, passed]).ok).toBe(false);
    expect(verdict([{ ...passed, expectedStatus: "failed", results: [{ status: "failed" }] }]).ok).toBe(false);
    expect(verdict([{ ...passed, results: [{ status: "skipped" }] }]).ok).toBe(false);
  });

  it("aggregates project execution across shards rather than requiring every project on each shard", () => {
    const verdict = journeyRunVerdict(
      [
        // Every shard is configured with the same --project selection; only execution is split.
        { label: "Shard 1", code: 0, report: report() },
        {
          label: "Shard 2",
          code: 1,
          report: report({ statuses: ["unexpected", "skipped"], projectName: "chromium-mockups-known" }),
        },
      ],
      ["chromium-mockups", "chromium-mockups-known"],
    );
    expect(verdict).toEqual({ ok: true, ran: 2, problems: [] });
  });

  it("fails when a requested project does not exist, even with an exit code of 0", () => {
    const verdict = journeyRunVerdict(
      [{ label: "Shard 1", code: 0, report: report({ projects: [{ name: "chromium-mockups" }] }) }],
      ["chromium-mockups", "chromium-mockups-known"],
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.problems).toContain('did not run requested project "chromium-mockups-known"');
  });

  it("rejects a configured project with only skipped tests even when another project ran", () => {
    const verdict = journeyRunVerdict(
      [
        { label: "Shard 1", code: 0, report: report() },
        { label: "Shard 2", code: 0, report: report({ statuses: ["skipped"], projectName: "chromium-mockups-known" }) },
      ],
      ["chromium-mockups", "chromium-mockups-known"],
    );
    expect(verdict).toEqual({
      ok: false,
      ran: 1,
      problems: ['did not run requested project "chromium-mockups-known"'],
    });
  });

  it("counts executed tests by projectName, including nested suites", () => {
    const nestedReport = report({ statuses: [], projects: [{ name: "release-gate-phone" }] });
    nestedReport.suites[0].suites.push(...report({ projectName: "release-gate-phone", statuses: ["flaky"] }).suites);
    expect(journeyRunVerdict([{ label: "The run", code: 0, report: nestedReport }], ["release-gate-phone"])).toEqual({
      ok: true,
      ran: 1,
      problems: [],
    });
  });

  it("permits an explicitly advisory empty selection while still requiring a readable error-free report", () => {
    expect(
      journeyRunVerdict([{ label: "The run", code: 0, report: report({ statuses: [] }) }], [], { allowNoTests: true }),
    ).toEqual({ ok: true, ran: 0, problems: [] });
    expect(journeyRunVerdict([{ label: "The run", code: 0, report: null }], [], { allowNoTests: true }).ok).toBe(false);
    expect(
      journeyRunVerdict(
        [{ label: "The run", code: 0, report: report({ statuses: [], errors: [{ message: "configuration error" }] }) }],
        [],
        { allowNoTests: true },
      ).ok,
    ).toBe(false);
  });

  it("fails when no test ran at all", () => {
    const verdict = journeyRunVerdict(
      [
        { label: "Shard 1", code: 0, report: report({ statuses: [] }) },
        { label: "Shard 2", code: 0, report: report({ statuses: ["skipped"] }) },
      ],
      ["chromium-mockups"],
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.ran).toBe(0);
    expect(verdict.problems).toContain("no test ran");
  });

  it("fails when a shard reports an error or leaves no report", () => {
    const verdict = journeyRunVerdict(
      [
        { label: "Shard 1", code: 0, report: report({ errors: [{ message: 'Project(s) "x" not found.\nmore' }] }) },
        { label: "Shard 2", code: 0, report: null },
        { label: "Shard 3", code: 0, report: report() },
      ],
      [],
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.problems).toEqual([
      'Shard 1 reported an error: Project(s) "x" not found.',
      "Shard 2 left no readable report (exit 0)",
    ]);
  });

  it("counts a flaky test as run", () => {
    expect(journeyRunVerdict([{ label: "The run", code: 0, report: report({ statuses: ["flaky"] }) }], []).ran).toBe(1);
  });
});

describe("requestedProjects", () => {
  it("reads both CLI spellings", () => {
    expect(requestedProjects(["--project=chromium-mockups", "--project", "chromium", "tests/a.spec.ts"])).toEqual([
      "chromium-mockups",
      "chromium",
    ]);
  });

  it("reads every name in a variadic --project selection, stopping at a file filter or option", () => {
    expect(
      requestedProjects([
        "--project",
        "release-gate-desktop",
        "release-gate-phone",
        "ui-ward-a.spec.ts",
        "--grep",
        "x",
      ]),
    ).toEqual(["release-gate-desktop", "release-gate-phone"]);
  });
});

describe("per-report project configuration", () => {
  it("rejects a report that does not configure a requested project, even when another report ran it", () => {
    const verdict = journeyRunVerdict(
      [
        { label: "Shard 1", code: 0, report: report() },
        { label: "Shard 2", code: 0, report: report({ projects: [{ name: "chromium-mockups" }] }) },
      ],
      ["chromium-mockups", "chromium-mockups-known"],
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.problems).toContain('Shard 2 did not configure requested project "chromium-mockups-known"');
  });

  it("still requires execution when every report configures the project", () => {
    const verdict = journeyRunVerdict(
      [{ label: "The run", code: 0, report: report() }],
      ["chromium-mockups", "chromium-mockups-known"],
    );
    expect(verdict.problems).toEqual(['did not run requested project "chromium-mockups-known"']);
  });
});

describe("the known-failures project is only asked for when the list names a test", () => {
  it("an emptied list gives no pattern, so the runner does not add the project", () => {
    const folder = mkdtempSync(path.join(tmpdir(), "ward-known-"));
    const empty = path.join(folder, "known.txt");
    writeFileSync(empty, "# emptied 26 September 2026\n");
    expect(knownFailurePatternFromEnvironment({ ...process.env, WARD_JOURNEY_KNOWN_FAILURES: empty })).toBeNull();
    const listed = path.join(folder, "listed.txt");
    writeFileSync(listed, "tests/a.spec.ts:1 | a title\n");
    expect(knownFailurePatternFromEnvironment({ ...process.env, WARD_JOURNEY_KNOWN_FAILURES: listed })).not.toBeNull();
  });
});

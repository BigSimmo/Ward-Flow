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
  it("aggregates project execution across shards rather than requiring every project on each shard", () => {
    const verdict = journeyRunVerdict(
      [
        { label: "Shard 1", code: 0, report: report({ projects: [{ name: "chromium-mockups" }] }) },
        {
          label: "Shard 2",
          code: 1,
          report: report({
            statuses: ["unexpected", "skipped"],
            projectName: "chromium-mockups-known",
            projects: [{ name: "chromium-mockups-known" }],
          }),
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

  it("uses executed test projectName rather than configured projects, including nested suites", () => {
    const nestedReport = report({ statuses: [], projects: [] });
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

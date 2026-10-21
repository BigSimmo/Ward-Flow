import { expect, it } from "vitest";
import { journeyDurationsFromReports } from "../scripts/ward-flow/journey-durations.mjs";
const report = (duration = 1250, status = "passed") => ({
  suites: [
    {
      file: "tests/ui-ward-roles.spec.ts",
      suites: [
        {
          specs: [
            {
              title: "synthetic",
              tests: [
                {
                  projectName: "chromium-mockups",
                  status: "expected",
                  expectedStatus: "passed",
                  results: [{ duration, status }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});
it("extracts existing report durations in seconds with no browser run", () => {
  expect(journeyDurationsFromReports([report()])).toEqual({ "ui-ward-roles.spec.ts": 1.3 });
});
it("refuses duplicate, failed and absent evidence", () => {
  expect(() => journeyDurationsFromReports([report(), report()])).toThrow(/Duplicate/);
  expect(() => journeyDurationsFromReports([report(10, "failed")])).toThrow(/did not pass/);
  expect(() => journeyDurationsFromReports([])).toThrow(/No Chromium/);
});

it("omits declared skips while retaining actual passed timings", () => {
  const measured = report();
  measured.suites[0]!.suites[0]!.specs.push({
    title: "declared skipped probe",
    tests: [
      {
        projectName: "chromium-mockups",
        status: "skipped",
        expectedStatus: "skipped",
        results: [{ duration: 0, status: "skipped" }],
      },
    ],
  });
  expect(journeyDurationsFromReports([measured])).toEqual({ "ui-ward-roles.spec.ts": 1.3 });
});
it("rejects unexpected skips, false skip declarations and evidence with no passed timing", () => {
  expect(() => journeyDurationsFromReports([report(0, "skipped")])).toThrow(/did not pass/);
  const skipped = report(0, "skipped");
  const test = skipped.suites[0]!.suites[0]!.specs[0]!.tests[0]!;
  test.expectedStatus = "skipped";
  test.status = "skipped";
  expect(() => journeyDurationsFromReports([skipped])).toThrow(/No Chromium/);
  test.results = [];
  expect(() => journeyDurationsFromReports([skipped])).toThrow(/No Chromium/);
  test.results = [{ duration: 0, status: "failed" }];
  expect(() => journeyDurationsFromReports([skipped])).toThrow(/did not pass/);
});

import { describe, expect, it } from "vitest";
import { selectedBaselineVerdict } from "../scripts/ward-flow/selected-baseline-verdict.mjs";
import { failureSignature } from "../scripts/check-ward-expected-reds.mjs";
const file = "tests/example.test.ts";
const name = "synthetic expected defect";
const reason = "Error: expected failure";
const expected = [
  { file, failing: 1, signatures: [failureSignature(name, reason)] },
  { file: "tests/unselected.test.ts", failing: 1, signatures: ["unselected"] },
];
const report = (message = reason, status = "failed") => ({
  numTotalTests: 1,
  testResults: [{ name: file, status, assertionResults: [{ fullName: name, status, failureMessages: [message] }] }],
});
const check = (value = report(), runResult = { status: 1 }) =>
  selectedBaselineVerdict({ report: value, selected: [file], expected, root: process.cwd(), runResult });
describe("signature-bound selected baseline verdict", () => {
  it("accepts only the selected original failure signature", () => {
    expect(check().ok).toBe(true);
    expect(check(report("Error: a different defect")).ok).toBe(false);
    const recovered = check(report(reason, "passed"), { status: 0 });
    if (!recovered.comparison) throw new Error("Recovery must produce the detailed baseline comparison");
    expect(recovered.comparison.recovered).toEqual([file]);
  });
  it("rejects incomplete, empty, collected-error and interrupted reports", () => {
    expect(check({ numTotalTests: 1, testResults: [] }).ok).toBe(false);
    expect(check({ numTotalTests: 0, testResults: [] }).ok).toBe(false);
    expect(check({ numTotalTests: 1, testResults: [{ name: file, status: "failed", assertionResults: [] }] }).ok).toBe(
      false,
    );
    expect(
      selectedBaselineVerdict({
        report: report(),
        selected: [file],
        expected,
        root: process.cwd(),
        runResult: { status: null, signal: "SIGTERM" },
      }).ok,
    ).toBe(false);
  });
});

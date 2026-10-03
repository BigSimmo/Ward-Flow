import path from "node:path";
import { compareFailingSet, failureSignature } from "../check-ward-expected-reds.mjs";
import { validateBatchReport } from "./full-gate-recheck.mjs";

export function selectedBaselineVerdict({ report, selected, expected, root, runResult }) {
  if (runResult?.error || runResult?.signal || ![0, 1].includes(runResult?.status))
    return { ok: false, reason: "interrupted or failed test launch" };
  const complete = validateBatchReport(report, selected, root);
  if (!complete.valid) return { ok: false, reason: complete.reason };
  const selectedExpected = expected.filter((entry) => selected.includes(entry.file));
  if (selectedExpected.some((entry) => !Array.isArray(entry.signatures) || entry.signatures.length !== entry.failing))
    return { ok: false, reason: "selected acknowledgement has no complete failure-signature evidence" };
  const failing = [];
  for (const suite of report.testResults) {
    const file = path.isAbsolute(suite.name)
      ? path.relative(root, suite.name).replace(/\\/g, "/")
      : suite.name.replace(/\\/g, "/");
    const failed = suite.assertionResults.filter((test) => test.status === "failed");
    if ((suite.status === "failed" && failed.length === 0) || suite.assertionResults.length === 0)
      return { ok: false, reason: `collection incomplete: ${file}` };
    if (failed.length)
      failing.push({
        file,
        count: failed.length,
        signatures: failed.map((test) => failureSignature(test.fullName, test.failureMessages?.[0])),
      });
  }
  if ((runResult.status === 0 && failing.length > 0) || (runResult.status !== 0 && failing.length === 0))
    return { ok: false, reason: "test exit status and assertion verdict disagree" };
  const comparison = compareFailingSet({ failing, expected: selectedExpected });
  const ok = Object.values(comparison).every((problems) => problems.length === 0);
  return {
    ok,
    reason: ok
      ? "selected failures match acknowledged signatures"
      : "selected failures differ from acknowledged signatures",
    comparison,
  };
}

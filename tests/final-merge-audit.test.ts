import { describe, expect, it } from "vitest";
import { validatePullRequestSnapshot } from "../scripts/final-merge-audit.mjs";

const greenSnapshot = {
  state: "OPEN",
  isDraft: false,
  mergeable: "MERGEABLE",
  mergeStateStatus: "CLEAN",
  title: "Improve phone chrome verification",
  headRefOid: "abc123",
  labels: [],
  statusCheckRollup: [{ name: "Ward Flow required", conclusion: "SUCCESS" }],
};

describe("validatePullRequestSnapshot", () => {
  it("accepts a settled, unlabelled PR at the expected head", () => {
    expect(validatePullRequestSnapshot(greenSnapshot, { expectedHead: "abc123" }).failures).toEqual([]);
  });

  it("fails closed on head drift, required-check failure, and a hold label", () => {
    const result = validatePullRequestSnapshot(
      {
        ...greenSnapshot,
        headRefOid: "changed",
        labels: [{ name: "hold" }],
        statusCheckRollup: [{ name: "Ward Flow required", conclusion: "FAILURE" }],
      },
      { expectedHead: "abc123" },
    );
    expect(result.failures.join(" ")).toContain("does not match expected head");
    expect(result.failures.join(" ")).toContain("not settled successfully");
    expect(result.failures.join(" ")).toContain("blocking label");
  });

  it("fails closed while GitHub mergeability or merge state is unsettled", () => {
    const result = validatePullRequestSnapshot({
      ...greenSnapshot,
      mergeable: "UNKNOWN",
      mergeStateStatus: "BEHIND",
    });
    expect(result.failures.join(" ")).toContain("expected MERGEABLE");
    expect(result.failures.join(" ")).toContain("expected CLEAN");
  });

  it("fails closed when the required aggregate check is absent", () => {
    const result = validatePullRequestSnapshot({ ...greenSnapshot, statusCheckRollup: [] });
    expect(result.failures).toContain("required check(s) missing: ward-flow-required");
  });

  it.each([
    { name: "Ward Flow required", conclusion: "FAILURE" },
    { name: "Ward Flow required", conclusion: "CANCELLED" },
    { name: "Ward Flow required", conclusion: null, status: "QUEUED" },
    { name: "Ward Flow required", conclusion: null, status: "IN_PROGRESS" },
    { context: "Ward Flow CI / Ward Flow required", state: "PENDING" },
  ])("fails closed while the current aggregate is unsuccessful: %j", (check) => {
    const result = validatePullRequestSnapshot({ ...greenSnapshot, statusCheckRollup: [check] });
    expect(result.failures).toContain("1 check(s) are not settled successfully");
    expect(result.missingRequiredChecks).toEqual([]);
  });

  it("does not let a retired green aggregate hide the current aggregate's failure", () => {
    const result = validatePullRequestSnapshot({
      ...greenSnapshot,
      statusCheckRollup: [
        { name: "PR required", conclusion: "SUCCESS" },
        { context: "CI / PR required", state: "SUCCESS" },
        { name: "Ward Flow required", conclusion: "FAILURE" },
      ],
    });
    expect(result.failures).toContain("1 check(s) are not settled successfully");
    expect(result.requiredChecks).toEqual([{ name: "Ward Flow required", conclusion: "FAILURE" }]);
  });

  it("does not accept a retired green aggregate when the current aggregate is missing", () => {
    const result = validatePullRequestSnapshot({
      ...greenSnapshot,
      statusCheckRollup: [{ name: "PR required", conclusion: "SUCCESS" }],
    });
    expect(result.failures).toContain("required check(s) missing: ward-flow-required");
  });

  it("accepts GitHub's workflow-qualified required-check context", () => {
    const result = validatePullRequestSnapshot({
      ...greenSnapshot,
      statusCheckRollup: [{ context: "Ward Flow CI / Ward Flow required", state: "SUCCESS" }],
    });
    expect(result.failures).toEqual([]);
  });

  it("does not let a failed advisory check block a successful required aggregate", () => {
    const result = validatePullRequestSnapshot({
      ...greenSnapshot,
      statusCheckRollup: [
        { name: "Ward Flow required", conclusion: "SUCCESS" },
        { name: "Advisory UI", conclusion: "FAILURE" },
        { name: "Ward Flow release gate", conclusion: "FAILURE" },
      ],
    });
    expect(result.failures).toEqual([]);
    expect(result.unsettledChecks).toEqual([]);
  });

  it("uses merged-state semantics for post-merge tree and health audits", () => {
    expect(
      validatePullRequestSnapshot({ ...greenSnapshot, state: "MERGED" }, { expectedHead: "abc123", postMerge: true })
        .failures,
    ).toEqual([]);
  });
});

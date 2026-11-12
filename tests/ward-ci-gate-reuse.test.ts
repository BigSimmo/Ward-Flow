import { describe, expect, it } from "vitest";

import { reusableGateEvidence } from "../scripts/ward-ci-public/gate-reuse.mjs";

const tree = "d".repeat(40);
const otherTree = "e".repeat(40);
const counts = { "unit shard": 4, "legal-figure sweep": 4, "browser group": 2 };
const gateNames = ["unit", "browser", "release", "build", "backend", "coverage"] as const;
const releaseSteps = [
  "Run the release-gate journeys",
  "Run the second release-gate suite",
  "Run the third release-gate suite",
];
type Job = { name: string; conclusion: string; steps: { name: string; conclusion: string }[] };

function passedJob(name: string, ...steps: string[]): Job {
  return { name, conclusion: "success", steps: steps.map((step) => ({ name: step, conclusion: "success" })) };
}

function greenJobs(): Job[] {
  return [
    ...Array.from({ length: counts["unit shard"] }, (_, index) =>
      passedJob(
        `Ward Flow unit shard ${index + 1}`,
        "Run reconciled unit suite shard",
        "Confirm the legal-figure sweep ran",
      ),
    ),
    ...Array.from({ length: counts["browser group"] }, (_, index) =>
      passedJob(`Ward Flow browser journeys ${index + 1}`, "Run Ward browser journeys"),
    ),
    passedJob("Ward Flow coverage", "Merge shard coverage and enforce thresholds"),
    passedJob("Ward Flow production build", "Build for production (Railway build command)"),
    // Phone runs as two jobs since D-166; desktop keeps its three suites in one.
    passedJob("Ward Flow release gate phone journeys and referrals", ...releaseSteps.slice(0, 2)),
    passedJob("Ward Flow release gate phone checks", releaseSteps[0]),
    passedJob("Ward Flow release gate desktop journeys, referrals and checks", ...releaseSteps),
    passedJob(
      "Ward Flow backend and shared production proof",
      "Run Ward backend tests",
      "Run the shared-mode browser journey",
    ),
  ];
}

function evidence(overrides: Record<string, unknown> = {}) {
  return {
    jobs: greenJobs(),
    counts,
    testedTree: tree,
    builtTree: tree,
    strictBudgetTree: tree,
    mainTree: tree,
    ...overrides,
  };
}

describe("independent main gate evidence", () => {
  it("reuses every gate only after its real work passed on the exact tree", () => {
    expect(reusableGateEvidence(evidence())).toEqual({
      unit: true,
      browser: true,
      release: true,
      build: true,
      backend: true,
      coverage: true,
      reasons: {},
    });
  });

  it("reruns unit and coverage when the legal sweep was omitted, retaining other gate evidence", () => {
    const jobs = greenJobs();
    jobs[2].steps.pop();
    const result = reusableGateEvidence(evidence({ jobs }));
    expect(result).toMatchObject({
      unit: false,
      coverage: false,
      browser: true,
      release: true,
      build: true,
      backend: true,
    });
    expect(result.reasons.unit).toContain("Confirm the legal-figure sweep ran");
    expect(result.reasons.coverage).toMatch(/unit/iu);
  });

  it.each([undefined, "", "d".repeat(39), "D".repeat(40), "invalid"])(
    "refuses every gate when the main tree is unavailable or malformed (%s)",
    (mainTree) => {
      const result = reusableGateEvidence(evidence({ mainTree }));
      for (const gate of gateNames) {
        expect(result[gate]).toBe(false);
        expect(result.reasons[gate]).toMatch(/main tree/iu);
      }
    },
  );

  it.each([undefined, otherTree])("requires exact tested-tree proof for each test gate (%s)", (testedTree) => {
    const result = reusableGateEvidence(evidence({ testedTree }));
    for (const gate of gateNames.filter((gate) => gate !== "build")) expect(result[gate]).toBe(false);
    expect(result.build).toBe(true);
  });

  it("rejects coerced tree values rather than treating an array as a valid SHA", () => {
    const receipt = [tree];
    const result = reusableGateEvidence(
      evidence({ mainTree: receipt, testedTree: receipt, builtTree: receipt, strictBudgetTree: receipt }),
    );
    for (const gate of gateNames) expect(result[gate]).toBe(false);
  });

  it.each([
    { builtTree: undefined },
    { builtTree: otherTree },
    { strictBudgetTree: undefined },
    { strictBudgetTree: otherTree },
  ])("requires both build-tree and strict-budget receipts even when other evidence passes (%s)", (receipts) => {
    const result = reusableGateEvidence(evidence(receipts));
    expect(result.build).toBe(false);
    expect(result.reasons.build).toMatch(/tree|budget/iu);
    for (const gate of gateNames.filter((gate) => gate !== "build")) expect(result[gate]).toBe(true);
  });

  it.each([
    ["unit", "Ward Flow unit shard ", "unit shard"],
    ["browser", "Ward Flow browser journeys ", "browser group"],
  ] as const)("requires every declared %s matrix ID exactly once", (gate, prefix, countName) => {
    const last = counts[countName];
    for (const replacement of ["1", "0", String(last + 1), "01", "unknown"]) {
      const jobs = greenJobs();
      jobs.find((job) => job.name === `${prefix}${last}`)!.name = `${prefix}${replacement}`;
      const result = reusableGateEvidence(evidence({ jobs }));
      expect(result[gate], replacement).toBe(false);
      expect(result.reasons[gate], replacement).toBeTruthy();
    }
    const jobs = greenJobs().filter((job) => job.name !== `${prefix}${last}`);
    expect(reusableGateEvidence(evidence({ jobs }))[gate]).toBe(false);
  });

  it.each([0, -1, 1.5, undefined, "4"])("refuses untrustworthy matrix counts (%s)", (count) => {
    const result = reusableGateEvidence(evidence({ counts: { "unit shard": count, "browser group": count } }));
    expect(result).toMatchObject({
      unit: false,
      coverage: false,
      browser: false,
      release: true,
      build: true,
      backend: true,
    });
  });

  it.each(["failure", "cancelled", "skipped"])("refuses a %s job or real-work step in each gate", (conclusion) => {
    const examples = [
      ["unit", "Ward Flow unit shard 1"],
      ["browser", "Ward Flow browser journeys 1"],
      ["release", "Ward Flow release gate phone checks"],
      ["build", "Ward Flow production build"],
      ["backend", "Ward Flow backend and shared production proof"],
      ["coverage", "Ward Flow coverage"],
    ] as const;
    for (const [gate, name] of examples) {
      for (const scope of ["job", "step"]) {
        const jobs = greenJobs();
        const job = jobs.find((candidate) => candidate.name === name)!;
        if (scope === "job") job.conclusion = conclusion;
        else job.steps[0].conclusion = conclusion;
        const result = reusableGateEvidence(evidence({ jobs }));
        expect(result[gate], `${gate} ${scope}`).toBe(false);
        expect(result.reasons[gate], `${gate} ${scope}`).toBeTruthy();
      }
    }
  });

  it.each(["Ward Flow coverage", "Ward Flow production build", "Ward Flow backend and shared production proof"])(
    "refuses missing and duplicate singleton jobs (%s)",
    (name) => {
      const gate = name.endsWith("coverage") ? "coverage" : name.endsWith("build") ? "build" : "backend";
      const jobs = greenJobs();
      const job = jobs.find((candidate) => candidate.name === name)!;
      expect(reusableGateEvidence(evidence({ jobs: jobs.filter((candidate) => candidate !== job) }))[gate]).toBe(false);
      expect(reusableGateEvidence(evidence({ jobs: [...jobs, job] }))[gate]).toBe(false);
    },
  );

  it("requires the real coverage merge rather than a historical coverage step", () => {
    const jobs = greenJobs();
    jobs.find((job) => job.name === "Ward Flow coverage")!.steps[0].name = "Run unit suite with coverage thresholds";
    expect(reusableGateEvidence(evidence({ jobs })).coverage).toBe(false);
  });

  it("requires both backend tests and the shared-mode journey", () => {
    for (const step of ["Run Ward backend tests", "Run the shared-mode browser journey"]) {
      const jobs = greenJobs();
      const job = jobs.find((candidate) => candidate.name === "Ward Flow backend and shared production proof")!;
      job.steps = job.steps.filter((candidate) => candidate.name !== step);
      expect(reusableGateEvidence(evidence({ jobs })).backend, step).toBe(false);
    }
  });

  it("requires every release suite on both phone and desktop", () => {
    for (const name of greenJobs()
      .map((job) => job.name)
      .filter((job) => job.startsWith("Ward Flow release gate "))) {
      for (const step of greenJobs()
        .find((job) => job.name === name)!
        .steps.map((candidate) => candidate.name)) {
        const jobs = greenJobs();
        const job = jobs.find((candidate) => candidate.name === name)!;
        job.steps = job.steps.filter((candidate) => candidate.name !== step);
        expect(reusableGateEvidence(evidence({ jobs })).release, `${name}: ${step}`).toBe(false);
      }
      const jobs = greenJobs().filter((job) => job.name !== name);
      expect(reusableGateEvidence(evidence({ jobs })).release, `without ${name}`).toBe(false);
    }
  });

  it("reads each release job's parts from its name, so every part runs exactly once per device", () => {
    const merged = greenJobs().filter((job) => !job.name.startsWith("Ward Flow release gate phone"));
    // The single phone job of three suites (before D-166) still proves the whole gate.
    expect(
      reusableGateEvidence(
        evidence({
          jobs: [...merged, passedJob("Ward Flow release gate phone journeys, referrals and checks", ...releaseSteps)],
        }),
      ).release,
    ).toBe(true);
    // A job that ran fewer suite steps than its name lists proves less than it claims.
    expect(
      reusableGateEvidence(
        evidence({
          jobs: [
            ...merged,
            passedJob("Ward Flow release gate phone journeys, referrals and checks", ...releaseSteps.slice(0, 2)),
          ],
        }),
      ).release,
    ).toBe(false);
    // A part covered twice, or an unknown part, is refused.
    for (const name of ["phone checks", "phone journeys and audits"]) {
      const jobs = greenJobs();
      jobs.find((job) => job.name === "Ward Flow release gate phone journeys and referrals")!.name =
        `Ward Flow release gate ${name}`;
      expect(reusableGateEvidence(evidence({ jobs })).release, name).toBe(false);
    }
  });

  it.each(["phone journeys, referrals and checks", "unknown", "phone desktop journeys"])(
    "refuses missing, duplicate or ambiguous release devices (%s)",
    (replacement) => {
      const jobs = greenJobs();
      jobs.find((job) => job.name.startsWith("Ward Flow release gate desktop"))!.name =
        `Ward Flow release gate ${replacement}`;
      expect(reusableGateEvidence(evidence({ jobs })).release).toBe(false);
    },
  );

  it("refuses duplicate real-work steps rather than selecting one successful copy", () => {
    const jobs = greenJobs();
    jobs[0].steps.push({ ...jobs[0].steps[0] });
    expect(reusableGateEvidence(evidence({ jobs })).unit).toBe(false);
  });

  it("fails closed for absent job evidence without throwing", () => {
    const result = reusableGateEvidence(evidence({ jobs: undefined }));
    for (const gate of gateNames) expect(result[gate]).toBe(false);
  });

  it("leaves global workflow verdict and ownership validation to its caller and does not mutate evidence", () => {
    const input = evidence({ jobs: [...greenJobs(), passedJob("Ward Flow required")] });
    input.jobs.at(-1)!.conclusion = "failure";
    const original = structuredClone(input);
    for (const gate of gateNames) expect(reusableGateEvidence(input)[gate]).toBe(true);
    expect(input).toEqual(original);
  });
});

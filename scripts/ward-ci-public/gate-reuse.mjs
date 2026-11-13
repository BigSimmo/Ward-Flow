/**
 * Decide each gate independently from one PR run's executed jobs and exact tree receipts.
 * The caller must first verify repository/PR ownership, the successful workflow and required
 * job, complete job history, and absence of a newer contradictory run. This helper performs
 * no provider calls and does not infer a tree receipt from an up-to-date PR head.
 */
const SHA = /^[0-9a-f]{40}$/u;

function stepsGap(job, requiredSteps) {
  if (job.conclusion !== "success") return `${job.name} did not succeed`;
  for (const name of requiredSteps) {
    const steps = (Array.isArray(job.steps) ? job.steps : []).filter((step) => step?.name === name);
    if (steps.length !== 1 || steps[0].conclusion !== "success") return `${job.name} did not prove ${name}`;
  }
  return null;
}

function singletonGap(jobs, name, steps) {
  const matching = jobs.filter((job) => job.name === name);
  return matching.length === 1 ? stepsGap(matching[0], steps) : `${name} needs exactly one job`;
}

function matrixGap(jobs, prefix, count, steps) {
  if (!Number.isSafeInteger(count) || count < 1) return `${prefix.trim()} count is unavailable or invalid`;
  const matching = jobs.filter((job) => job.name.startsWith(prefix));
  if (matching.length !== count) return `${prefix.trim()} needs exactly ${count} jobs`;
  const seen = new Set();
  for (const job of matching) {
    const label = job.name.slice(prefix.length);
    const id = Number(label);
    if (!/^\d+$/u.test(label) || String(id) !== label || id < 1 || id > count || seen.has(id))
      return `${prefix.trim()} has a duplicate or invalid matrix ID`;
    seen.add(id);
    const gap = stepsGap(job, steps);
    if (gap) return gap;
  }
  return null;
}

const RELEASE_PARTS = ["journeys", "referrals", "checks"];
const RELEASE_STEPS = [
  "Run the release-gate journeys",
  "Run the second release-gate suite",
  "Run the third release-gate suite",
];

/**
 * Each job's name says its device and the parts it ran in order ("phone journeys and referrals",
 * "desktop journeys, referrals and checks"; check-contracts.mjs ties every name to its matrix entry).
 * Every device must cover every part exactly once, and each job must prove one suite step per part.
 */
function releaseGap(jobs) {
  const matching = jobs.filter((job) => job.name.startsWith("Ward Flow release gate "));
  if (matching.length === 0) return "release gate needs one phone and one desktop job";
  const covered = { phone: new Set(), desktop: new Set() };
  for (const job of matching) {
    const label = job.name.slice("Ward Flow release gate ".length);
    const devices = ["phone", "desktop"].filter((device) => new RegExp(`\\b${device}\\b`, "u").test(label));
    if (devices.length !== 1) return "release gate has a duplicate or ambiguous device";
    const parts = label.split(/[\s,]+/u).filter((word) => word && word !== devices[0] && word !== "and");
    if (
      parts.length === 0 ||
      parts.length > RELEASE_STEPS.length ||
      parts.some((part) => !RELEASE_PARTS.includes(part))
    )
      return `${job.name} names no known release-gate parts`;
    for (const part of parts) {
      if (covered[devices[0]].has(part)) return "release gate has a duplicate or ambiguous device";
      covered[devices[0]].add(part);
    }
    const gap = stepsGap(job, RELEASE_STEPS.slice(0, parts.length));
    if (gap) return gap;
  }
  for (const device of ["phone", "desktop"])
    if (covered[device].size !== RELEASE_PARTS.length) return "release gate needs one phone and one desktop job";
  return null;
}

/**
 * A missing legal sweep invalidates unit, without discarding other gates. `unitExceptSweep` says every
 * shard still ran the rest of the unit suite, which, with coverage, lets main run only the sweep (D-166).
 * Build reuse always requires a separate strict-budget receipt for the built main tree.
 * Reasons contain only refused gates.
 * @returns {{unit: boolean, unitExceptSweep: boolean, browser: boolean, release: boolean, build: boolean,
 *   backend: boolean, coverage: boolean, reasons: Record<string, string>}}
 */
export function reusableGateEvidence({ jobs, counts, testedTree, builtTree, strictBudgetTree, mainTree } = {}) {
  const result = {
    unit: false,
    unitExceptSweep: false,
    browser: false,
    release: false,
    build: false,
    backend: false,
    coverage: false,
    reasons: {},
  };
  const decide = (gate, gap) => {
    result[gate] = gap === null;
    if (gap !== null) result.reasons[gate] = gap;
  };
  if (typeof mainTree !== "string" || !SHA.test(mainTree)) {
    for (const gate of ["unit", "unitExceptSweep", "browser", "release", "build", "backend", "coverage"])
      decide(gate, "main tree is unavailable or invalid");
    return result;
  }
  const provedJobs = Array.isArray(jobs) && jobs.every((job) => typeof job?.name === "string") ? jobs : [];
  const testedGap = testedTree === mainTree ? null : "tested tree does not match main tree";
  decide(
    "unitExceptSweep",
    testedGap ??
      matrixGap(provedJobs, "Ward Flow unit shard ", counts?.["unit shard"], ["Run reconciled unit suite shard"]),
  );
  decide(
    "unit",
    testedGap ??
      matrixGap(provedJobs, "Ward Flow unit shard ", counts?.["unit shard"], [
        "Run reconciled unit suite shard",
        "Confirm the legal-figure sweep ran",
      ]),
  );
  decide(
    "browser",
    testedGap ??
      matrixGap(provedJobs, "Ward Flow browser journeys ", counts?.["browser group"], ["Run Ward browser journeys"]),
  );
  decide("release", testedGap ?? releaseGap(provedJobs));
  decide(
    "backend",
    testedGap ??
      singletonGap(provedJobs, "Ward Flow backend and shared production proof", [
        "Run Ward backend tests",
        "Run the shared-mode browser journey",
      ]),
  );
  decide(
    "coverage",
    testedGap ??
      (result.unitExceptSweep
        ? singletonGap(provedJobs, "Ward Flow coverage", ["Merge shard coverage and enforce thresholds"])
        : "unit evidence is incomplete"),
  );
  decide(
    "build",
    builtTree !== mainTree
      ? "built tree does not match main tree"
      : strictBudgetTree !== mainTree
        ? "strict budget tree does not match main tree"
        : singletonGap(provedJobs, "Ward Flow production build", ["Build for production (Railway build command)"]),
  );
  return result;
}

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { removePathSync } from "../scripts/retryable-fs.mjs";

import { judgeAgainstMain, MAIN_TOLERANCE_KB } from "../scripts/check-script-budget.mjs";
import {
  ISSUE_LABEL,
  ISSUE_TITLE,
  issueBody,
  newlyWorse,
  overBudget,
  readReport,
} from "../scripts/ward-ci-public/budget-heal.mjs";
import { decideRun } from "../scripts/ward-ci-public/ci-tidy.mjs";

const budgets = { "/a": 500, "/b": 571.7 };
const mainSha = "c".repeat(40);
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) removePathSync(directory, { recursive: true, force: true });
});

// The real CLI runs with every HTTP call intercepted and child processes refused before its ESM
// imports load. Unknown calls throw; this harness cannot contact GitHub.
const preload = `
const fs = require('node:fs');
const stateFile = process.env.BUDGET_HEAL_TEST_STATE;
const read = () => JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const save = state => fs.writeFileSync(stateFile, JSON.stringify(state));
require('node:child_process').execFileSync = () => { throw new Error('Unexpected synthetic command'); };
require('node:module').syncBuiltinESMExports();
global.fetch = async (url, init = {}) => {
  const state = read();
  const endpoint = String(url).replace('https://api.github.com/repos/BigSimmo/Ward-Flow', '');
  const method = init.method || 'GET';
  const body = init.body ? JSON.parse(init.body) : undefined;
  state.calls.push({ method, endpoint, body });
  let result = {};
  const list = endpoint.match(/^\\/issues\\?state=open&creator=github-actions%5Bbot%5D&per_page=100&page=(\\d+)$/);
  if (method === 'GET' && list) {
    const page = Number(list[1]);
    result = state.issues.slice((page - 1) * 100, page * 100);
  } else if (method === 'POST' && endpoint === '/issues') {
    state.created = { number: 77, ...body };
    result = state.created;
  } else if (method === 'PATCH' && /^\\/issues\\/\\d+$/.test(endpoint)) {
    const issue = state.issues.find(item => item.number === Number(endpoint.split('/')[2]));
    if (!issue) throw new Error('Unknown synthetic issue');
    Object.assign(issue, body);
  } else if (method === 'POST' && /^\\/issues\\/\\d+\\/comments$/.test(endpoint)) {}
  else throw new Error('Unexpected synthetic API request: ' + method + ' ' + endpoint);
  save(state);
  return { ok: true, status: 200, json: async () => result, text: async () => '' };
};
`;

type SyntheticIssue = { number: number; title: string; body?: string; pull_request?: object };
function report({ issues = [], measured = 572.73 }: { issues?: SyntheticIssue[]; measured?: number } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), "ward-budget-over-"));
  directories.push(directory);
  writeFileSync(path.join(directory, "script-budget.json"), JSON.stringify({ budgets }));
  const measurement = path.join(directory, "measured.json");
  writeFileSync(measurement, JSON.stringify({ measured: { "/a": 490, "/b": measured } }));
  const stateFile = path.join(directory, "state.json");
  writeFileSync(stateFile, JSON.stringify({ calls: [], issues }));
  const hook = path.join(directory, "preload.cjs");
  writeFileSync(hook, preload);
  const result = spawnSync(
    process.execPath,
    ["--require", hook, path.resolve("scripts/ward-ci-public/budget-heal.mjs")],
    {
      cwd: directory,
      encoding: "utf8",
      timeout: 10_000,
      env: {
        ...process.env,
        BUDGET_HEAL_TEST_STATE: stateFile,
        GITHUB_TOKEN: "synthetic-offline-only",
        GITHUB_REPOSITORY: "BigSimmo/Ward-Flow",
        WARD_RUN_SHA: mainSha,
        WARD_MEASURED: measurement,
      },
    },
  );
  const state = JSON.parse(readFileSync(stateFile, "utf8"));
  const budgetFile = readFileSync(path.join(directory, "script-budget.json"), "utf8");
  return { result, state, budgetFile };
}

describe("budget gate: a PR is failed only for growth it caused", () => {
  it("passes a PR that only inherits main's overage (4 Nov: Ward 572.7 against 571.7)", () => {
    const { failing, inherited } = judgeAgainstMain({ "/a": 490, "/b": 572.7 }, { "/a": 490, "/b": 572.7 }, budgets);
    expect(failing).toEqual([]);
    expect(inherited).toEqual([{ route: "/b", kb: 572.7, limit: 571.7, main: 572.7 }]);
  });

  it("allows measurement noise up to the tolerance on top of an over main", () => {
    const kb = 572.7 + MAIN_TOLERANCE_KB;
    expect(judgeAgainstMain({ "/a": 490, "/b": kb }, { "/a": 490, "/b": 572.7 }, budgets).failing).toEqual([]);
  });

  it("fails a PR that grows an already-over route past the tolerance", () => {
    const { failing } = judgeAgainstMain({ "/a": 490, "/b": 574.3 }, { "/a": 490, "/b": 572.7 }, budgets);
    expect(failing.map(({ route }) => route)).toEqual(["/b"]);
  });

  it("fails a PR that pushes a within-budget main over, however small", () => {
    const { failing } = judgeAgainstMain({ "/a": 500.1, "/b": 570 }, { "/a": 499.9, "/b": 570 }, budgets);
    expect(failing.map(({ route }) => route)).toEqual(["/a"]);
  });

  it("fails every over route when main could not be measured", () => {
    const { failing } = judgeAgainstMain({ "/a": 490, "/b": 572.7 }, undefined, budgets);
    expect(failing.map(({ route }) => route)).toEqual(["/b"]);
  });
});

describe("budget over issue: the bot asks for a trim and never raises a budget", () => {
  it("lists only over routes, with the measured size and how far over", () => {
    expect(overBudget({ "/a": 480, "/b": 572.73 }, budgets)).toEqual([{ route: "/b", limit: 571.7, kb: 572.7, by: 1 }]);
  });

  it("reports nothing when main is within budget or a measurement is missing", () => {
    expect(overBudget({ "/a": 500, "/b": 571.7 }, budgets)).toEqual([]);
    expect(overBudget({}, budgets)).toEqual([]);
  });

  it("comments again only for a newly over route or growth past the last report", () => {
    const previous = [{ route: "/b", kb: 572.7 }];
    expect(newlyWorse([{ route: "/b", limit: 571.7, kb: 574.2, by: 2.5 }], previous)).toEqual([]);
    expect(newlyWorse([{ route: "/b", limit: 571.7, kb: 574.3, by: 2.6 }], previous)).toHaveLength(1);
    expect(newlyWorse([{ route: "/a", limit: 500, kb: 501, by: 1 }], previous)).toHaveLength(1);
  });

  it("asks for a trim, says a person decides any raise, and round-trips its measurements", () => {
    const over = [{ route: "/b", limit: 571.7, kb: 572.7, by: 1 }];
    const body = issueBody({ over, sha: "cdbd78ff0000", runUrl: "https://example.invalid/run/1" });
    expect(body).toMatch(/^Main cdbd78f measured over/);
    expect(body).toContain("`/b`: 572.7 KB gzipped against 571.7 KB (1 KB over)");
    expect(body).toContain("This bot never raises");
    expect(body).not.toMatch(/\n\n\n/);
    expect(readReport(body)).toEqual([{ route: "/b", kb: 572.7 }]);
    expect(readReport("no marker")).toEqual([]);
  });

  it("never writes script-budget.json, a branch or a pull request", () => {
    const code = readFileSync(new URL("../scripts/ward-ci-public/budget-heal.mjs", import.meta.url), "utf8");
    expect(code).not.toMatch(/writeFileSync|child_process|\/pulls|\/git\/|dispatches|enablePullRequestAutoMerge/);
  });
});

describe("budget over issue: the real script against a synthetic GitHub", () => {
  type Call = { method: string; endpoint: string };

  it("opens one labelled trim issue and leaves the budget file alone", () => {
    const { result, state, budgetFile } = report();
    expect(result.status, result.stderr).toBe(0);
    expect(state.created.title).toBe(ISSUE_TITLE);
    expect(state.created.labels).toEqual([ISSUE_LABEL]);
    expect(state.created.body).toContain("trim");
    expect(JSON.parse(budgetFile)).toEqual({ budgets });
    expect(state.calls.every((call: Call) => call.endpoint.startsWith("/issues"))).toBe(true);
  });

  it("does nothing when main is within budget", () => {
    const { result, state } = report({ measured: 571.7 });
    expect(result.status, result.stderr).toBe(0);
    expect(state.calls).toEqual([]);
  });

  it("rewrites an open issue found past the first page without a comment when nothing got worse", () => {
    const body = issueBody({ over: [{ route: "/b", limit: 571.7, kb: 572.7, by: 1 }], sha: mainSha });
    const issues = [
      ...Array.from({ length: 100 }, (_, index) => ({ number: 1000 + index, title: `Other ${index}` })),
      { number: 9, title: ISSUE_TITLE, body },
    ];
    const { result, state } = report({ issues, measured: 573.5 });
    expect(result.status, result.stderr).toBe(0);
    expect(state.created).toBeUndefined();
    expect(state.calls.filter((call: Call) => call.method === "PATCH").map((call: Call) => call.endpoint)).toEqual([
      "/issues/9",
    ]);
    expect(state.calls.some((call: Call) => call.endpoint.endsWith("/comments"))).toBe(false);
    expect(readReport(state.issues[100].body)).toEqual([{ route: "/b", kb: 573.5 }]);
  });

  it("comments when a route grew past the last report", () => {
    const body = issueBody({ over: [{ route: "/b", limit: 571.7, kb: 572.7, by: 1 }], sha: mainSha });
    const { result, state } = report({ issues: [{ number: 9, title: ISSUE_TITLE, body }], measured: 580 });
    expect(result.status, result.stderr).toBe(0);
    expect(state.calls.filter((call: Call) => call.endpoint === "/issues/9/comments")).toHaveLength(1);
  });

  it("ignores a pull request that shares the title", () => {
    const { result, state } = report({ issues: [{ number: 5, title: ISSUE_TITLE, pull_request: {} }] });
    expect(result.status, result.stderr).toBe(0);
    expect(state.created.number).toBe(77);
  });
});

describe("CI tidy: which runs give their runner slot back", () => {
  const open = new Map([["feature", "new"]]);
  const pr = { event: "pull_request", name: "Ward Flow CI", head_branch: "feature", head_sha: "old" };

  it("cancels any pull-request run whose PR is merged or closed", () => {
    expect(decideRun({ ...pr, head_branch: "merged" }, open).cancel).toBe(true);
    expect(decideRun({ ...pr, event: "pull_request_target", head_branch: "merged" }, open).cancel).toBe(true);
  });

  it("cancels an older head's run only while none of its jobs is running", () => {
    expect(decideRun(pr, open, [{ status: "completed" }, { status: "queued" }]).cancel).toBe(true);
    expect(decideRun(pr, open, [{ status: "in_progress" }]).cancel).toBe(false);
  });

  it("never cancels the current head, main, manual or scheduled runs, or itself", () => {
    expect(decideRun({ ...pr, head_sha: "new" }, open).cancel).toBe(false);
    for (const event of ["push", "workflow_dispatch", "schedule", "workflow_run"])
      expect(decideRun({ ...pr, event, head_branch: "main" }, open).cancel).toBe(false);
    expect(decideRun({ ...pr, name: "Ward Flow CI tidy", head_branch: "merged" }, open).cancel).toBe(false);
  });
});

describe("heal and tidy workflows never run pull-request code", () => {
  for (const file of ["ward-flow-budget-heal.yml", "ward-flow-ci-tidy.yml"]) {
    const code = readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), "utf8")
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n");
    it(`${file} checks out main only and uses no secrets or paid runners`, () => {
      expect([...code.matchAll(/^\s+ref:\s*(.+)$/gm)].map((match) => match[1].trim())).toEqual(["main"]);
      expect(code).not.toMatch(/pull_request\.head|github\.head_ref|refs\/pull\/|secrets\./);
      expect([...code.matchAll(/runs-on: (.+)$/gm)].map((match) => match[1])).toEqual(["ubuntu-24.04"]);
    });
  }

  it("the budget over workflow can write issues only", () => {
    const yml = readFileSync(new URL("../.github/workflows/ward-flow-budget-heal.yml", import.meta.url), "utf8");
    const block = yml.match(/^permissions:\n((?:  .+\n)+)/m)?.[1] ?? "";
    const granted = [...block.matchAll(/^  ([a-z-]+): (\w+)/gm)].map((match) => `${match[1]}: ${match[2]}`);
    expect(granted).toEqual(["contents: read", "issues: write", "actions: read"]);
  });
});

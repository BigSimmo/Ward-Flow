import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { removePathSync } from "../scripts/retryable-fs.mjs";

import { judgeAgainstMain, MAIN_TOLERANCE_KB } from "../scripts/check-script-budget.mjs";
import {
  AUTO_MERGE_MAX_KB,
  BRANCH_PREFIX,
  canAutoMerge,
  historyEntry,
  perthDate,
  planRaise,
} from "../scripts/ward-ci-public/budget-heal.mjs";
import { decideRun } from "../scripts/ward-ci-public/ci-tidy.mjs";

const budgets = { "/a": 500, "/b": 571.7 };
const mainSha = "c".repeat(40);
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) removePathSync(directory, { recursive: true, force: true });
});

// The real CLI runs with every Git and HTTP call intercepted before its ESM imports load.
// Unknown calls throw; this harness cannot contact GitHub or publish a branch.
const preload = `
const fs = require('node:fs');
const stateFile = process.env.BUDGET_HEAL_TEST_STATE;
const read = () => JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const save = state => fs.writeFileSync(stateFile, JSON.stringify(state));
require('node:child_process').execFileSync = (command, args) => {
  if (command !== 'git' || !['rev-parse', 'config', 'switch', 'add', 'commit', 'push'].includes(args[0]))
    throw new Error('Unexpected synthetic command');
  const state = read();
  state.calls.push({ method: 'git', endpoint: args[0], args }); save(state);
  return args[0] === 'rev-parse' ? state.main : '';
};
require('node:module').syncBuiltinESMExports();
global.fetch = async (url, init = {}) => {
  const state = read();
  const endpoint = String(url).replace('https://api.github.com/repos/BigSimmo/Ward-Flow', '');
  const method = init.method || 'GET';
  const body = init.body ? JSON.parse(init.body) : undefined;
  state.calls.push({ method, endpoint, body });
  let result = {};
  let status = 200;
  if (method === 'GET' && /^\\/pulls\\?state=open&base=main&per_page=100(?:&page=\\d+)?$/.test(endpoint)) {
    const page = Number(new URL(endpoint, 'https://synthetic.invalid').searchParams.get('page') || 1);
    result = state.open.slice((page - 1) * 100, page * 100);
  }
  else if (method === 'POST' && endpoint === '/pulls') {
    state.proposal = { number: 42, node_id: 'synthetic-pr', ...body, labels: [] };
    result = state.proposal;
  } else if (method === 'POST' && endpoint === '/issues/42/labels') {
    if (state.labelFailure) status = 503;
    else state.proposal.labels = body.labels;
  } else if (method === 'POST' && /^\\/issues\\/\\d+\\/comments$/.test(endpoint)) {}
  else if (method === 'PATCH' && /^\\/pulls\\/\\d+$/.test(endpoint)) {
    const pr = state.open.find(pr => pr.number === Number(endpoint.split('/')[2]));
    if (!pr) throw new Error('Unknown existing synthetic PR');
    Object.assign(pr, body);
  } else if (method === 'POST' && /^\\/actions\\/workflows\\/[^/]+\\/dispatches$/.test(endpoint)) {}
  else if (method === 'POST' && url === 'https://api.github.com/graphql') {}
  else throw new Error('Unexpected synthetic API request: ' + method + ' ' + endpoint);
  save(state);
  return { ok: status === 200, status, json: async () => result, text: async () => 'Synthetic label failure' };
};
`;

type ExistingPull = { number: number; head: { ref: string }; labels?: { name: string }[]; auto_merge?: object | null };
function proposal({
  open = [],
  labelFailure = false,
  measured = 572.73,
}: { open?: ExistingPull[]; labelFailure?: boolean; measured?: number } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), "ward-budget-heal-"));
  directories.push(directory);
  mkdirSync(path.join(directory, "docs/script-budget-history"), { recursive: true });
  writeFileSync(path.join(directory, "script-budget.json"), JSON.stringify({ budgets }));
  const measurement = path.join(directory, "measured.json");
  writeFileSync(measurement, JSON.stringify({ measured: { "/a": 490, "/b": measured } }));
  const stateFile = path.join(directory, "state.json");
  writeFileSync(stateFile, JSON.stringify({ main: mainSha, calls: [], open, labelFailure }));
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
  return { result, state };
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

describe("budget heal: what the bot PR raises", () => {
  it("proposes only over routes, with the owner's 0.2 KB margin rounded up to 0.1 KB", () => {
    const { budgets: next, raises } = planRaise({ "/a": 480, "/b": 572.73 }, budgets);
    expect(next).toEqual({ "/a": 500, "/b": 573 });
    expect(raises).toEqual([{ route: "/b", from: 571.7, to: 573, kb: 572.7 }]);
  });

  it("does nothing when main is within budget or a measurement is missing", () => {
    expect(planRaise({ "/a": 500, "/b": 571.7 }, budgets).raises).toEqual([]);
    expect(planRaise({}, budgets).raises).toEqual([]);
  });

  it(`keeps the ${AUTO_MERGE_MAX_KB} KB size allowance separate from approval to merge`, () => {
    expect(canAutoMerge([{ route: "/b", from: 571.7, to: 576.7, kb: 575.7 }])).toBe(true);
    expect(canAutoMerge([{ route: "/b", from: 571.7, to: 576.8, kb: 575.8 }])).toBe(false);
    expect(canAutoMerge([])).toBe(false);
    expect(
      canAutoMerge([
        { from: 500, to: 501 },
        { from: 500, to: 506 },
      ]),
    ).toBe(false);
  });

  it("opens a held proposal before dispatching CI and never asks to arm auto-merge", () => {
    const { result, state } = proposal();
    expect(result.status, result.stderr).toBe(0);
    const label = state.calls.findIndex((call: { endpoint: string }) => call.endpoint === "/issues/42/labels");
    const dispatch = state.calls.findIndex((call: { endpoint: string }) => call.endpoint.includes("/dispatches"));
    expect(label).toBeGreaterThanOrEqual(0);
    expect(label).toBeLessThan(dispatch);
    expect(state.proposal.labels).toEqual(["hold"]);
    expect(state.proposal.body).toMatch(/diagnos/i);
    expect(state.proposal.body).toMatch(/trim/i);
    expect(state.calls.some((call: { endpoint: string }) => call.endpoint.includes("graphql"))).toBe(false);
    expect(state.calls.filter((call: { endpoint: string }) => call.endpoint.includes("/dispatches"))).toHaveLength(3);
  });

  it("does not request auto-merge even when every proposed raise fits the size allowance", () => {
    const { result, state } = proposal();
    expect(result.status, result.stderr).toBe(0);
    expect(state.calls.some((call: { endpoint: string }) => call.endpoint.includes("graphql"))).toBe(false);
  });

  it("does not dispatch CI or arm the proposal when applying its hold fails", () => {
    const { result, state } = proposal({ labelFailure: true });
    expect(result.status).not.toBe(0);
    expect(state.calls.some((call: { endpoint: string }) => /dispatches|graphql/.test(call.endpoint))).toBe(false);
  });

  it.each([
    { number: 3, head: { ref: `${BRANCH_PREFIX}${mainSha.slice(0, 7)}` }, auto_merge: { enabled: true }, labels: [] },
    { number: 4, head: { ref: `${BRANCH_PREFIX}older` }, labels: [{ name: "hold" }] },
    { number: 5, head: { ref: `${BRANCH_PREFIX}older` }, auto_merge: { enabled: true }, labels: [] },
  ])("leaves existing owned, held or armed PR $number unchanged", (existing) => {
    const { result, state } = proposal({ open: [existing] });
    expect(result.status, result.stderr).toBe(0);
    expect(state.open).toEqual([existing]);
    expect(state.proposal).toBeUndefined();
    expect(
      state.calls.every(
        (call: { method: string; endpoint: string }) =>
          call.method === "GET" || (call.method === "git" && call.endpoint === "rev-parse"),
      ),
    ).toBe(true);
  });

  it.each([
    { number: 3, head: { ref: `${BRANCH_PREFIX}${mainSha.slice(0, 7)}` }, auto_merge: null, labels: [] },
    { number: 4, head: { ref: `${BRANCH_PREFIX}older` }, labels: [{ name: "hold" }] },
    { number: 5, head: { ref: `${BRANCH_PREFIX}older` }, auto_merge: { enabled: true }, labels: [] },
  ])("finds protected or existing proposal $number beyond the first page before mutating anything", (existing) => {
    const open = [
      ...Array.from({ length: 100 }, (_, index) => ({ number: 1000 + index, head: { ref: `ordinary-${index}` } })),
      existing,
    ];
    const { result, state } = proposal({ open });
    expect(result.status, result.stderr).toBe(0);
    expect(state.open).toEqual(open);
    expect(state.proposal).toBeUndefined();
    expect(
      state.calls
        .filter((call: { method: string }) => call.method === "GET")
        .map((call: { endpoint: string }) => call.endpoint),
    ).toEqual(["/pulls?state=open&base=main&per_page=100&page=1", "/pulls?state=open&base=main&per_page=100&page=2"]);
    expect(
      state.calls.every(
        (call: { method: string; endpoint: string }) =>
          call.method === "GET" || (call.method === "git" && call.endpoint === "rev-parse"),
      ),
    ).toBe(true);
  });

  it("keeps an over-allowance proposal held and explicitly leaves the decision to the owner", () => {
    const { result, state } = proposal({ measured: 580 });
    expect(result.status, result.stderr).toBe(0);
    expect(state.proposal.labels).toEqual(["hold"]);
    expect(state.proposal.body).toMatch(/over 5 KB|above 5 KB/);
    expect(state.calls.some((call: { endpoint: string }) => call.endpoint.includes("graphql"))).toBe(false);
  });

  it("writes a one-paragraph history entry naming the PR and each raise", () => {
    const text = historyEntry({
      date: "2026-11-04",
      pr: 1410,
      raises: [{ route: "/b", from: 571.7, to: 573.8, kb: 572.7 }],
      sha: "cdbd78ff0000",
    });
    expect(text).toMatch(/^2026-11-04, PR #1410 \(budget heal bot\)\. Main cdbd78f /);
    expect(text).toContain("`/b` 571.7 to 573.8 KB (main measured 572.7 KB)");
    expect(text).toMatch(/held.*diagnosis.*trim/i);
    expect(perthDate(new Date("2026-11-04T17:00:00Z"))).toBe("2026-11-05");
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
});

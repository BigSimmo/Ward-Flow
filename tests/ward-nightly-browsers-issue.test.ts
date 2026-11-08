import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { removePathSync } from "../scripts/retryable-fs.mjs";

import { ISSUE_LABEL, ISSUE_TITLE, issueBody } from "../scripts/ward-ci-public/nightly-browsers-issue.mjs";

const mainSha = "d".repeat(40);
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) removePathSync(directory, { recursive: true, force: true });
});

// The real CLI runs with every HTTP call intercepted and child processes refused before its ESM
// imports load. Unknown calls throw; this harness cannot contact GitHub.
const preload = `
const fs = require('node:fs');
const stateFile = process.env.NIGHTLY_ISSUE_TEST_STATE;
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
    if (body.labels && state.labelMissing) {
      save(state);
      return { ok: false, status: 422, json: async () => ({}), text: async () => 'synthetic missing label' };
    }
    state.created = { number: 88, ...body };
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
type Call = { method: string; endpoint: string; body?: { body?: string } };
function report({ issues = [], labelMissing = false }: { issues?: SyntheticIssue[]; labelMissing?: boolean } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), "ward-nightly-issue-"));
  directories.push(directory);
  const stateFile = path.join(directory, "state.json");
  writeFileSync(stateFile, JSON.stringify({ calls: [], issues, labelMissing }));
  const hook = path.join(directory, "preload.cjs");
  writeFileSync(hook, preload);
  const result = spawnSync(
    process.execPath,
    ["--require", hook, path.resolve("scripts/ward-ci-public/nightly-browsers-issue.mjs")],
    {
      cwd: directory,
      encoding: "utf8",
      timeout: 10_000,
      env: {
        ...process.env,
        NIGHTLY_ISSUE_TEST_STATE: stateFile,
        GITHUB_TOKEN: "synthetic-offline-only",
        GITHUB_REPOSITORY: "BigSimmo/Ward-Flow",
        WARD_RUN_SHA: mainSha,
        WARD_RUN_URL: "https://example.invalid/run/7",
      },
    },
  );
  return { result, state: JSON.parse(readFileSync(stateFile, "utf8")) };
}

describe("nightly browsers failure issue: body", () => {
  it("names the commit, the artifact and the run, with no blank-line runs", () => {
    const body = issueBody({ sha: "abcdef1234", runUrl: "https://example.invalid/run/7" });
    expect(body).toMatch(/^The scheduled Ward Flow nightly browsers run failed on main abcdef1\./);
    expect(body).toContain("ward-nightly-browser-failures-");
    expect(body).toContain("update_baselines");
    expect(body).toContain("Latest failing run: https://example.invalid/run/7");
    expect(body).not.toMatch(/\n\n\n/);
    expect(issueBody({ sha: "abcdef1234" })).not.toMatch(/\n$/);
  });

  it("only touches issues, never a branch, a pull request or a file", () => {
    const code = readFileSync(new URL("../scripts/ward-ci-public/nightly-browsers-issue.mjs", import.meta.url), "utf8");
    expect(code).not.toMatch(/writeFileSync|child_process|\/pulls|\/git\/|dispatches|enablePullRequestAutoMerge/);
  });
});

describe("nightly browsers failure issue: the real script against a synthetic GitHub", () => {
  it("opens one labelled issue when none is open", () => {
    const { result, state } = report();
    expect(result.status, result.stderr).toBe(0);
    expect(state.created.title).toBe(ISSUE_TITLE);
    expect(state.created.labels).toEqual([ISSUE_LABEL]);
    expect(state.created.body).toContain(mainSha.slice(0, 7));
    expect(state.calls.every((call: Call) => call.endpoint.startsWith("/issues"))).toBe(true);
  });

  it("opens the issue without the label when the label does not exist", () => {
    const { result, state } = report({ labelMissing: true });
    expect(result.status, result.stderr).toBe(0);
    expect(state.created.title).toBe(ISSUE_TITLE);
    expect(state.created.labels).toBeUndefined();
  });

  it("refreshes the open issue found past the first page and comments, without opening another", () => {
    const issues = [
      ...Array.from({ length: 100 }, (_, index) => ({ number: 1000 + index, title: `Other ${index}` })),
      { number: 9, title: ISSUE_TITLE, body: "old" },
    ];
    const { result, state } = report({ issues });
    expect(result.status, result.stderr).toBe(0);
    expect(state.created).toBeUndefined();
    expect(state.calls.filter((call: Call) => call.method === "PATCH").map((call: Call) => call.endpoint)).toEqual([
      "/issues/9",
    ]);
    expect(state.issues[100].body).toContain("https://example.invalid/run/7");
    const comments = state.calls.filter((call: Call) => call.endpoint === "/issues/9/comments");
    expect(comments).toHaveLength(1);
    expect(comments[0].body.body).toContain(mainSha.slice(0, 7));
  });

  it("ignores a pull request that shares the title", () => {
    const { result, state } = report({ issues: [{ number: 5, title: ISSUE_TITLE, pull_request: {} }] });
    expect(result.status, result.stderr).toBe(0);
    expect(state.created.number).toBe(88);
  });
});

describe("nightly browsers workflow reports a failed scheduled run", () => {
  const yml = readFileSync(new URL("../.github/workflows/ward-flow-nightly-browsers.yml", import.meta.url), "utf8");

  it("keeps the workflow read-only and gives the job issues: write and nothing else", () => {
    const top = yml.match(/^permissions:\n((?: {2}.+\n)+)/m)?.[1] ?? "";
    expect(top).toBe("  contents: read\n");
    const job = yml.match(/^ {4}permissions:\n((?: {6}.+\n)+)/m)?.[1] ?? "";
    const granted = [...job.matchAll(/^ {6}([a-z-]+): (\w+)/gm)].map((match) => `${match[1]}: ${match[2]}`);
    expect(granted).toEqual(["contents: read", "issues: write"]);
  });

  it("runs the issue step last, only when a scheduled run failed", () => {
    const steps = yml.split(/\n {6}- /).slice(1);
    const last = steps.at(-1) ?? "";
    expect(last).toMatch(/^name: Open or refresh the nightly failure issue\n/);
    expect(last).toContain("if: ${{ failure() && github.event_name == 'schedule' }}");
    expect(last).toContain("run: node scripts/ward-ci-public/nightly-browsers-issue.mjs");
    expect(last).not.toMatch(/secrets\./);
  });

  it("pins every action to a full commit SHA", () => {
    for (const [, ref] of yml.matchAll(/uses: [^@\s]+@(\S+)/g)) expect(ref).toMatch(/^[0-9a-f]{40}$/);
  });
});

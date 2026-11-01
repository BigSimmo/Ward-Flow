import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const previous = "a".repeat(40);
const target = "b".repeat(40);
const newer = "c".repeat(40);
type Release = { id: number; tag_name: string; target_commitish: string; draft: boolean; body: string };
type State = {
  current: string;
  target: string;
  records: Release[];
  tags: Record<string, string>;
  calls: string[];
  createFailures: number;
  updateFailures: number;
  publishFailures: number;
  lostUpdateAck: number;
  lostPublishAck: number;
  listFailures: number;
  compare: string;
  tagLookupFailures: number;
};
const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

// Every GitHub request is intercepted by this executable; an unknown call fails instead of
// reaching a provider. The real workflow shell, jq, files and failure propagation still execute.
const github = `#!/usr/bin/env node
const fs = require('node:fs');
const path = process.env.RELEASE_TEST_STATE;
const state = JSON.parse(fs.readFileSync(path, 'utf8'));
const args = process.argv.slice(2);
const endpoint = args.find(value => value.startsWith('repos/')) || '';
const fields = {};
for (let i = 0; i < args.length; i++) if (['-f', '-F'].includes(args[i])) {
  const at = args[++i].indexOf('=');
  const key = args[i].slice(0, at), value = args[i].slice(at + 1);
  fields[key] = value.startsWith('@') ? fs.readFileSync(value.slice(1), 'utf8') : value;
}
const method = args.includes('-X') ? args[args.indexOf('-X') + 1] : Object.keys(fields).length ? 'POST' : 'GET';
const root = 'repos/BigSimmo/Ward-Flow/';
state.calls.push(method + ' ' + endpoint);
const save = () => fs.writeFileSync(path, JSON.stringify(state));
function finish(value) { save(); if (value !== undefined) console.log(typeof value === 'string' ? value : JSON.stringify(value)); }
function fail(message) { save(); console.error(message); process.exit(1); }
function inject(key) { if (state[key] > 0) { state[key]--; fail('synthetic ' + key); } }
if (!endpoint.startsWith(root)) fail('Unexpected repository or command');
const route = endpoint.slice(root.length);
if (route.startsWith('actions/workflows/')) finish(state.target);
else if (route === 'git/ref/heads/live') finish(state.current);
else if (route.startsWith('compare/')) finish(args.includes('.status') ? state.compare : 'Merge pull request #42');
else if (route === 'pulls/42') finish('fix: Synthetic release entry');
else if (route.startsWith('contents/')) finish('[]');
else if (route.startsWith('git/ref/tags/')) {
  inject('tagLookupFailures');
  const sha = state.tags[route.slice('git/ref/tags/'.length)];
  if (!sha) fail('gh: Not Found (HTTP 404)');
  finish(sha);
} else if (route.startsWith('commits/')) {
  const sha = state.tags[route.slice('commits/'.length)];
  if (!sha) fail('gh: No commit found for SHA (HTTP 422)');
  finish(sha);
} else if (route.startsWith('releases?') && method === 'GET') {
  inject('listFailures'); finish(args.includes('--slurp') ? [state.records] : state.records);
} else if (route === 'git/refs/heads/live' && method === 'PATCH') {
  if (fields.force !== 'false') fail('Ref rewrite was requested');
  inject('updateFailures'); state.current = fields.sha; inject('lostUpdateAck'); finish({});
} else if (route === 'releases' && method === 'POST') {
  inject('createFailures');
  const record = { id: Math.max(0, ...state.records.map(item => item.id)) + 1,
    tag_name: fields.tag_name, target_commitish: fields.target_commitish,
    draft: fields.draft === 'true', body: fields.body, name: fields.name };
  state.records.push(record);
  if (!record.draft) state.tags[record.tag_name] = record.target_commitish;
  finish(record);
} else if (/^releases\\/\\d+$/.test(route) && method === 'PATCH') {
  const record = state.records.find(item => item.id === Number(route.split('/')[1]));
  if (!record || fields.draft !== 'false') fail('Unexpected release publication');
  inject('publishFailures'); record.draft = false;
  state.tags[record.tag_name] = record.target_commitish;
  inject('lostPublishAck'); finish(record);
} else fail('Unexpected mock API route: ' + method + ' ' + route);
`;

function harness(overrides: Partial<State> = {}) {
  const directory = mkdtempSync(join(tmpdir(), "ward-release-retry-"));
  directories.push(directory);
  const statePath = join(directory, "state.json");
  const initial: State = {
    current: previous,
    target,
    records: [{ id: 1, tag_name: "live-previous", target_commitish: previous, draft: false, body: "Previous notes" }],
    tags: { "live-previous": previous },
    calls: [],
    createFailures: 0,
    updateFailures: 0,
    publishFailures: 0,
    lostUpdateAck: 0,
    lostPublishAck: 0,
    listFailures: 0,
    compare: "ahead",
    tagLookupFailures: 0,
    ...overrides,
  };
  writeFileSync(statePath, JSON.stringify(initial));
  writeFileSync(join(directory, "gh"), github, { mode: 0o700 });
  const workflow = readFileSync(".github/workflows/daily-release.yml", "utf8");
  const script = workflow.split("        run: |\n")[1];
  if (!script) throw new Error("Release run block not found");
  writeFileSync(
    join(directory, "release.sh"),
    script
      .split("\n")
      .map((line) => line.slice(10))
      .join("\n"),
  );
  writeFileSync(join(directory, "summary.md"), "");
  const read = (): State => JSON.parse(readFileSync(statePath, "utf8"));
  return {
    read,
    change(update: Partial<State>) {
      writeFileSync(statePath, JSON.stringify({ ...read(), ...update }));
    },
    run(repository = "BigSimmo/Ward-Flow") {
      return spawnSync("bash", [join(directory, "release.sh")], {
        cwd: directory,
        encoding: "utf8",
        timeout: 10_000,
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          REPOSITORY: repository,
          RELEASE_TEST_STATE: statePath,
          GITHUB_STEP_SUMMARY: join(directory, "summary.md"),
          GH_TOKEN: "synthetic-offline-only",
        },
      });
    },
  };
}

describe("daily release record and live-ref recovery", () => {
  it("does not advance live when preparing its durable record fails", () => {
    const h = harness({ createFailures: 1 });
    expect(h.run().status).not.toBe(0);
    expect(h.read().current).toBe(previous);
    expect(h.run().status).toBe(0);
    expect(h.read().current).toBe(target);
    expect(h.read().records.filter((record) => record.target_commitish === target && !record.draft)).toHaveLength(1);
  });

  it("retains an unpublished draft when the fast-forward fails and reuses it on retry", () => {
    const h = harness({ updateFailures: 1 });
    expect(h.run().status).not.toBe(0);
    const draft = h.read().records.find((record) => record.target_commitish === target);
    expect(draft?.draft).toBe(true);
    expect(h.read().current).toBe(previous);
    expect(h.run().status).toBe(0);
    expect(h.read().records.find((record) => record.id === draft?.id)?.draft).toBe(false);
  });

  it.each(["publishFailures", "lostUpdateAck", "lostPublishAck"] as const)(
    "repairs %s without replacing notes or creating another record",
    (failure) => {
      const h = harness({ [failure]: 1 });
      expect(h.run().status).not.toBe(0);
      expect(h.read().current).toBe(target);
      const saved = h.read().records.find((record) => record.target_commitish === target)!;
      expect(saved).toBeDefined();
      expect(h.run().status).toBe(0);
      const records = h.read().records.filter((record) => record.target_commitish === target);
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({ id: saved.id, body: saved.body, draft: false });
      const moves = h.read().calls.filter((call) => call === "PATCH repos/BigSimmo/Ward-Flow/git/refs/heads/live");
      expect(moves).toHaveLength(1);
    },
  );

  it("finishes the current live record before considering a newer CI target", () => {
    const h = harness({ publishFailures: 1 });
    expect(h.run().status).not.toBe(0);
    h.change({ target: newer, calls: [] });
    expect(h.run().status).toBe(0);
    const calls = h.read().calls;
    const publication = calls.indexOf("PATCH repos/BigSimmo/Ward-Flow/releases/2");
    const selection = calls.findIndex((call) => call.includes("actions/workflows/"));
    expect(publication).toBeGreaterThanOrEqual(0);
    expect(publication).toBeLessThan(selection);
    expect(h.read().records.filter((record) => !record.draft)).toHaveLength(3);
  });

  it("fails visibly for a legacy missing record instead of claiming nothing needs releasing", () => {
    const h = harness({ current: target });
    const result = h.run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/record|notes|recover/i);
    expect(h.read().records).toHaveLength(1);
  });

  it("does not treat an API listing failure as an absent record", () => {
    const h = harness({ listFailures: 1 });
    expect(h.run().status).not.toBe(0);
    expect(h.read().current).toBe(previous);
    expect(h.read().records).toHaveLength(1);
  });

  it.each(["wrong-target", "wrong-tag"])("validates a retained %s before moving live", (kind) => {
    const h = harness();
    const state = h.read();
    h.change({
      records: [
        ...state.records,
        {
          id: 2,
          tag_name: `live-${target}`,
          target_commitish: kind === "wrong-target" ? previous : target,
          draft: true,
          body: `Saved notes\n<!-- ward-flow-release-base: ${previous} -->`,
        },
      ],
      tags: kind === "wrong-tag" ? { ...state.tags, [`live-${target}`]: previous } : state.tags,
    });
    expect(h.run().status).not.toBe(0);
    expect(h.read().current).toBe(previous);
    expect(h.read().calls).not.toContain("PATCH repos/BigSimmo/Ward-Flow/git/refs/heads/live");
  });

  it("fails closed on a tag lookup error instead of treating it as a new tag", () => {
    const h = harness({ tagLookupFailures: 1 });
    expect(h.run().status).not.toBe(0);
    expect(h.read().current).toBe(previous);
    expect(h.read().records).toHaveLength(1);
  });

  it("refuses a tag pointing elsewhere and a target that is not ahead", () => {
    const h = harness({ tags: { "live-previous": previous, [`live-${target}`]: previous } });
    expect(h.run().status).not.toBe(0);
    expect(h.read().current).toBe(previous);
    h.change({ tags: { "live-previous": previous }, compare: "behind" });
    expect(h.run().status).not.toBe(0);
    expect(h.read().current).toBe(previous);
  });

  it("keeps a completed existing release unchanged and refuses another repository", () => {
    const h = harness({ current: previous, target: previous });
    expect(h.run().status).toBe(0);
    expect(h.read().records).toHaveLength(1);
    h.change({ calls: [] });
    expect(h.run("BigSimmo/Other").status).not.toBe(0);
    expect(h.read().calls).toEqual([]);
  });
});

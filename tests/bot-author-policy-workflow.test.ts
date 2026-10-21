import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/bot-author-policy.yml", import.meta.url), "utf8");
const wardCi = readFileSync(new URL("../.github/workflows/ward-flow.yml", import.meta.url), "utf8");
const code = workflow
  .split("\n")
  .filter((line) => !line.trim().startsWith("#"))
  .join("\n");

describe("bot-author policy workflow (pull_request_target safety)", () => {
  it("runs on pull_request_target with minimal permissions", () => {
    expect(code).toMatch(/^on:\n {2}pull_request_target:/m);
    expect(code).toMatch(/^permissions:\n {2}contents: read\n {2}pull-requests: read\n\n/m);
    expect(code).not.toMatch(/: write\b|write-all/);
  });

  it("checks out only the base commit and never PR code", () => {
    const refs = [...code.matchAll(/^\s+ref:\s*(.+)$/gm)].map((match) => match[1].trim());
    expect(refs).toEqual(["${{ github.event.pull_request.base.sha || github.event.merge_group.base_ref }}"]);
    expect(code).not.toMatch(/pull_request\.head|github\.head_ref|refs\/pull\/|merge_commit_sha/);
    expect(code).toMatch(/persist-credentials: false/);
    expect(code).not.toMatch(/npm (?:ci|install)|npx |pnpm|yarn/);
  });

  it("reports the same required check on merge_group for every PR in the group", () => {
    expect(code).toMatch(/^ {2}merge_group:\n {4}types: \[checks_requested\]$/m);
    expect(code).toMatch(/^ {4}name: Ward Flow bot-author policy$/m);
    expect(code).toMatch(/Merge pull request #/);
    expect(code).toMatch(/failing closed/);
  });

  it("runs on pull requests into main and release branches", () => {
    expect(code).toMatch(/^ {2}pull_request_target:\n {4}types: .*\n {4}branches: \[main, "release\/\*\*"\]$/m);
  });

  it("uses no secrets beyond GITHUB_TOKEN", () => {
    expect(code).not.toMatch(/secrets\./);
  });

  it("is no longer run inside the PR-code CI workflow", () => {
    expect(wardCi).not.toMatch(/bot-author-policy/);
  });
});

import { describe, expect, it } from "vitest";

import { ARTIFACT, fetchMainMeasured, validMeasurement } from "../scripts/ward-ci-public/main-measured.mjs";

const sha = "a".repeat(40);
const good = JSON.stringify({ measured: { "/ward-flow": 553 } });

function fakeGitHub(runs: object[], artifacts: Record<number, object[]>) {
  const calls: string[] = [];
  const fetchImpl = (async (url: string) => {
    calls.push(String(url));
    const path = String(url).replace("https://api.github.com/repos/BigSimmo/Ward-Flow", "");
    if (path.startsWith("/actions/workflows/ward-flow.yml/runs?")) return Response.json({ workflow_runs: runs });
    const match = path.match(/^\/actions\/runs\/(\d+)\/artifacts/);
    if (match) return Response.json({ artifacts: artifacts[Number(match[1])] ?? [] });
    if (String(url).startsWith("https://synthetic.invalid/zip/")) return new Response("zip");
    return new Response("nope", { status: 404 });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const mainRun = (id: number, extra = {}) => ({ id, head_sha: sha, event: "push", head_branch: "main", ...extra });
const artifact = (id: number, extra = {}) => ({
  id,
  name: ARTIFACT,
  expired: false,
  archive_download_url: `https://synthetic.invalid/zip/${id}`,
  ...extra,
});

describe("main's saved phone measurements spare a second main build", () => {
  it("returns main's own measurement for the exact commit", async () => {
    const { fetchImpl } = fakeGitHub([mainRun(7)], { 7: [artifact(70)] });
    const text = await fetchMainMeasured({ sha, repo: "BigSimmo/Ward-Flow", token: "t", fetchImpl, unzip: () => good });
    expect(text).toBe(good);
  });

  it("skips runs for another commit, branch or event, and expired artifacts", async () => {
    const { fetchImpl, calls } = fakeGitHub(
      [
        mainRun(1, { head_sha: "b".repeat(40) }),
        mainRun(2, { event: "pull_request" }),
        mainRun(3, { head_branch: "x" }),
        mainRun(4),
      ],
      { 4: [artifact(40, { expired: true })] },
    );
    const text = await fetchMainMeasured({ sha, repo: "BigSimmo/Ward-Flow", token: "t", fetchImpl, unzip: () => good });
    expect(text).toBeUndefined();
    expect(calls.filter((url) => url.includes("/artifacts"))).toHaveLength(1);
  });

  it("refuses a malformed measurement or an invalid commit", async () => {
    const { fetchImpl } = fakeGitHub([mainRun(7)], { 7: [artifact(70)] });
    expect(
      await fetchMainMeasured({ sha, repo: "BigSimmo/Ward-Flow", token: "t", fetchImpl, unzip: () => "{}" }),
    ).toBeUndefined();
    expect(await fetchMainMeasured({ sha: "main", repo: "BigSimmo/Ward-Flow", token: "t", fetchImpl })).toBeUndefined();
    expect(validMeasurement(JSON.stringify({ measured: { "/a": "big" } }))).toBe(false);
    expect(validMeasurement(good)).toBe(true);
  });
});

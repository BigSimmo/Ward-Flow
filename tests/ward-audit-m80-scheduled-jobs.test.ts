// Audit M80 (scheduled jobs run safely late or twice) and M72 (uptime and monitor coverage),
// 10 November 2026. Runs the real shell steps of the scheduled workflows with `gh`, `sleep` and the
// hosted backend replaced by local stand-ins, so a doubled, late or overlapping run and each
// injected monitor failure is checked without any provider call. The daily release's own
// duplicate-run test lives with its harness in tests/ward-daily-release-retry.test.ts; the nightly
// browser issue's in tests/ward-nightly-browsers-issue.test.ts.
import { spawn } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

// Loaded by URL so the root typecheck does not pull the backend's own (looser) JS checking in.
type ReceiptPool = { query(text: string, values?: number[]): Promise<unknown> };
const { pruneReceipts, pruneReceiptsAsPruner } = (await import(
  new URL("../backend/ward-flow/prune-receipts.mjs", import.meta.url).href
)) as {
  pruneReceipts: (pool: ReceiptPool) => Promise<number>;
  pruneReceiptsAsPruner: (pool: ReceiptPool) => Promise<number>;
};

const root = path.resolve(import.meta.dirname, "..");
const workflowDir = path.join(root, ".github/workflows");
const read = (name: string) => readFileSync(path.join(workflowDir, name), "utf8").replace(/\r\n/gu, "\n");

/** The `run: |` body of the named step, with its indent removed. */
function stepScript(workflow: string, name: string): string {
  const lines = workflow.split("\n");
  const start = lines.findIndex((line) => line === `      - name: ${name}`);
  if (start < 0) throw new Error(`step "${name}" not found`);
  const run = lines.findIndex((line, index) => index > start && line === "        run: |");
  const body: string[] = [];
  for (const line of lines.slice(run + 1)) {
    if (line.trim() && !line.startsWith("          ")) break;
    body.push(line.slice(10));
  }
  return body.join("\n");
}

/** Every workflow in the folder with a `schedule:` trigger. */
const scheduled = readdirSync(workflowDir)
  .filter((name) => name.endsWith(".yml"))
  .filter((name) => /^ {2}schedule:$/mu.test(read(name)));

const directories: string[] = [];
afterEach(() =>
  directories.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })),
);

/**
 * A bin folder whose `gh` logs every call, answers `issue list` with $OPEN_ISSUE and a workflow's
 * state with $WORKFLOW_STATE, and fails a call whose words match $GH_FAIL. `sleep` returns at once.
 */
function stubBin() {
  const bin = mkdtempSync(path.join(tmpdir(), "ward-m80-bin-"));
  directories.push(bin);
  writeFileSync(path.join(bin, "sleep"), "#!/bin/sh\nexit 0\n");
  writeFileSync(
    path.join(bin, "gh"),
    [
      "#!/bin/sh",
      'printf \'%s\\n\' "$*" >> "$GH_LOG"',
      'if [ -n "$GH_FAIL" ]; then case "$*" in *"$GH_FAIL"*) echo "synthetic gh failure" >&2; exit 1 ;; esac; fi',
      'if [ "$1 $2" = "issue list" ]; then printf \'%s\' "$OPEN_ISSUE"; fi',
      'case "$*" in *"--jq .state"*) printf \'%s\\n\' "${WORKFLOW_STATE:-active}" ;; esac',
      "exit 0",
    ].join("\n"),
  );
  chmodSync(path.join(bin, "sleep"), 0o755);
  chmodSync(path.join(bin, "gh"), 0o755);
  const ghLog = path.join(bin, "gh.log");
  const output = path.join(bin, "output");
  return { bin, ghLog, output };
}

type StepResult = { code: number | null; log: string; gh: string; outputs: Record<string, string> };

function outputsOf(file: string): Record<string, string> {
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
}

/** Runs a step as GitHub does (`bash -eo pipefail`), asynchronously so a local server can answer. */
async function runStep(script: string, env: Record<string, string>, cwd = root): Promise<StepResult> {
  const { bin, ghLog, output } = stubBin();
  writeFileSync(ghLog, "");
  writeFileSync(output, "");
  const child = spawn("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", script], {
    cwd,
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      GITHUB_OUTPUT: output,
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "BigSimmo/Ward-Flow",
      GITHUB_RUN_ID: "1",
      GH_REPO: "BigSimmo/Ward-Flow",
      LABEL: "backend-down",
      OWNER: "BigSimmo",
      GH_LOG: ghLog,
      ...env,
    } as Record<string, string> as NodeJS.ProcessEnv,
  });
  let log = "";
  child.stdout.on("data", (chunk) => (log += chunk));
  child.stderr.on("data", (chunk) => (log += chunk));
  const code = await new Promise<number | null>((resolve) => child.on("close", resolve));
  return { code, log, gh: readFileSync(ghLog, "utf8"), outputs: outputsOf(output) };
}

const uptime = read("backend-uptime.yml");
const HEALTH_STEP = stepScript(uptime, "Ask the backend whether it is up and can reach its database");
const RAISE_STEP = stepScript(uptime, "Raise or close the backend-down issue");

// Local stand-in for the backend's /healthz: each request takes the next planned answer.
let healthPlan: { status: number; body: unknown }[] = [];
let healthCalls = 0;
let server: Server;
let backend = "";
beforeAll(async () => {
  server = createServer((request, response) => {
    healthCalls += 1;
    const next = healthPlan.shift() ?? { status: 502, body: {} };
    response.writeHead(next.status, { "content-type": "application/json" });
    response.end(JSON.stringify(next.body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  backend = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const healthy = { status: 200, body: { service: "ward-flow-backend", database: "ok" } };
const noDatabase = { status: 200, body: { service: "ward-flow-backend", database: "unavailable" } };
const hidden = { status: 200, body: { service: "ward-flow-backend", status: "ok" } };
const broken = { status: 503, body: { error: "synthetic" } };

describe("M72: the 10-minute uptime check, each failure injected offline", () => {
  it("reports up after one healthy answer", async () => {
    healthPlan = [healthy];
    healthCalls = 0;
    const result = await runStep(HEALTH_STEP, { BACKEND_URL: backend, UPTIME_TOKEN: "synthetic-token" });
    expect(result.code).toBe(0);
    expect(result.outputs.state).toBe("up");
    expect(healthCalls).toBe(1);
  });

  it("counts a backend that fails three times as down", async () => {
    healthPlan = [broken, broken, broken];
    healthCalls = 0;
    const result = await runStep(HEALTH_STEP, { BACKEND_URL: backend, UPTIME_TOKEN: "synthetic-token" });
    expect(result.outputs.state).toBe("down");
    expect(healthCalls).toBe(3);
  });

  it("counts an unreachable backend as down, never as a hidden database", async () => {
    const result = await runStep(HEALTH_STEP, { BACKEND_URL: "http://127.0.0.1:9", UPTIME_TOKEN: "synthetic-token" });
    expect(result.outputs.state).toBe("down");
  });

  it("counts a database that stays unavailable as a database outage", async () => {
    healthPlan = [noDatabase, noDatabase, noDatabase];
    const result = await runStep(HEALTH_STEP, { BACKEND_URL: backend, UPTIME_TOKEN: "synthetic-token" });
    expect(result.outputs.state).toBe("database");
  });

  it("recovers when a later try answers", async () => {
    healthPlan = [broken, healthy];
    const result = await runStep(HEALTH_STEP, { BACKEND_URL: backend, UPTIME_TOKEN: "synthetic-token" });
    expect(result.outputs.state).toBe("up");
  });

  it("names the missing or misspelt token in a warning when the database answer is hidden (M54)", async () => {
    healthPlan = [hidden];
    const result = await runStep(HEALTH_STEP, { BACKEND_URL: backend, UPTIME_TOKEN: "" });
    expect(result.outputs.state).toBe("unknown");
    expect(result.log).toMatch(/::warning::Database not checked: WARD_FLOW_UPTIME_TOKEN is missing/u);
  });

  // Gap recorded for Josh, not fixed: a hidden database check or an unset monitor account leaves the
  // run green, so the only sign is a warning on a run nobody opens. See the M72 inventory.
  it("leaves a run with a hidden database green and silent: the visibility gap", async () => {
    const result = await runStep(RAISE_STEP, { HEALTH: "unknown", WORKSPACE: "skipped", OPEN_ISSUE: "" });
    expect(result.code).toBe(0);
    expect(result.gh).not.toMatch(/issue create/u);
  });

  it("raises one issue that @mentions the owner and fails the run when the backend is down", async () => {
    const result = await runStep(RAISE_STEP, { HEALTH: "down", WORKSPACE: "skipped", OPEN_ISSUE: "" });
    expect(result.code).toBe(1);
    expect(result.gh.match(/issue create/gu)).toHaveLength(1);
    expect(result.gh).toMatch(/@BigSimmo The hosted Ward Flow backend/u);
  });

  it("fails the run visibly when the alert issue itself cannot be created", async () => {
    const result = await runStep(RAISE_STEP, {
      HEALTH: "database",
      WORKSPACE: "skipped",
      OPEN_ISSUE: "",
      GH_FAIL: "issue create",
    });
    expect(result.code).not.toBe(0);
    expect(result.log).toContain("synthetic gh failure");
  });

  it("fails the run visibly when GitHub cannot list open issues", async () => {
    const result = await runStep(RAISE_STEP, {
      HEALTH: "down",
      WORKSPACE: "skipped",
      OPEN_ISSUE: "",
      GH_FAIL: "issue list",
    });
    expect(result.code).not.toBe(0);
    expect(result.gh).not.toMatch(/issue create/u);
  });
});

describe("M80: every scheduled job is safe late, doubled or overlapping", () => {
  it("finds the five real scheduled jobs plus the living-page reminder, CI tidy, browsers and CI nightlies, and no others", () => {
    expect(scheduled.sort()).toEqual([
      "backend-uptime.yml",
      "daily-release.yml",
      "dependency-audit.yml",
      "docs-freshness.yml",
      "prune-receipts.yml",
      "ward-flow-ci-tidy.yml",
      "ward-flow-nightly-browsers.yml",
      "ward-flow.yml",
      "workflow-keepalive.yml",
    ]);
  });

  it("queues an overlapping run behind the one running, never cancels it, for each job that writes", () => {
    for (const name of [
      "backend-uptime.yml",
      "daily-release.yml",
      "docs-freshness.yml",
      "prune-receipts.yml",
      "ward-flow-ci-tidy.yml",
      "ward-flow-nightly-browsers.yml",
      "workflow-keepalive.yml",
    ]) {
      const workflow = read(name);
      expect(workflow, name).toMatch(/^concurrency:\n {2}group: [\w-]+\n {2}cancel-in-progress: false$/mu);
    }
  });

  it("dependency audit: read-only, and a doubled run's report cannot overwrite the other's", () => {
    const workflow = read("dependency-audit.yml");
    expect(workflow).toMatch(/^permissions:\n {2}contents: read\n\n/mu);
    expect(workflow).not.toMatch(/write/u);
    expect(workflow).toContain("name: ward-dependency-audit-${{ matrix.label }}-${{ github.run_id }}");
  });

  it("uptime: a doubled run during an outage keeps one issue open instead of opening a second", async () => {
    const first = await runStep(RAISE_STEP, { HEALTH: "down", WORKSPACE: "skipped", OPEN_ISSUE: "" });
    const second = await runStep(RAISE_STEP, { HEALTH: "down", WORKSPACE: "skipped", OPEN_ISSUE: "12" });
    expect(first.gh).toMatch(/issue create/u);
    expect(second.gh).not.toMatch(/issue create/u);
    expect(second.code).toBe(1);
  });

  it("uptime: a doubled run after recovery closes the issue once and then does nothing", async () => {
    const first = await runStep(RAISE_STEP, { HEALTH: "up", WORKSPACE: "up", OPEN_ISSUE: "12" });
    const second = await runStep(RAISE_STEP, { HEALTH: "up", WORKSPACE: "up", OPEN_ISSUE: "" });
    expect(first.gh).toMatch(/issue close 12/u);
    expect(second.gh).not.toMatch(/issue (?:close|comment|create)/u);
    expect(second.code).toBe(0);
  });

  it("uptime: a late run uses no clock; it checks what is true when it runs", () => {
    expect(HEALTH_STEP).not.toMatch(/\bdate\b/u);
    expect(RAISE_STEP).not.toMatch(/\bdate\b/u);
  });

  const keepalive = stepScript(read("workflow-keepalive.yml"), "Re-enable scheduled workflows");

  it("keep-alive: a doubled run sends the same enables and succeeds both times", async () => {
    const first = await runStep(keepalive, { WORKFLOW_STATE: "active" });
    const second = await runStep(keepalive, { WORKFLOW_STATE: "active" });
    expect(first.code).toBe(0);
    expect(second.code).toBe(0);
    expect(second.gh).toBe(first.gh);
    for (const name of scheduled)
      expect(first.gh).toContain(`-X PUT repos/BigSimmo/Ward-Flow/actions/workflows/${name}/enable`);
  });

  it("keep-alive: leaves a workflow switched off by hand alone, however often it runs", async () => {
    const result = await runStep(keepalive, { WORKFLOW_STATE: "disabled_manually" });
    expect(result.code).toBe(0);
    expect(result.gh).not.toMatch(/-X PUT/u);
  });

  it("keep-alive: fails loudly when GitHub refuses the enable", async () => {
    const result = await runStep(keepalive, { WORKFLOW_STATE: "disabled_inactivity", GH_FAIL: "-X PUT" });
    expect(result.code).not.toBe(0);
  });

  it("receipt clean-up: a doubled run removes nothing more and does not fail", async () => {
    // Stand-in for ward_flow_ops.prune_receipts: removes at most `size` of the remaining old rows.
    let old = 7_200;
    const pool = {
      query: async (_sql: string, [size]: number[]) => {
        const removed = Math.min(old, size);
        old -= removed;
        return { rows: [{ removed }] };
      },
    };
    expect(await pruneReceiptsAsPruner(pool)).toBe(7_200);
    expect(await pruneReceiptsAsPruner(pool)).toBe(0);
  });

  it("receipt clean-up: the cutoff is the database's own clock, so a late run removes the same rows", () => {
    const sql = readFileSync(path.join(root, "backend/ward-flow/infra/supabase-prune-role.sql"), "utf8");
    expect(sql).toMatch(/committed_at < now\(\) - interval '7 days'/u);
    const statements: string[] = [];
    const pool = {
      query: async (text: string) => {
        statements.push(text);
        return text.startsWith("SELECT id") ? { rows: [{ id: "w" }] } : { rowCount: 0, rows: [] };
      },
    };
    return pruneReceipts(pool).then((removed: number) => {
      expect(removed).toBe(0);
      expect(statements[1]).toContain("committed_at < now() - make_interval(days => $2)");
    });
  });

  it("receipt clean-up: a scheduled run without its secret fails, a manual run only notes it", async () => {
    const check = stepScript(read("prune-receipts.yml"), "Check the connection secret is set");
    const onSchedule = await runStep(check, { WARD_SUPABASE_PRUNE_DATABASE_URL: "", GITHUB_EVENT_NAME: "schedule" });
    expect(onSchedule.code).toBe(1);
    expect(onSchedule.log).toMatch(/::error::Receipt clean-up did not run/u);
    const byHand = await runStep(check, {
      WARD_SUPABASE_PRUNE_DATABASE_URL: "",
      GITHUB_EVENT_NAME: "workflow_dispatch",
    });
    expect(byHand.code).toBe(0);
    expect(byHand.outputs.ready).toBe("false");
  });

  it("daily release: a late run reads the clock only to name the release, never to decide it", () => {
    const release = read("daily-release.yml");
    const dates = release.match(/^.*\bdate\b.*$/gmu) ?? [];
    expect(dates.filter((line) => !line.trim().startsWith("#"))).toEqual([
      '            stamp="$(TZ=Australia/Perth date +%Y-%m-%d-%H%M)"',
    ]);
  });
});

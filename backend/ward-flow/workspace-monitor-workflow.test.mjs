// @ts-check
// Signed-in workspace monitor (bird's eye review, 5 November 2026). Runs the real shell steps of
// `.github/workflows/backend-uptime.yml` against a local stand-in for Supabase sign-in and the
// backend, with `gh` and `sleep` replaced, so each outcome is checked without any provider call.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

const workflow = readFileSync(new URL("../../.github/workflows/backend-uptime.yml", import.meta.url), "utf8");

/** The `run: |` body of the named step, with its indent removed. */
function stepScript(/** @type {string} */ name) {
  const lines = workflow.split("\n");
  const start = lines.findIndex((line) => line === `      - name: ${name}`);
  assert.ok(start >= 0, `step "${name}" is in the workflow`);
  const run = lines.findIndex((line, index) => index > start && line === "        run: |");
  const body = [];
  for (const line of lines.slice(run + 1)) {
    if (line.trim() && !line.startsWith("          ")) break;
    body.push(line.slice(10));
  }
  return body.join("\n");
}

const PASSWORD = "synthetic-monitor-password";
const TOKEN = "synthetic-access-token";
/** @type {{ signIn: number[], workspace: { status: number, body: unknown }[], calls: string[] }} */
let plan = { signIn: [], workspace: [], calls: [] };
let base = "";
const server = createServer((request, response) => {
  const send = (/** @type {number} */ status, /** @type {unknown} */ body) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  };
  let raw = "";
  request.on("data", (chunk) => (raw += chunk));
  request.on("end", () => {
    const url = request.url ?? "";
    plan.calls.push(`${request.method} ${url.split("?")[0]}`);
    if (url.startsWith("/auth/v1/token")) {
      assert.equal(request.headers.apikey, "sb_publishable_synthetic");
      assert.deepEqual(JSON.parse(raw), { email: "monitor@example.test", password: PASSWORD });
      const status = plan.signIn.shift() ?? 200;
      return send(status, status === 200 ? { access_token: TOKEN } : { error_code: "invalid_credentials" });
    }
    if (url.startsWith("/auth/v1/logout")) return send(204, {});
    if (url === "/v1/workspace") {
      assert.equal(request.headers.authorization, `Bearer ${TOKEN}`);
      const next = plan.workspace.shift() ?? { status: 500, body: {} };
      return send(next.status, next.body);
    }
    send(404, {});
  });
});

let bin = "";
before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(undefined)));
  const address = /** @type {import("node:net").AddressInfo} */ (server.address());
  base = `http://127.0.0.1:${address.port}`;
  bin = mkdtempSync(path.join(tmpdir(), "ward-monitor-bin-"));
  writeFileSync(path.join(bin, "sleep"), "#!/bin/sh\nexit 0\n");
  // `gh issue list` answers with OPEN_ISSUE; every call is logged for the assertions.
  writeFileSync(
    path.join(bin, "gh"),
    '#!/bin/sh\nprintf \'%s\\n\' "$*" >> "$GH_LOG"\nif [ "$1 $2" = "issue list" ]; then printf \'%s\' "$OPEN_ISSUE"; fi\n',
  );
  chmodSync(path.join(bin, "sleep"), 0o755);
  chmodSync(path.join(bin, "gh"), 0o755);
});
after(() => {
  server.close();
  rmSync(bin, { recursive: true, force: true });
});

/** Runs a step as GitHub does (`bash -eo pipefail`), returning its exit code, log and outputs. */
async function runStep(/** @type {string} */ name, /** @type {Record<string, string>} */ env) {
  const dir = mkdtempSync(path.join(tmpdir(), "ward-monitor-run-"));
  const output = path.join(dir, "output");
  const ghLog = path.join(dir, "gh.log");
  writeFileSync(output, "");
  writeFileSync(ghLog, "");
  const child = spawn("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", stepScript(name)], {
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      GITHUB_OUTPUT: output,
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "BigSimmo/Ward-Flow",
      GITHUB_RUN_ID: "1",
      BACKEND_URL: base,
      SUPABASE_URL: base,
      LABEL: "backend-down",
      OWNER: "BigSimmo",
      GH_LOG: ghLog,
      ...env,
    },
  });
  let log = "";
  child.stdout.on("data", (chunk) => (log += chunk));
  child.stderr.on("data", (chunk) => (log += chunk));
  const code = await new Promise((resolve) => child.on("close", resolve));
  const outputs = Object.fromEntries(
    readFileSync(output, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
  const gh = readFileSync(ghLog, "utf8");
  rmSync(dir, { recursive: true, force: true });
  return { code, log, outputs, gh };
}

const WORKSPACE_STEP = "Sign in as the monitor account and load the shared workspace";
const secrets = {
  MONITOR_EMAIL: "monitor@example.test",
  MONITOR_PASSWORD: PASSWORD,
  PUBLISHABLE_KEY: "sb_publishable_synthetic",
};
const loaded = { status: 200, body: { data: { source: "synthetic" }, snapshot: { revision: 1 } } };

test("the monitor signs in, loads the workspace, signs out and prints no secret", async () => {
  plan = { signIn: [], workspace: [loaded], calls: [] };
  const result = await runStep(WORKSPACE_STEP, secrets);
  assert.equal(result.code, 0);
  assert.equal(result.outputs.state, "up");
  assert.deepEqual(plan.calls, ["POST /auth/v1/token", "GET /v1/workspace", "POST /auth/v1/logout"]);
  // GitHub hides `::add-mask::` lines and masks the token everywhere after it.
  assert.match(result.log, new RegExp(`^::add-mask::${TOKEN}$`, "m"));
  const shown = result.log.replace(/^::add-mask::.*$/gm, "");
  assert.doesNotMatch(shown, new RegExp(`${PASSWORD}|${TOKEN}`));
});

test("missing monitor secrets skip the check so /healthz alone decides", async () => {
  plan = { signIn: [], workspace: [], calls: [] };
  const result = await runStep(WORKSPACE_STEP, { ...secrets, MONITOR_PASSWORD: "" });
  assert.equal(result.outputs.state, "skipped");
  assert.deepEqual(plan.calls, []);
});

test("a workspace that answers 503 three times is an outage (the 4 November failure)", async () => {
  const failing = { status: 503, body: { error: "Database unavailable" } };
  plan = { signIn: [], workspace: [failing, failing, failing], calls: [] };
  const result = await runStep(WORKSPACE_STEP, secrets);
  assert.equal(result.code, 0);
  assert.equal(result.outputs.state, "workspace");
  assert.equal(result.outputs.detail, "HTTP 503");
  assert.equal(plan.calls.filter((call) => call === "GET /v1/workspace").length, 3);
  assert.ok(plan.calls.includes("POST /auth/v1/logout"));
});

test("a 200 without the synthetic workspace counts as not loaded", async () => {
  const empty = { status: 200, body: { data: { source: "synthetic" } } };
  plan = { signIn: [], workspace: [empty, empty, empty], calls: [] };
  assert.equal((await runStep(WORKSPACE_STEP, secrets)).outputs.state, "workspace");
});

test("a monitor account with no role or a second step warns, never alarms", async () => {
  for (const code of ["no-role", "second-step-required"]) {
    plan = { signIn: [], workspace: [{ status: code === "no-role" ? 403 : 401, body: { code } }], calls: [] };
    const result = await runStep(WORKSPACE_STEP, secrets);
    assert.equal(result.outputs.state, "unknown");
    assert.match(result.log, /::warning::Signed-in workspace not checked/);
  }
});

test("a refused sign-in warns; a sign-in that does not answer is an outage", async () => {
  plan = { signIn: [400], workspace: [], calls: [] };
  const refused = await runStep(WORKSPACE_STEP, secrets);
  assert.equal(refused.outputs.state, "unknown");
  assert.deepEqual(plan.calls, ["POST /auth/v1/token"]);

  plan = { signIn: [500, 502, 503], workspace: [], calls: [] };
  const down = await runStep(WORKSPACE_STEP, secrets);
  assert.equal(down.outputs.state, "signin");
  assert.equal(down.outputs.detail, "HTTP 503");
  assert.ok(!plan.calls.includes("GET /v1/workspace"));
});

const RAISE_STEP = "Raise or close the backend-down issue";

test("a workspace failure raises its own issue even when /healthz is up", async () => {
  const result = await runStep(RAISE_STEP, {
    HEALTH: "up",
    WORKSPACE: "workspace",
    WORKSPACE_DETAIL: "HTTP 503",
    OPEN_ISSUE: "",
  });
  assert.equal(result.code, 1);
  assert.match(result.gh, /issue create --label backend-down --title Signed-in staff cannot load the shared workspace/);
  assert.match(result.gh, /last answer HTTP 503/);
});

test("the issue closes only when the health check and the workspace both answer", async () => {
  const open = { HEALTH: "up", OPEN_ISSUE: "12", WORKSPACE_DETAIL: "" };
  const closed = await runStep(RAISE_STEP, { ...open, WORKSPACE: "up" });
  assert.equal(closed.code, 0);
  assert.match(closed.gh, /issue close 12/);

  const notSetUp = await runStep(RAISE_STEP, { ...open, WORKSPACE: "skipped" });
  assert.match(notSetUp.gh, /issue close 12/);

  const unknown = await runStep(RAISE_STEP, { ...open, WORKSPACE: "unknown" });
  assert.equal(unknown.code, 0);
  assert.doesNotMatch(unknown.gh, /issue (close|create|comment)/);

  const healthDown = await runStep(RAISE_STEP, { ...open, HEALTH: "down", WORKSPACE: "up" });
  assert.equal(healthDown.code, 1);
  assert.doesNotMatch(healthDown.gh, /issue close/);
});

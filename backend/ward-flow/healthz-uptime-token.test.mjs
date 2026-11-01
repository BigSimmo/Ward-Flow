// @ts-check
// Audit P174 + P177: backend security headers, and /healthz database detail only for the uptime monitor.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request as httpRequest } from "node:http";
import { test } from "node:test";
import { createHandler, listen, uptimeTokenMatches } from "./server.mjs";

const config = /** @type {any} */ ({ origin: "http://localhost:3000", trustedProxyAddresses: [] });
let queries = 0;
const sharedStore = {
  async ready() {
    queries += 1;
  },
};
const make = (/** @type {string | undefined} */ uptimeToken) =>
  createHandler({ config, sharedStore, authenticate: async () => "x", log: () => {}, uptimeToken });
const get = (/** @type {Record<string, string>} */ headers = {}) =>
  new Request("http://localhost/healthz", { headers });

test("P177: /healthz hides the database answer without the right uptime token", async () => {
  queries = 0;
  const handler = make("right-token");
  for (const headers of /** @type {Record<string, string>[]} */ ([
    {},
    { "x-ward-flow-uptime-token": "wrong-token" },
    { "x-ward-flow-uptime-token": "" },
  ])) {
    const reply = await handler(get(headers));
    assert.equal(reply.status, 200);
    const body = await reply.json();
    assert.equal(body.service, "ward-flow-backend");
    assert.equal("database" in body, false);
  }
  assert.equal(queries, 0);
});

test("P177: /healthz shows the database answer to the right uptime token", async () => {
  const reply = await make("right-token")(get({ "x-ward-flow-uptime-token": "right-token" }));
  assert.deepEqual(await reply.json(), { service: "ward-flow-backend", database: "ok" });
});

test("P177: with no token set on the server the database answer is never shown", async () => {
  for (const headers of /** @type {Record<string, string>[]} */ ([
    {},
    { "x-ward-flow-uptime-token": "" },
    { "x-ward-flow-uptime-token": "anything" },
  ])) {
    const body = await (await make(undefined)(get(headers))).json();
    assert.equal("database" in body, false);
  }
  assert.equal(uptimeTokenMatches("", ""), false);
  assert.equal(uptimeTokenMatches("abc", "abcd"), false);
  assert.equal(uptimeTokenMatches("abc", "abc"), true);
});

test("P177: the uptime workflow sends the token without treating hidden database health as recovery", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/backend-uptime.yml", import.meta.url), "utf8");
  assert.match(workflow, /UPTIME_TOKEN: \$\{\{ secrets\.WARD_FLOW_UPTIME_TOKEN \}\}/);
  assert.match(workflow, /--header "x-ward-flow-uptime-token: \$UPTIME_TOKEN"/);
  assert.match(workflow, /\.database \/\/ "hidden"/);
  assert.doesNotMatch(workflow, /\.database \/\/ "ok"/);
});

test("P174: every backend reply carries HSTS and a deny-all content policy", async () => {
  const server = listen(async () => Response.json({ ok: true }), { port: 0, host: "127.0.0.1" });
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const port = /** @type {import("node:net").AddressInfo} */ (server.address()).port;
    for (const method of ["GET", "DELETE"]) {
      const headers = await new Promise((resolve, reject) => {
        const req = httpRequest({ host: "127.0.0.1", port, path: "/healthz", method }, (res) => {
          res.resume();
          resolve(res.headers);
        });
        req.on("error", reject);
        req.end();
      });
      assert.equal(headers["strict-transport-security"], "max-age=31536000; includeSubDomains", method);
      assert.equal(headers["content-security-policy"], "default-src 'none'; frame-ancestors 'none'", method);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

const workflow = readFileSync(new URL("../../.github/workflows/backend-uptime.yml", import.meta.url), "utf8");

/** Read the exact shell block from the workflow rather than duplicating its decision logic. */
function uptimeRunBlock(workflow, name) {
  const lines = workflow.split("\n");
  const start = lines.findIndex((line) => line === `      - name: ${name}`);
  assert.notEqual(start, -1, `Workflow step missing: ${name}`);
  const script = lines.findIndex((line, index) => index > start && line === "        run: |");
  assert.notEqual(script, -1, `Workflow shell missing: ${name}`);
  const body = [];
  for (let index = script + 1; lines[index]?.startsWith("          "); index++) body.push(lines[index].slice(10));
  assert.ok(body.length);
  return body.join("\n");
}

/** These functions intercept every network/mutation command in the two reviewed blocks. */
const uptimeShellStubs = `curl() { printf '%s' "$SYNTHETIC_HEALTH_BODY"; }
sleep() { :; }
gh() {
  printf 'GH_CALL %s\\n' "$*" >&2
  if [ "$1 $2" = 'issue list' ]; then printf '%s\\n' "$SYNTHETIC_OPEN_ISSUE"; fi
}
`;

test(
  "P177: workflow preserves outage alerts until database recovery is explicitly verified",
  {
    skip: process.platform === "win32" ? "The monitored workflow runs Ubuntu Bash and jq" : false,
  },
  async () => {
    const check = uptimeRunBlock(workflow, "Ask the backend whether it is up and can reach its database");
    const issues = uptimeRunBlock(workflow, "Raise or close the backend-down issue");
    const temporary = mkdtempSync(join(tmpdir(), "ward-uptime-regression-"));
    let databaseQueries = 0;
    const handler = createHandler({
      config: { origin: "http://localhost:3000", trustedProxyAddresses: [] },
      sharedStore: {
        ready: async () => {
          databaseQueries++;
          throw new Error("Synthetic database unavailable");
        },
      },
      authenticate: async () => "synthetic-actor",
      log: () => {},
      uptimeToken: "synthetic-right-token",
    });
    const hidden = await (
      await handler(
        new Request("http://localhost/healthz", {
          headers: { "x-ward-flow-uptime-token": "synthetic-wrong-token" },
        }),
      )
    ).text();
    assert.equal(databaseQueries, 0, "A wrong token must not probe the database");
    const unavailable = await (
      await handler(
        new Request("http://localhost/healthz", {
          headers: { "x-ward-flow-uptime-token": "synthetic-right-token" },
        }),
      )
    ).text();
    assert.equal(databaseQueries, 1);
    const cases = [
      { name: "hidden database", body: hidden, state: "unknown" },
      { name: "null database", body: '{"service":"ward-flow-backend","database":null}', state: "unknown" },
      { name: "malformed health JSON", body: '{"service":"ward-flow-backend",invalid}', state: "unknown" },
      { name: "verified recovery", body: '{"service":"ward-flow-backend","database":"ok"}', state: "up" },
      { name: "known database outage", body: unavailable, state: "database" },
      {
        name: "unconfigured database",
        body: '{"service":"ward-flow-backend","database":"not_configured"}',
        state: "database",
      },
      { name: "backend unavailable", body: "", state: "down" },
    ];
    try {
      for (const scenario of cases) {
        const output = join(temporary, `${scenario.name}.txt`);
        const environment = {
          PATH: "/usr/bin:/bin",
          SYNTHETIC_HEALTH_BODY: scenario.body,
          GITHUB_OUTPUT: output,
          BACKEND_URL: "https://synthetic.invalid",
          UPTIME_TOKEN: "synthetic-only",
          GITHUB_SERVER_URL: "https://synthetic.invalid",
          GITHUB_REPOSITORY: "synthetic/probe",
          GITHUB_RUN_ID: "synthetic-run",
          OWNER: "synthetic-owner",
          LABEL: "backend-down",
          SYNTHETIC_OPEN_ISSUE: "999",
        };
        const checked = spawnSync("/bin/bash", ["-e", "-c", uptimeShellStubs + check], {
          env: environment,
          encoding: "utf8",
        });
        assert.equal(checked.status, 0, `${scenario.name}: ${checked.stderr}`);
        const state = readFileSync(output, "utf8").match(/^state=(.*)$/m)?.[1];
        assert.equal(state, scenario.state, scenario.name);
        assert.ok(state);
        const script = issues.replaceAll("${{ steps.check.outputs.state }}", state);
        const handled = spawnSync("/bin/bash", ["-e", "-c", uptimeShellStubs + script], {
          env: environment,
          encoding: "utf8",
        });
        assert.equal(handled.status, state === "up" ? 0 : 1, scenario.name);
        if (state === "unknown") {
          assert.equal(handled.stderr, "", `${scenario.name}: no GitHub command should run`);
          assert.match(handled.stdout, /health is unknown/);
          const noExistingIssue = spawnSync("/bin/bash", ["-e", "-c", uptimeShellStubs + script], {
            env: { ...environment, SYNTHETIC_OPEN_ISSUE: "" },
            encoding: "utf8",
          });
          assert.equal(noExistingIssue.status, 1);
          assert.equal(noExistingIssue.stderr, "", "Unknown health must not create a false outage issue either");
        } else if (state === "up") {
          assert.match(handled.stderr, /GH_CALL issue close 999/);
          assert.match(handled.stderr, /database are answering again/);
        } else {
          assert.doesNotMatch(handled.stderr, /GH_CALL issue (?:close|comment)/, scenario.name);
          const noExistingIssue = spawnSync("/bin/bash", ["-e", "-c", uptimeShellStubs + script], {
            env: { ...environment, SYNTHETIC_OPEN_ISSUE: "" },
            encoding: "utf8",
          });
          assert.equal(noExistingIssue.status, 1);
          assert.match(noExistingIssue.stderr, /GH_CALL issue create/);
          assert.match(noExistingIssue.stderr, state === "database" ? /cannot reach its database/ : /not answering/);
        }
      }
    } finally {
      rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  },
);

// @ts-check
// Audit P174 + P177: backend security headers, and /healthz database detail only for the uptime monitor.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  for (const headers of [{}, { "x-ward-flow-uptime-token": "wrong-token" }, { "x-ward-flow-uptime-token": "" }]) {
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
  for (const headers of [{}, { "x-ward-flow-uptime-token": "" }, { "x-ward-flow-uptime-token": "anything" }]) {
    const body = await (await make(undefined)(get(headers))).json();
    assert.equal("database" in body, false);
  }
  assert.equal(uptimeTokenMatches("", ""), false);
  assert.equal(uptimeTokenMatches("abc", "abcd"), false);
  assert.equal(uptimeTokenMatches("abc", "abc"), true);
});

test("P177: the uptime workflow sends the token and counts a missing database as down", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/backend-uptime.yml", import.meta.url), "utf8");
  assert.match(workflow, /UPTIME_TOKEN: \$\{\{ secrets\.WARD_FLOW_UPTIME_TOKEN \}\}/);
  assert.match(workflow, /--header "x-ward-flow-uptime-token: \$UPTIME_TOKEN"/);
  assert.match(workflow, /\.database \/\/ "unavailable"/);
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

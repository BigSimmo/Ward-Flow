// @ts-check
// Production audit 24 Oct (BE-01, BE-02): the listener refuses methods the Fetch standard cannot
// carry (Node itself answers 400 to TRACK and never routes CONNECT here), and a slow handler gets
// one overall deadline below the 15 second socket and browser limit.
import assert from "node:assert/strict";
import { request } from "node:http";
import { test } from "node:test";
import { listen } from "./server.mjs";

/** @param {import("node:http").Server} server */
async function started(server) {
  await new Promise((resolve) => server.once("listening", resolve));
  return /** @type {import("node:net").AddressInfo} */ (server.address()).port;
}

/** @returns {Promise<{ status: number | undefined, headers: import("node:http").IncomingHttpHeaders, body: string }>} */
function send(port, method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const outgoing = request({ port, host: "127.0.0.1", method, path, headers });
    outgoing.on("response", (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () =>
        resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() }),
      );
    });
    outgoing.on("error", reject);
    outgoing.end();
  });
}

/** Collects console.error lines (logFailure) for the duration of one test. */
function captureFailures(t) {
  const lines = [];
  t.mock.method(console, "error", (line) => lines.push(String(line)));
  return lines;
}

test("BE-02: TRACE and other unsupported methods get 405 with Allow, not an unhandled 500", async (t) => {
  const failures = captureFailures(t);
  let calls = 0;
  const server = listen(
    async () => {
      calls += 1;
      return new Response(null, { status: 204 });
    },
    { port: 0, host: "127.0.0.1" },
  );
  try {
    const port = await started(server);
    for (const method of ["TRACE", "PUT", "DELETE", "PATCH"]) {
      const reply = await send(port, method, "/healthz");
      assert.equal(reply.status, 405, method);
      assert.equal(reply.headers.allow, "GET, HEAD, POST, OPTIONS");
      assert.equal(reply.headers["cache-control"], "no-store");
    }
    assert.equal(calls, 0);
    assert.equal((await send(port, "GET", "/healthz")).status, 204);
    assert.equal(calls, 1);
    assert.deepEqual(
      failures.filter((line) => line.includes("ward_backend_unhandled_failure")),
      [],
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("BE-01: a handler past the deadline gets one 503 with the retry wording, and its late reply is dropped", async (t) => {
  const failures = captureFailures(t);
  /** @type {(value: Response) => void} */
  let finish = () => {};
  let finished = false;
  const server = listen(
    () =>
      new Promise((resolve) => {
        finish = (value) => {
          finished = true;
          resolve(value);
        };
      }),
    { port: 0, host: "127.0.0.1", origin: "https://ward.example.test" },
    { deadlineMs: 50 },
  );
  try {
    const port = await started(server);
    const reply = await send(port, "POST", "/v1/workspace/commands", { origin: "https://ward.example.test" });
    assert.equal(reply.status, 503);
    assert.deepEqual(JSON.parse(reply.body), {
      error: "Database unavailable; this change is not confirmed saved. Retry the same command ID.",
    });
    assert.equal(reply.headers["cache-control"], "no-store");
    assert.equal(reply.headers["access-control-allow-origin"], "https://ward.example.test");
    // The handler finishing afterwards must not try to write a second response.
    finish(Response.json({ ok: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(finished, true);
    assert.deepEqual(
      failures.filter((line) => line.includes("ward_backend_unhandled_failure")),
      [],
    );
    assert.equal(failures.filter((line) => line.includes("ward_backend_deadline_exceeded")).length, 1);
    assert.ok(failures.every((line) => !line.includes("/v1/workspace")));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("BE-01: a read past the deadline says try again, and the default deadline is under 15 seconds", async (t) => {
  captureFailures(t);
  const server = listen(() => new Promise(() => {}), { port: 0, host: "127.0.0.1" }, { deadlineMs: 50 });
  try {
    const port = await started(server);
    const reply = await send(port, "GET", "/v1/workspace", { origin: "https://elsewhere.example.test" });
    assert.equal(reply.status, 503);
    assert.deepEqual(JSON.parse(reply.body), { error: "Database unavailable; try again shortly" });
    assert.equal(reply.headers["access-control-allow-origin"], undefined);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  const { HANDLER_DEADLINE_MS } = await import("./server.mjs");
  assert.ok(HANDLER_DEADLINE_MS >= 10_000 && HANDLER_DEADLINE_MS < 15_000);
});

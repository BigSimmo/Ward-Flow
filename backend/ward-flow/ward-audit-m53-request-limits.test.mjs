// @ts-check
// Audit M53: rate limits and abuse. Phone alert sign-ups are limited per account, checked before
// anything is stored, so a refused request changed nothing and can be sent again. Saves
// (/v1/workspace/commands) are limited per account too (fixed 10 Nov 2026); the browser keeps a
// refused save and sends it again after Retry-After (tests/ward-audit-m53-save-limit.test.ts).
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { readPushConfig } from "./push.mjs";
import { COMMAND_LIMIT, PUSH_SUBSCRIBE_LIMIT, createWindowLimiter } from "./request-limits.mjs";
import { createSharedHandler } from "./shared-http.mjs";
import { createHandler } from "./server.mjs";
import { bootstrapViewer } from "./viewer.test-support.mjs";

test("a window limiter allows the limit, refuses the next with a wait, and opens again", () => {
  let now = 1_000;
  const take = createWindowLimiter({ limit: 3, windowMs: 10_000, now: () => now });
  for (let i = 0; i < 3; i++) assert.deepEqual(take("a"), { allowed: true });
  assert.deepEqual(take("a"), { allowed: false, retryAfterSeconds: 10 });
  // Another account has its own window.
  assert.deepEqual(take("b"), { allowed: true });
  now += 9_500;
  assert.deepEqual(take("a"), { allowed: false, retryAfterSeconds: 1 });
  now += 500;
  assert.deepEqual(take("a"), { allowed: true });
});

test("a full key map lets a new key in only when the oldest window has ended", () => {
  let now = 0;
  const take = createWindowLimiter({ limit: 1, windowMs: 1_000, maxKeys: 2, now: () => now });
  assert.equal(take("a").allowed, true);
  assert.equal(take("b").allowed, true);
  assert.equal(take("c").allowed, false, "a new key must not push out a live window");
  assert.equal(take("a").allowed, false, "and a refused new key must not reset an old one");
  now = 1_000;
  assert.equal(take("c").allowed, true);
});

test("a limiter refuses settings that would never limit", () => {
  assert.throws(() => createWindowLimiter({ limit: 0, windowMs: 1 }));
  assert.throws(() => createWindowLimiter({ limit: 1, windowMs: 0 }));
});

function vapidEnv() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const raw = Buffer.concat([
    Buffer.from([4]),
    Buffer.from(/** @type {string} */ (jwk.x), "base64url"),
    Buffer.from(/** @type {string} */ (jwk.y), "base64url"),
  ]);
  return {
    env: {
      WARD_FLOW_VAPID_PUBLIC_KEY: raw.toString("base64url"),
      WARD_FLOW_VAPID_PRIVATE_KEY: /** @type {string} */ (privateKey.export({ format: "jwk" }).d),
      WARD_FLOW_VAPID_SUBJECT: "mailto:ward-flow-demo@example.org",
    },
    p256dh: raw.toString("base64url"),
  };
}

test("phone alert sign-ups past the limit get 429 with Retry-After and store nothing", async () => {
  const coordinator = "22222222-2222-4222-8222-222222222222";
  const { env, p256dh } = vapidEnv();
  const stored = [];
  const handler = createHandler({
    config: { coordinatorIds: [coordinator], origin: null, push: readPushConfig(env) },
    sharedStore: {
      viewer: bootstrapViewer,
      read: async () => ({ revision: 1, dataMode: "prototype" }),
      subscribe: async (...args) => {
        stored.push(args);
        return "subscribed";
      },
      stepUpMinutes: 10,
      sessionLimitMinutes: 720,
    },
    /** @param {string} token @param {{ session?: { signedInAt?: number, startedAt?: number } }} [context] */
    authenticate: async (token, { session } = {}) => {
      if (session) session.signedInAt = session.startedAt = Date.now();
      return coordinator;
    },
    log: () => {},
  });
  const subscription = {
    endpoint: "https://fcm.googleapis.com/fcm/send/synthetic",
    keys: { p256dh, auth: Buffer.alloc(16, 3).toString("base64url") },
  };
  const ask = () =>
    handler(
      new Request("http://localhost/v1/workspace/push-subscribe", {
        method: "POST",
        headers: { authorization: "Bearer test", "content-type": "application/json" },
        body: JSON.stringify({ subscription }),
      }),
    );
  for (let i = 0; i < PUSH_SUBSCRIBE_LIMIT.limit; i++) assert.equal((await ask()).status, 200, `call ${i + 1}`);
  assert.equal(stored.length, PUSH_SUBSCRIBE_LIMIT.limit);
  const refused = await ask();
  assert.equal(refused.status, 429);
  assert.ok(Number(refused.headers.get("retry-after")) > 0);
  assert.equal((await refused.json()).code, "rate-limited");
  assert.equal(stored.length, PUSH_SUBSCRIBE_LIMIT.limit, "a refused sign-up stores nothing");
});

test("M53 saves: past the per-account limit a save gets 429 with Retry-After and reaches no store", async () => {
  const coordinator = "22222222-2222-4222-8222-222222222222";
  const other = "33333333-3333-4333-8333-333333333333";
  let actor = coordinator;
  const commands = [];
  const handler = createSharedHandler({
    config: { coordinatorIds: [coordinator, other], origin: null },
    store: {
      viewer: bootstrapViewer,
      read: async () => ({ revision: 1, dataMode: "prototype" }),
      command: async (...args) => {
        commands.push(args);
        return { status: 200, body: { outcome: "accepted", commandRevision: 2 } };
      },
    },
    authenticate: async () => actor,
    readBody: (request) => request.json(),
    verifierUnavailable: class extends Error {},
    log: () => {},
    commandLimiter: createWindowLimiter({ limit: 3, windowMs: 60_000 }),
  });
  const save = () =>
    handler(
      new Request("http://localhost/v1/workspace/commands", {
        method: "POST",
        headers: { authorization: "Bearer test", "content-type": "application/json" },
        body: JSON.stringify({
          classification: "synthetic",
          commandId: "44444444-4444-4444-8444-444444444444",
          expectedRevision: 1,
          event: { type: "PULL_PATIENT", role: "coordinator" },
        }),
      }),
    );
  for (let i = 0; i < 3; i++) assert.equal((await save()).status, 200, `save ${i + 1}`);
  const refused = await save();
  assert.equal(refused.status, 429);
  assert.equal(refused.headers.get("retry-after"), "60");
  assert.equal((await refused.json()).code, "rate-limited");
  assert.equal(commands.length, 3, "a refused save reaches no store, so it can be sent again");
  // Another account has its own allowance.
  actor = other;
  assert.equal((await save()).status, 200);
});

test("M53 saves: the default limit is generous for a busy shift", () => {
  assert.ok(COMMAND_LIMIT.limit / (COMMAND_LIMIT.windowMs / 60_000) >= 60, "at least a save a second, sustained");
  const take = createWindowLimiter(COMMAND_LIMIT);
  for (let i = 0; i < 200; i++) assert.equal(take("desk").allowed, true, "a 200-save burst");
});

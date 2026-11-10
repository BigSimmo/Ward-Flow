// @ts-check
// Audit M53: rate limits and abuse. Phone alert sign-ups are limited per account, checked before
// anything is stored, so a refused request changed nothing and can be sent again. Saves
// (/v1/workspace/commands) are not limited yet: see the todo below.
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { readPushConfig } from "./push.mjs";
import { PUSH_SUBSCRIBE_LIMIT, createWindowLimiter } from "./request-limits.mjs";
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

test.todo(
  "M53 saves: /v1/workspace/commands has a per-account limit that never drops accepted work " +
    "(needs the browser to hold and resend queued commands on 429 instead of cancelling them; see ward-shared-client.ts)",
);

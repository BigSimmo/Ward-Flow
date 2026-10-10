import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPairSync } from "node:crypto";
import {
  ALERTS_PATH,
  createPushSender,
  errorFields,
  freshAlerts,
  parseSubscription,
  pushPayload,
  readPushConfig,
} from "./push.mjs";
import { readConfig } from "./config.mjs";
import { createHandler } from "./server.mjs";
import { sweepPush } from "./function.mjs";

// Invented keys generated for this test run only; never a deployed key.
function vapidKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const publicJwk = publicKey.export({ format: "jwk" });
  const raw = Buffer.concat([
    Buffer.from([4]),
    Buffer.from(publicJwk.x, "base64url"),
    Buffer.from(publicJwk.y, "base64url"),
  ]);
  return { publicKey: raw.toString("base64url"), privateKey: privateKey.export({ format: "jwk" }).d };
}
const keys = vapidKeys();
const env = {
  WARD_FLOW_VAPID_PUBLIC_KEY: keys.publicKey,
  WARD_FLOW_VAPID_PRIVATE_KEY: keys.privateKey,
  WARD_FLOW_VAPID_SUBJECT: "mailto:ward-flow-demo@example.org",
};
// A browser's subscription key must be a real P-256 point; this one is generated per run.
const browserKeys = { p256dh: keys.publicKey, auth: Buffer.alloc(16, 3).toString("base64url") };
const offCurve = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString("base64url");

test("phone push is off unless all three VAPID settings are present", () => {
  assert.equal(readPushConfig({}), null);
  assert.equal(readPushConfig({ ...env, WARD_FLOW_VAPID_PRIVATE_KEY: "" }), null);
  assert.equal(readPushConfig({ ...env, WARD_FLOW_VAPID_SUBJECT: "  " }), null);
  assert.deepEqual(readPushConfig(env), {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    subject: env.WARD_FLOW_VAPID_SUBJECT,
  });
});

test("malformed VAPID settings are refused rather than silently used", () => {
  assert.throws(() => readPushConfig({ ...env, WARD_FLOW_VAPID_PUBLIC_KEY: "not-a-key" }), /phone push/);
  assert.throws(() => readPushConfig({ ...env, WARD_FLOW_VAPID_PRIVATE_KEY: keys.publicKey }), /phone push/);
  assert.throws(() => readPushConfig({ ...env, WARD_FLOW_VAPID_SUBJECT: "http://example.org" }), /phone push/);
});

test("a VAPID public key from a different pair is refused with a clear error", () => {
  const otherPair = vapidKeys();
  assert.throws(
    () => readPushConfig({ ...env, WARD_FLOW_VAPID_PUBLIC_KEY: otherPair.publicKey }),
    /public and private keys are not a pair/,
  );
  assert.throws(() => readPushConfig({ ...env, WARD_FLOW_VAPID_PUBLIC_KEY: offCurve }), /not a pair/);
});

test("only a browser push service endpoint with valid keys is accepted", () => {
  const ok = parseSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: browserKeys });
  assert.deepEqual(ok, { endpoint: "https://fcm.googleapis.com/fcm/send/abc", ...browserKeys });
  assert.ok(parseSubscription({ endpoint: "https://web.push.apple.com/QH1", keys: browserKeys }));
  assert.ok(parseSubscription({ endpoint: "https://updates.push.services.mozilla.com/wpush/v2/x", keys: browserKeys }));
  for (const endpoint of [
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://attacker.example/fcm.googleapis.com",
    "https://fcm.googleapis.com.attacker.example/x",
    "https://user:pass@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x",
    "https://169.254.169.254/metadata",
    `https://fcm.googleapis.com/${"a".repeat(2100)}`,
  ])
    assert.equal(parseSubscription({ endpoint, keys: browserKeys }), null, endpoint);
  const endpoint = "https://fcm.googleapis.com/fcm/send/abc";
  assert.equal(parseSubscription({ endpoint, keys: { ...browserKeys, auth: "short" } }), null);
  assert.equal(parseSubscription({ endpoint, keys: { ...browserKeys, p256dh: "a+b/c=" } }), null);
  // Right length and prefix, but not on the curve: it could never encrypt, so it is never stored.
  assert.equal(parseSubscription({ endpoint, keys: { ...browserKeys, p256dh: offCurve } }), null);
  assert.equal(parseSubscription({ endpoint }), null);
  assert.equal(parseSubscription(null), null);
  assert.equal(parseSubscription([endpoint]), null);
});

test("only items not on the last active list are announced, each once", () => {
  const current = [{ id: "a" }, { id: "b" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(
    freshAlerts(["a"], current).map((alert) => alert.id),
    ["b", "c"],
  );
  assert.deepEqual(freshAlerts(["a", "b", "c"], current), []);
  // Cleared and later back: new again, as the open-tab notifier treats it.
  assert.deepEqual(
    freshAlerts([], [{ id: "a" }]).map((alert) => alert.id),
    ["a"],
  );
});

test("the payload carries a count, a site and the Alerts path only", () => {
  assert.deepEqual(pushPayload([{ id: "bed-pull-WF-004", site: "Royal Perth Hospital" }]), {
    title: "Ward Flow: 1 new act now item",
    body: "Royal Perth Hospital. Open Alerts to review. Synthetic demo data.",
    url: ALERTS_PATH,
    tag: "ward-flow-act-now",
  });
  assert.equal(
    pushPayload([
      { id: "x", site: "Royal Perth Hospital" },
      { id: "y", site: "Fiona Stanley Hospital" },
    ]).body,
    "2 sites. Open Alerts to review. Synthetic demo data.",
  );
  assert.equal(
    pushPayload([{ id: "x", site: null }]).body,
    "Ward Flow network. Open Alerts to review. Synthetic demo data.",
  );
});

test("no patient name, UMRN, Ward Flow id, alert text or typed text reaches the payload", async () => {
  const engine = await import("./dist/engine.mjs");
  const at = new Date("2026-10-10T10:00:00Z");
  const world = engine.applyCommand(
    engine.seedWorld(at),
    { type: "ADVANCE_CLOCK", role: "demo", minutes: 240 },
    at,
  ).world;
  const alerts = engine.actNowAlerts(world, at);
  assert.ok(alerts.length >= 5, "the fixture must raise several act-now items");
  // Even a caller that passes whole inbox rows cannot leak them: only `site` is read.
  const leaky = alerts.map((alert) => ({
    ...alert,
    title: "Bed pull expired",
    detail: `${alert.id} typed note`,
    patientName: "Talia Halloway",
  }));
  const text = JSON.stringify(pushPayload(leaky));
  assert.doesNotMatch(text, /WF-\d|PT-\d|UM\d|Bed pull|Legal due|declined|typed note/i);
  const forbidden = [
    ...world.state.movements.flatMap((movement) => [movement.id, movement.patientId, movement.legalStatus]),
    ...world.state.patients.flatMap((patient) => [
      patient.id,
      patient.umrn,
      patient.givenName,
      patient.familyName,
      patient.preferredName,
      patient.dateOfBirth,
      patient.address,
    ]),
    ...alerts.map((alert) => alert.id),
  ].filter((value) => typeof value === "string" && value.length >= 3);
  for (const value of forbidden) assert.equal(text.includes(value), false, `payload must not contain ${value}`);
  assert.deepEqual(Object.keys(JSON.parse(text)).sort(), ["body", "tag", "title", "url"]);
});

test("delivery reports sent, expired (404 or 410) or failed, with the fixed topic and payload", async () => {
  const calls = [];
  const socket = Object.assign(new Error("socket hang up https://fcm.googleapis.com/fcm/send/abc"), {
    code: "ECONNRESET",
  });
  const outcomes = [null, { statusCode: 410 }, { statusCode: 404 }, { statusCode: 429 }, socket];
  const webpush = {
    sendNotification: async (...args) => {
      calls.push(args);
      const outcome = outcomes[calls.length - 1];
      if (outcome) throw outcome;
      return { statusCode: 201 };
    },
  };
  const send = createPushSender(readPushConfig(env), webpush);
  const subscription = { id: 1, endpoint: "https://fcm.googleapis.com/fcm/send/abc", ...browserKeys };
  const payload = pushPayload([{ id: "x", site: "Royal Perth Hospital" }]);
  const results = [];
  for (let index = 0; index < outcomes.length; index += 1) results.push(await send(subscription, payload));
  assert.deepEqual(results, [
    { outcome: "sent" },
    { outcome: "expired" },
    { outcome: "expired" },
    { outcome: "failed", category: "status 429" },
    { outcome: "failed", category: "Error ECONNRESET" },
  ]);
  const [target, body, options] = calls[0];
  assert.deepEqual(target, { endpoint: subscription.endpoint, keys: browserKeys });
  assert.deepEqual(JSON.parse(body), payload);
  assert.equal(options.topic, "wardflowactnow");
  assert.equal(options.urgency, "high");
  assert.equal(options.vapidDetails.publicKey, keys.publicKey);
});

test("the real web-push library accepts the configuration and encrypts the payload (no network)", async () => {
  const { default: webpush } = await import("web-push");
  const config = readPushConfig(env);
  const browser = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey.export({ format: "jwk" });
  const subscription = parseSubscription({
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    keys: {
      p256dh: Buffer.concat([
        Buffer.from([4]),
        Buffer.from(browser.x, "base64url"),
        Buffer.from(browser.y, "base64url"),
      ]).toString("base64url"),
      auth: Buffer.alloc(16, 9).toString("base64url"),
    },
  });
  const payload = JSON.stringify(pushPayload([{ id: "x", site: "Royal Perth Hospital" }]));
  const details = webpush.generateRequestDetails(
    { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
    payload,
    { vapidDetails: config, TTL: 3600, urgency: "high", topic: "wardflowactnow" },
  );
  assert.equal(details.method, "POST");
  assert.equal(details.headers.Topic, "wardflowactnow");
  assert.match(details.headers.Authorization, /^vapid t=/);
  // Encrypted on the wire: the plain words never appear in the request body.
  assert.equal(Buffer.from(details.body).includes("Royal Perth"), false);
});

// HTTP routes ----------------------------------------------------------------------------------

const coordinator = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
function routes({ actor = coordinator, push = readPushConfig(env), limit = false } = {}) {
  const calls = [];
  const handler = createHandler({
    config: { coordinatorIds: [coordinator], origin: null, push },
    store: {},
    sharedStore: {
      read: async () => ({ revision: 1, dataMode: "prototype" }),
      subscribe: async (...args) => {
        calls.push(["subscribe", ...args]);
        return limit ? "limit" : "subscribed";
      },
      unsubscribe: async (...args) => {
        calls.push(["unsubscribe", ...args]);
        return "unsubscribed";
      },
      pushStatus: async (...args) => {
        calls.push(["status", ...args]);
        return true;
      },
    },
    authenticate: async (token) => {
      if (!token) throw new Error("Unauthorised");
      return actor;
    },
  });
  return { calls, handler };
}
const call = (path, data, token = "Bearer test") =>
  new Request(`http://localhost/v1/workspace/${path}`, {
    method: data ? "POST" : "GET",
    headers: { authorization: token, "content-type": "application/json" },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: browserKeys };

test("the public key route says whether phone alerts are set up, and never returns the private key", async () => {
  const on = await (await routes().handler(call("push-key"))).json();
  assert.deepEqual(on, { enabled: true, publicKey: keys.publicKey });
  assert.equal(JSON.stringify(on).includes(keys.privateKey), false);
  const off = routes({ push: null });
  assert.deepEqual(await (await off.handler(call("push-key"))).json(), { enabled: false });
  assert.equal((await off.handler(call("push-subscribe", { subscription }))).status, 503);
  assert.equal(off.calls.length, 0);
});

test("a signed-in coordinator subscribes and unsubscribes only their own device", async () => {
  const { calls, handler } = routes();
  const subscribed = await handler(call("push-subscribe", { subscription, actorId: other }));
  assert.equal(subscribed.status, 200);
  const unsubscribed = await handler(call("push-unsubscribe", { endpoint: subscription.endpoint }));
  assert.deepEqual(await unsubscribed.json(), { subscribed: false, revoked: true });
  const status = await handler(call("push-status", { endpoint: subscription.endpoint }));
  assert.deepEqual(await status.json(), { owned: true });
  assert.deepEqual(calls, [
    ["subscribe", coordinator, { endpoint: subscription.endpoint, ...browserKeys }],
    ["unsubscribe", coordinator, subscription.endpoint],
    ["status", coordinator, subscription.endpoint],
  ]);
});

test("push routes refuse other accounts, missing sign-in, bad subscriptions and the wrong method", async () => {
  const outsider = routes({ actor: other });
  assert.equal((await outsider.handler(call("push-subscribe", { subscription }))).status, 403);
  assert.equal((await outsider.handler(call("push-key"))).status, 403);
  assert.equal((await outsider.handler(call("push-status", { endpoint: subscription.endpoint }))).status, 403);
  assert.equal(outsider.calls.length, 0);
  const { calls, handler } = routes();
  assert.equal((await handler(call("push-subscribe", { subscription }, ""))).status, 401);
  assert.equal(
    (await handler(call("push-subscribe", { subscription: { ...subscription, endpoint: "https://example.com/x" } })))
      .status,
    400,
  );
  assert.equal((await handler(call("push-unsubscribe", { endpoint: 42 }))).status, 400);
  assert.equal((await handler(call("push-subscribe"))).status, 405);
  assert.equal((await handler(call("push-key", {}))).status, 405);
  assert.equal(calls.length, 0);
  const full = routes({ limit: true });
  assert.equal((await full.handler(call("push-subscribe", { subscription }))).status, 409);
});

test("configuration turns phone push on only with the shared workspace and all three settings", () => {
  const base = {
    AZURE_TENANT_ID: other,
    WARD_ALLOWED_OBJECT_ID: coordinator,
    WARD_API_AUDIENCE: "9b7b160d-9bc7-4712-b748-17ff3e70b706", // gitleaks:allow -- synthetic API audience (client ID)
    AzureWebJobsStorage__accountName: "wflowdev7273a083aue",
  };
  assert.equal(readConfig({ ...base, ...env }).push, null);
  const shared = {
    ...base,
    WARD_SHARED_ENABLED: "true",
    WARD_WORKSPACE_ID: "44444444-4444-4444-8444-444444444444",
    WARD_PG_RESOURCE_ID: `/subscriptions/${other}/resourceGroups/rg-wardflow-dev-aue/providers/Microsoft.DBforPostgreSQL/flexibleServers/wardflow-dev-aue`,
    WARD_PG_HOST: "wardflow-dev-aue.postgres.database.azure.com",
    WARD_PG_DATABASE: "wardflow_dev",
    WARD_PG_USER: "wardflow_backend",
  };
  assert.equal(readConfig(shared).push, null);
  assert.equal(readConfig({ ...shared, ...env }).push.publicKey, keys.publicKey);
});

test("error diagnostics carry name, code and a URL-free message only", () => {
  const error = Object.assign(new Error("permission denied for table push_subscriptions at https://x.example/k"), {
    code: "42501",
  });
  assert.deepEqual(errorFields(error), {
    errorName: "Error",
    errorCode: "42501",
    message: "permission denied for table push_subscriptions at [url]",
  });
  assert.deepEqual(errorFields(undefined), { errorName: "Error", message: "" });
});

test("a failed sweep is logged with its cause, never silently", async () => {
  const events = [];
  const failing = Object.assign(new Error("relation does not exist"), { code: "42P01" });
  await sweepPush(
    null,
    null,
    async () => {
      throw failing;
    },
    (event) => events.push(event),
  );
  assert.deepEqual(events, [
    {
      event: "ward_backend_push_sweep_failure",
      errorName: "Error",
      errorCode: "42P01",
      message: "relation does not exist",
    },
  ]);
});

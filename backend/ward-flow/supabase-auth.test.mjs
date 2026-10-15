import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { test } from "node:test";
import { VerifierRateLimitedError, VerifierUnavailableError } from "./auth.mjs";
import { clientAddress, createHandler } from "./server.mjs";
import { APPROVED_SUPABASE_PROJECT, APPROVED_SUPABASE_URL } from "./supabase-config.mjs";
import { REMOTE_CHECKS_PER_ADDRESS, createSupabaseAuthenticator } from "./supabase-auth.mjs";

const coordinator = randomUUID();
const config = {
  coordinatorIds: [coordinator],
  supabase: {
    projectRef: APPROVED_SUPABASE_PROJECT,
    url: APPROVED_SUPABASE_URL,
    publishableKey: ["sb", "publishable", "synthetic_offline_fixture"].join("_"),
  },
};
const JWKS = `${APPROVED_SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
const USER = `${APPROVED_SUPABASE_URL}/auth/v1/user`;
const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const claims = (extra = {}) => ({
  sub: coordinator,
  iss: `${APPROVED_SUPABASE_URL}/auth/v1`,
  aud: "authenticated",
  role: "authenticated",
  exp: Math.floor(Date.now() / 1000) + 3600,
  ...extra,
});

const ec = generateKeyPairSync("ec", { namedCurve: "P-256" });
const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
const published = {
  keys: [
    { ...ec.publicKey.export({ format: "jwk" }), kid: "ec-1", alg: "ES256", use: "sig" },
    { ...rsa.publicKey.export({ format: "jwk" }), kid: "rsa-1", alg: "RS256", use: "sig" },
  ],
};
function signed(alg, kid, body = claims()) {
  const data = `${part({ alg, kid, typ: "JWT" })}.${part(body)}`;
  const signature =
    alg === "ES256"
      ? sign("sha256", Buffer.from(data), { key: ec.privateKey, dsaEncoding: "ieee-p1363" })
      : sign("sha256", Buffer.from(data), rsa.privateKey);
  return `Bearer ${data}.${signature.toString("base64url")}`;
}
const legacy = (body = claims()) => `Bearer ${part({ alg: "HS256", typ: "JWT" })}.${part(body)}.c3ludGhldGlj`;

function setup({ keys = published, user = { id: coordinator }, clock } = {}) {
  const calls = [];
  const verify = createSupabaseAuthenticator(config, {
    now: clock,
    fetch: async (url) => {
      calls.push(url);
      if (url === JWKS) return keys ? Response.json(keys) : new Response(null, { status: 503 });
      return Response.json(user);
    },
  });
  return { calls, verify };
}

test("a token signed with a published key is verified here, with no call to Supabase per request", async () => {
  const { calls, verify } = setup();
  for (const alg of ["ES256", "RS256"]) {
    const token = signed(alg, alg === "ES256" ? "ec-1" : "rsa-1");
    assert.equal(await verify(token), coordinator);
    assert.equal(await verify(token), coordinator);
  }
  assert.deepEqual(calls, [JWKS], "the published keys are read once and cached");
});

test("a forged, altered or wrong-audience signed token is refused without asking Supabase", async () => {
  const { calls, verify } = setup();
  const good = signed("ES256", "ec-1");
  const [header, body] = good.slice(7).split(".");
  const forged = `Bearer ${header}.${body}.${Buffer.alloc(64).toString("base64url")}`;
  const altered = `Bearer ${header}.${part({ ...claims(), exp: claims().exp + 99_999 })}.${good.split(".")[2]}`;
  const crossAlg = signed("ES256", "rsa-1");
  for (const token of [forged, altered, crossAlg, signed("ES256", "ec-1", claims({ aud: "anon" }))])
    await assert.rejects(
      verify(token),
      (error) => !(error instanceof VerifierUnavailableError) && error.message === "Unauthorised",
    );
  assert.deepEqual(calls, [JWKS]);
});

test("a key missing from the current list is refused without asking Supabase, and re-read at most once a minute", async () => {
  let at = Date.now();
  let keys = { keys: [published.keys[1]] };
  const calls = [];
  const verify = createSupabaseAuthenticator(config, {
    now: () => at,
    fetch: async (url) => {
      calls.push(url);
      return url === JWKS ? Response.json(keys) : Response.json({ id: coordinator });
    },
  });
  for (const jti of ["first", "second"])
    await assert.rejects(verify(signed("ES256", "ec-1", claims({ jti }))), VerifierUnavailableError);
  assert.deepEqual(calls, [JWKS], "made-up or rotated keys never reach /auth/v1/user");
  keys = published;
  at += 61_000;
  assert.equal(await verify(signed("ES256", "ec-1", claims({ jti: "third" }))), coordinator);
  assert.deepEqual(calls, [JWKS, JWKS]);
});

test("keys older than the cache lifetime are not used when a refresh fails", async () => {
  let at = Date.now();
  let up = true;
  const calls = [];
  const verify = createSupabaseAuthenticator(config, {
    now: () => at,
    fetch: async (url) => {
      calls.push(url);
      if (url !== JWKS) return Response.json({ id: coordinator });
      return up ? Response.json(published) : new Response(null, { status: 503 });
    },
  });
  assert.equal(await verify(signed("ES256", "ec-1")), coordinator);
  up = false;
  at += 10 * 60_000;
  assert.equal(await verify(signed("ES256", "ec-1", claims({ jti: "stale" }))), coordinator);
  assert.deepEqual(calls, [JWKS, JWKS, USER], "a stale key list sends the token to Supabase instead");
});

test("Supabase being down for the keys still lets a legacy check through, and never fails open", async () => {
  const { calls, verify } = setup({ keys: null });
  assert.equal(await verify(signed("ES256", "ec-1")), coordinator);
  assert.deepEqual(calls, [JWKS, USER]);
  const refusing = setup({ keys: null, user: { id: randomUUID() } });
  await assert.rejects(refusing.verify(signed("ES256", "ec-1")), /Unauthorised/);
});

test("expired published keys are not used after a failed refresh", async () => {
  let at = Date.now();
  let keys = published;
  const calls = [];
  const verify = createSupabaseAuthenticator(config, {
    now: () => at,
    fetch: async (url) => {
      calls.push(url);
      if (url === JWKS) return keys ? Response.json(keys) : new Response(null, { status: 503 });
      return Response.json({ id: coordinator });
    },
  });
  const token = signed("ES256", "ec-1");
  assert.equal(await verify(token), coordinator);
  at += 10 * 60_000;
  keys = null;
  assert.equal(await verify(token), coordinator);
  assert.deepEqual(calls, [JWKS, JWKS, USER]);
});

test("a confirmed legacy token is reused for a minute, never past its expiry", async () => {
  let at = Date.now();
  const { calls, verify } = setup({ clock: () => at });
  const token = legacy();
  await verify(token);
  await verify(token);
  assert.equal(calls.length, 1);
  at += 61_000;
  await verify(token);
  assert.equal(calls.length, 2);
});

test("remote checks are limited per client address and per coordinator before anything is sent", async () => {
  const { calls, verify } = setup();
  for (let index = 0; index < REMOTE_CHECKS_PER_ADDRESS; index += 1)
    await verify(legacy(claims({ jti: String(index) })), { clientAddress: "203.0.113.9" });
  await assert.rejects(
    verify(legacy(claims({ jti: "over" })), { clientAddress: "203.0.113.9" }),
    VerifierRateLimitedError,
  );
  assert.equal(calls.length, REMOTE_CHECKS_PER_ADDRESS);
  // The same coordinator from another address has used its own allowance too.
  await assert.rejects(
    verify(legacy(claims({ jti: "other" })), { clientAddress: "198.51.100.4" }),
    VerifierRateLimitedError,
  );
  assert.equal(await verify(signed("ES256", "ec-1"), { clientAddress: "203.0.113.9" }), coordinator);
});

test("one coordinator's checks cannot use up the allowance for the others", async () => {
  const other = randomUUID();
  const calls = [];
  const verify = createSupabaseAuthenticator(
    { ...config, coordinatorIds: [coordinator, other] },
    {
      fetch: async (url) => {
        calls.push(url);
        return Response.json({ id: other });
      },
    },
  );
  for (let index = 0; index < REMOTE_CHECKS_PER_ADDRESS; index += 1)
    await verify(legacy(claims({ jti: String(index) })), { clientAddress: `198.51.100.${index}` }).catch(() => {});
  await assert.rejects(
    verify(legacy(claims({ jti: "over" })), { clientAddress: "203.0.113.50" }),
    VerifierRateLimitedError,
  );
  assert.equal(await verify(legacy(claims({ sub: other })), { clientAddress: "203.0.113.50" }), other);
});

test("requests arriving together share one read of the published keys", async () => {
  const { calls, verify } = setup();
  const tokens = Array.from({ length: 5 }, (_, index) => signed("ES256", "ec-1", claims({ jti: String(index) })));
  assert.deepEqual(await Promise.all(tokens.map((token) => verify(token))), Array(5).fill(coordinator));
  assert.deepEqual(calls, [JWKS]);
});

test("the shared API and readiness answer 429 with Retry-After when the limit is reached", async () => {
  const handler = createHandler({
    config: { coordinatorIds: [coordinator], origin: null },
    sharedStore: { read: async () => ({ revision: 1, dataMode: "prototype" }), ready: async () => {} },
    authenticate: async () => {
      throw new VerifierRateLimitedError("Too many sign-in checks");
    },
    log: () => {},
  });
  for (const path of ["/v1/workspace", "/readyz"]) {
    const response = await handler(new Request(`http://localhost${path}`, { headers: { authorization: "Bearer x" } }), {
      clientAddress: "203.0.113.9",
    });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "60");
  }
});

test("the client address trusts forwarded headers only from configured proxies", () => {
  const incoming = { headers: { "x-forwarded-for": "10.0.0.1, 203.0.113.9" }, socket: { remoteAddress: "proxy" } };
  assert.equal(clientAddress(incoming), "proxy");
  assert.equal(clientAddress(incoming, ["proxy"]), "203.0.113.9");
  assert.equal(clientAddress({ headers: {}, socket: { remoteAddress: "127.0.0.1" } }), "127.0.0.1");
  assert.equal(clientAddress({ headers: {}, socket: {} }), "unknown");
});

// @ts-check
import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { test } from "node:test";
import { VerifierRateLimitedError, VerifierUnavailableError } from "./auth.mjs";
import { clientAddress, createHandler } from "./server.mjs";
import { APPROVED_SUPABASE_PROJECT, APPROVED_SUPABASE_URL } from "./supabase-config.mjs";
import {
  REMOTE_CHECKS_PER_ACCOUNT,
  REMOTE_CHECKS_PER_ADDRESS,
  REMOTE_CHECKS_TOTAL,
  REMOTE_CHECKS_UNKNOWN_TOTAL,
  ROLE_HOLDERS_REFRESH_MS,
  ROLE_HOLDERS_RETRY_MS,
  createSupabaseAuthenticator,
} from "./supabase-auth.mjs";

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

/** @param {{ keys?: { keys: Array<Record<string, unknown>> } | null, user?: unknown, clock?: () => number }} [options] */
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
      (/** @type {Error} */ error) => !(error instanceof VerifierUnavailableError) && error.message === "Unauthorised",
    );
  assert.deepEqual(calls, [JWKS]);
});

test("a key missing from a list read after the token was issued is refused, without asking Supabase", async () => {
  const { calls, verify } = setup({ keys: { keys: [published.keys[1]] } });
  const issued = claims({ iat: Math.floor(Date.now() / 1000) - 60 });
  await assert.rejects(
    verify(signed("ES256", "ec-1", issued)),
    (/** @type {Error} */ error) => !(error instanceof VerifierUnavailableError) && error.message === "Unauthorised",
  );
  await assert.rejects(verify(signed("ES256", "made-up", issued)), /Unauthorised/);
  assert.deepEqual(calls, [JWKS], "removed or made-up keys never reach /auth/v1/user");
});

test("a token newer than the key list is answered as unavailable until the list is re-read, at most once a minute", async () => {
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
  assert.equal(await verify(signed("RS256", "rsa-1")), coordinator);
  at += 10_000;
  const rotated = signed("ES256", "ec-1", claims({ iat: Math.floor(at / 1000) }));
  await assert.rejects(verify(rotated), VerifierUnavailableError);
  assert.deepEqual(calls, [JWKS]);
  keys = published;
  at += 61_000;
  assert.equal(await verify(rotated), coordinator);
  assert.deepEqual(calls, [JWKS, JWKS]);
});

test("a published key that cannot be used here falls back to Supabase", async () => {
  const unreadable = { kty: "EC", crv: "P-256", x: "AA", y: "AA", kid: "odd-1", alg: "ES256" };
  const { calls, verify } = setup({ keys: { keys: [unreadable, ...published.keys] } });
  assert.equal(await verify(signed("ES256", "odd-1")), coordinator);
  assert.deepEqual(calls, [JWKS, USER]);
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

test("a token that expires while the keys are being read is refused", async () => {
  let at = Date.now();
  const verify = createSupabaseAuthenticator(config, {
    now: () => at,
    fetch: async () => {
      at += 120_000;
      return Response.json(published);
    },
  });
  const token = signed("ES256", "ec-1", claims({ exp: Math.floor(at / 1000) + 60 }));
  await assert.rejects(verify(token), /Unauthorised/);
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

test("remote checks are limited per client address while another source can still verify", async () => {
  const { calls, verify } = setup();
  for (let index = 0; index < REMOTE_CHECKS_PER_ADDRESS; index += 1)
    await verify(legacy(claims({ jti: String(index) })), { clientAddress: "203.0.113.9" });
  await assert.rejects(
    verify(legacy(claims({ jti: "over" })), { clientAddress: "203.0.113.9" }),
    VerifierRateLimitedError,
  );
  assert.equal(calls.length, REMOTE_CHECKS_PER_ADDRESS);
  assert.equal(
    await verify(legacy(claims({ jti: "other" })), {
      clientAddress: "198.51.100.4",
    }),
    coordinator,
  );
  assert.equal(await verify(signed("ES256", "ec-1"), { clientAddress: "203.0.113.9" }), coordinator);
});

test("forged subjects from one address do not lock out another address's genuine fallback token", async () => {
  const genuine = legacy(claims({ jti: "genuine" }));
  const calls = [];
  const verify = createSupabaseAuthenticator(config, {
    fetch: async (url, options) => {
      calls.push(url);
      if (url === JWKS) return Response.json(published);
      return options.headers.Authorization === genuine
        ? Response.json({ id: coordinator })
        : new Response(null, { status: 401 });
    },
  });
  for (let index = 0; index < REMOTE_CHECKS_PER_ADDRESS; index += 1)
    await assert.rejects(
      verify(legacy(claims({ jti: `forged-${index}` })), {
        clientAddress: "198.51.100.4",
      }),
      /Unauthorised/,
    );
  await assert.rejects(
    verify(legacy(claims({ jti: "over" })), { clientAddress: "198.51.100.4" }),
    VerifierRateLimitedError,
  );
  assert.equal(await verify(genuine, { clientAddress: "203.0.113.9" }), coordinator);
  // Both local signatures and confirmed tokens remain available after a source uses its budget.
  assert.equal(await verify(genuine, { clientAddress: "198.51.100.4" }), coordinator);
  assert.equal(await verify(signed("ES256", "ec-1"), { clientAddress: "198.51.100.4" }), coordinator);
});

test("distributed forged subjects remain bounded by the total remote budget", async () => {
  const holders = Array.from({ length: REMOTE_CHECKS_TOTAL / REMOTE_CHECKS_PER_ACCOUNT + 1 }, () => randomUUID());
  const verify = createSupabaseAuthenticator(config, {
    roleHolders: async () => holders,
    fetch: async () => new Response(null, { status: 401 }),
  });
  for (let index = 0; index < REMOTE_CHECKS_TOTAL; index += 1)
    await assert.rejects(
      verify(legacy(claims({ sub: holders[index % (holders.length - 1)], jti: `forged-${index}` })), {
        clientAddress: `synthetic-source-${index}`,
      }),
      /Unauthorised/,
    );
  await assert.rejects(
    verify(legacy(claims({ sub: holders.at(-1), jti: "over-total" })), {
      clientAddress: "synthetic-new-source",
    }),
    VerifierRateLimitedError,
  );
});

test("forged tokens naming one real role holder spend only that account's share of the main allowance", async () => {
  const nurse = randomUUID();
  const calls = [];
  const verify = createSupabaseAuthenticator(config, {
    roleHolders: async () => [nurse],
    fetch: async (url, init) => {
      calls.push(url);
      const token = init.headers.Authorization.slice(7).split(".")[1];
      const { sub, jti } = JSON.parse(Buffer.from(token, "base64url").toString());
      return jti?.startsWith("forged") ? new Response(null, { status: 401 }) : Response.json({ id: sub });
    },
  });
  // Every forged token names the bootstrap coordinator, each from a new address.
  const forged = REMOTE_CHECKS_PER_ACCOUNT + REMOTE_CHECKS_UNKNOWN_TOTAL;
  for (let index = 0; index < forged; index += 1)
    await assert.rejects(
      verify(legacy(claims({ jti: `forged-${index}` })), { clientAddress: `198.51.100.${index}` }),
      /Unauthorised/,
    );
  await assert.rejects(
    verify(legacy(claims({ jti: "forged-over" })), { clientAddress: "203.0.113.90" }),
    VerifierRateLimitedError,
  );
  assert.equal(calls.length, forged);
  // Another role holder still has the rest of the main allowance.
  assert.equal(await verify(legacy(claims({ sub: nurse })), { clientAddress: "203.0.113.91" }), nurse);
});

test("made-up accounts share one small allowance, so they never use up the checks real desks need", async () => {
  const nurse = randomUUID();
  let reads = 0;
  const calls = [];
  const verify = createSupabaseAuthenticator(config, {
    roleHolders: async () => {
      reads += 1;
      return [nurse];
    },
    fetch: async (url, init) => {
      calls.push(url);
      const token = init.headers.Authorization.slice(7).split(".")[1];
      return Response.json({ id: JSON.parse(Buffer.from(token, "base64url").toString()).sub });
    },
  });
  // Each forged token names a new account from a new address, so neither per-account nor
  // per-address limits apply. Only the allowance for accounts with no role does.
  for (let index = 0; index < REMOTE_CHECKS_UNKNOWN_TOTAL; index += 1)
    await verify(legacy(claims({ sub: randomUUID() })), { clientAddress: `198.51.100.${index}` });
  await assert.rejects(
    verify(legacy(claims({ sub: randomUUID() })), { clientAddress: "203.0.113.70" }),
    VerifierRateLimitedError,
  );
  assert.equal(calls.length, REMOTE_CHECKS_UNKNOWN_TOTAL);
  // A bootstrap coordinator and an account with a role still get through.
  assert.equal(await verify(legacy(), { clientAddress: "203.0.113.71" }), coordinator);
  assert.equal(await verify(legacy(claims({ sub: nurse })), { clientAddress: "203.0.113.72" }), nurse);
  // The role holders were read once, not once per token.
  assert.equal(reads, 1);
});

test("forged tokens never cause a database read per request, from one address or many", async () => {
  let at = 1_000_000;
  let reads = 0;
  const verify = createSupabaseAuthenticator(config, {
    now: () => at,
    roleHolders: async () => {
      reads += 1;
      return [];
    },
    fetch: async () => Response.json({ id: randomUUID() }),
  });
  // One address is charged before the role check, refused or not, so it stops at its own limit.
  for (let index = 0; index < REMOTE_CHECKS_PER_ADDRESS * 3; index += 1)
    await verify(legacy(claims({ sub: randomUUID() })), { clientAddress: "203.0.113.90" }).catch(() => {});
  // Many addresses, each with a new account, share the one cached read.
  for (let index = 0; index < 200; index += 1)
    await verify(legacy(claims({ sub: randomUUID() })), { clientAddress: `10.0.${index}.1` }).catch(() => {});
  assert.equal(reads, 1);
  at += ROLE_HOLDERS_REFRESH_MS;
  await verify(legacy(claims({ sub: randomUUID() })), { clientAddress: "10.1.0.1" }).catch(() => {});
  assert.equal(reads, 2);
});

test("a role granted after the last read is recognised at the next refresh, and a failed read keeps the last list", async () => {
  let at = 1_000_000;
  const nurse = randomUUID();
  let holders = [];
  let failing = false;
  const verify = createSupabaseAuthenticator(config, {
    now: () => at,
    roleHolders: async () => {
      if (failing) throw new Error("database unavailable");
      return holders;
    },
    fetch: async (_url, init) => {
      const token = init.headers.Authorization.slice(7).split(".")[1];
      return Response.json({ id: JSON.parse(Buffer.from(token, "base64url").toString()).sub });
    },
  });
  // Spend the no-role allowance, which the nurse also draws on before the grant is seen.
  for (let index = 0; index < REMOTE_CHECKS_UNKNOWN_TOTAL; index += 1)
    await verify(legacy(claims({ sub: randomUUID() })), { clientAddress: `198.51.100.${index}` });
  holders = [nurse];
  await assert.rejects(
    verify(legacy(claims({ sub: nurse })), { clientAddress: "203.0.113.80" }),
    VerifierRateLimitedError,
  );
  at += ROLE_HOLDERS_REFRESH_MS;
  assert.equal(await verify(legacy(claims({ sub: nurse, jti: "a" })), { clientAddress: "203.0.113.80" }), nurse);
  // A failed read keeps the nurse's role.
  failing = true;
  at += ROLE_HOLDERS_REFRESH_MS;
  assert.equal(await verify(legacy(claims({ sub: nurse, jti: "b" })), { clientAddress: "203.0.113.80" }), nurse);
});

test("a failed first read is tried again soon, so a brief outage does not hold real desks back", async () => {
  let at = 1_000_000;
  const nurse = randomUUID();
  let reads = 0;
  const verify = createSupabaseAuthenticator(config, {
    now: () => at,
    roleHolders: async () => {
      reads += 1;
      if (reads === 1) throw new Error("database unavailable");
      return [nurse];
    },
    fetch: async (_url, init) => {
      const token = init.headers.Authorization.slice(7).split(".")[1];
      return Response.json({ id: JSON.parse(Buffer.from(token, "base64url").toString()).sub });
    },
  });
  // The first read failed, so the no-role allowance is spent by other accounts.
  for (let index = 0; index < REMOTE_CHECKS_UNKNOWN_TOTAL; index += 1)
    await verify(legacy(claims({ sub: randomUUID() })), { clientAddress: `198.51.100.${index}` });
  await assert.rejects(
    verify(legacy(claims({ sub: nurse })), { clientAddress: "203.0.113.85" }),
    VerifierRateLimitedError,
  );
  assert.equal(reads, 1);
  at += ROLE_HOLDERS_RETRY_MS;
  assert.equal(await verify(legacy(claims({ sub: nurse, jti: "late" })), { clientAddress: "203.0.113.85" }), nurse);
  assert.equal(reads, 2);
});

test("a stalled role read never holds a sign-in check past the verifier's deadline, and is replaced", async () => {
  let at = 1_000_000;
  let reads = 0;
  const subject = randomUUID();
  /** @type {(holders: string[]) => void} */
  let finishFirst;
  const verify = createSupabaseAuthenticator(config, {
    now: () => at,
    timeoutMs: 20,
    roleHolders: () => {
      reads += 1;
      if (reads === 1) return new Promise((resolve) => (finishFirst = resolve));
      return Promise.resolve([subject]);
    },
    fetch: async () => Response.json({ id: subject }),
  });
  const started = Date.now();
  assert.equal(await verify(legacy(claims({ sub: subject })), { clientAddress: "203.0.113.86" }), subject);
  assert.ok(Date.now() - started < 1000);
  // The stalled read is shared, not repeated.
  await verify(legacy(claims({ sub: subject, jti: "again" })), { clientAddress: "203.0.113.86" });
  assert.equal(reads, 1);
  // After a whole refresh period it is abandoned and a new read starts.
  at += ROLE_HOLDERS_REFRESH_MS;
  await verify(legacy(claims({ sub: subject, jti: "later" })), { clientAddress: "203.0.113.86" });
  assert.equal(reads, 2);
  // The abandoned read ending late does not replace the newer list.
  finishFirst([]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  at += 1;
  await verify(legacy(claims({ sub: subject, jti: "after" })), { clientAddress: "203.0.113.86" });
  assert.equal(reads, 2);
});

test("without a role list, only the bootstrap coordinator list counts as having a role", async () => {
  const { verify } = setup({ user: { id: coordinator } });
  for (let index = 0; index < REMOTE_CHECKS_UNKNOWN_TOTAL; index += 1)
    await verify(legacy(claims({ sub: randomUUID() })), { clientAddress: `192.0.2.${index}` }).catch(() => {});
  await assert.rejects(
    verify(legacy(claims({ sub: randomUUID() })), { clientAddress: "192.0.2.200" }),
    VerifierRateLimitedError,
  );
  assert.equal(await verify(legacy(), { clientAddress: "192.0.2.201" }), coordinator);
});

test("requests arriving together share one read of the published keys", async () => {
  const { calls, verify } = setup();
  const tokens = Array.from({ length: 5 }, (_, index) => signed("ES256", "ec-1", claims({ jti: String(index) })));
  assert.deepEqual(await Promise.all(tokens.map((token) => verify(token))), Array(5).fill(coordinator));
  assert.deepEqual(calls, [JWKS]);
});

test("sign-in proves the account only; an account outside the coordinator list still signs in", async () => {
  const { verify } = setup();
  const nurse = randomUUID();
  assert.equal(await verify(signed("ES256", "ec-1", claims({ sub: nurse }))), nurse);
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
  assert.equal(clientAddress(incoming, ["*"]), "203.0.113.9", "* trusts the proxy a host is only reachable through");
  const railway = {
    headers: { "x-real-ip": "203.0.113.9", "x-forwarded-for": "203.0.113.9, 100.64.0.7" },
    socket: { remoteAddress: "100.64.0.8" },
  };
  assert.equal(clientAddress(railway, ["*"]), "203.0.113.9", "X-Real-IP wins over an internal hop");
  assert.equal(clientAddress(railway), "100.64.0.8", "untrusted peers never choose their address");
  const mapped = { headers: { "x-forwarded-for": "203.0.113.9" }, socket: { remoteAddress: "::ffff:10.0.0.2" } };
  assert.equal(clientAddress(mapped, ["10.0.0.2"]), "203.0.113.9");
  assert.equal(clientAddress({ headers: {}, socket: { remoteAddress: "::ffff:10.0.0.2" } }), "10.0.0.2");
  assert.equal(clientAddress({ headers: {}, socket: { remoteAddress: "127.0.0.1" } }), "127.0.0.1");
  assert.equal(clientAddress({ headers: {}, socket: {} }), "unknown");
});

test("a signed token's optional not-before claim must be a finite number no later than now", async () => {
  const at = Date.now();
  const { verify } = setup({ clock: () => at });
  const current = at / 1000;
  for (const nbf of [current + 600, String(current - 60), null, true, []]) {
    await assert.rejects(verify(signed("ES256", "ec-1", claims({ nbf }))), /Unauthorised/);
    await assert.rejects(verify(legacy(claims({ nbf }))), /Unauthorised/);
  }
  for (const extra of [{}, { nbf: current - 60 }, { nbf: current }]) {
    assert.equal(await verify(signed("ES256", "ec-1", claims(extra))), coordinator);
    assert.equal(await verify(legacy(claims(extra))), coordinator);
  }
});

test("a legacy token that expires while remote verification is awaited is refused", async () => {
  let at = Date.now();
  const token = legacy(claims({ exp: Math.floor(at / 1000) + 1 }));
  const verify = createSupabaseAuthenticator(config, {
    now: () => at,
    fetch: async () => {
      at += 2_000;
      return Response.json({ id: coordinator });
    },
  });
  await assert.rejects(verify(token), /Unauthorised/);
});

test("nonfinite numeric JWT dates are refused even with a valid signature", async () => {
  const { verify } = setup();
  for (const field of ["exp", "nbf"]) {
    const body = JSON.stringify(claims({ [field]: 1 })).replace(`"${field}":1`, `"${field}":1e400`);
    const data = `${part({ alg: "ES256", kid: "ec-1" })}.${Buffer.from(body).toString("base64url")}`;
    const signature = sign("sha256", Buffer.from(data), { key: ec.privateKey, dsaEncoding: "ieee-p1363" });
    await assert.rejects(verify(`Bearer ${data}.${signature.toString("base64url")}`), /Unauthorised/);
  }
});

test("a verified token reports when the account last signed in, for the step-up check", async () => {
  const { verify } = setup();
  const signedIn = Math.floor(Date.now() / 1000) - 120;
  const session = {};
  const token = signed(
    "ES256",
    "ec-1",
    claims({
      aal: "aal1",
      session_id: "AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE",
      amr: [
        { method: "password", timestamp: signedIn - 600 },
        { method: "password", timestamp: signedIn },
      ],
    }),
  );
  assert.equal(await verify(token, { session }), coordinator);
  // The session limit counts from the oldest factor, step-up from the newest. The sign-in's own
  // id is what a sign-out names.
  assert.deepEqual(session, {
    signedInAt: signedIn * 1000,
    startedAt: (signedIn - 600) * 1000,
    aal: "aal1",
    sessionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  });
  // A token with no sign-in record leaves the time unknown, so step-up asks again. A session id
  // that is not a UUID is not kept, so it can never name another sign-in.
  const unknown = {};
  await verify(signed("ES256", "ec-1", claims({ session_id: "not-a-session" })), { session: unknown });
  assert.equal(unknown.signedInAt, undefined);
  assert.equal(unknown.startedAt, undefined);
  assert.equal(unknown.sessionId, undefined);
  // A refused token fills nothing.
  const refused = {};
  await assert.rejects(verify(`${token}x`, { session: refused }));
  assert.deepEqual(refused, {});
});

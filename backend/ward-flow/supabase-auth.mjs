// @ts-check
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { VerifierRateLimitedError, VerifierUnavailableError } from "./auth.mjs";
import { APPROVED_SUPABASE_PROJECT, APPROVED_SUPABASE_URL } from "./supabase-config.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISSUER = `${APPROVED_SUPABASE_URL}/auth/v1`;
/** Asymmetric algorithms Supabase signs access tokens with, and how Node verifies each. */
const ALGORITHMS = Object.freeze({
  ES256: { kty: "EC", hash: "sha256", dsaEncoding: "ieee-p1363" },
  RS256: { kty: "RSA", hash: "sha256" },
});
/** The published keys are kept this long, and re-read at most this often when a key is missing. */
const JWKS_TTL_MS = 10 * 60_000;
const JWKS_RETRY_MS = 60_000;
/** A token Supabase confirmed is reused for this long (never past its own expiry). */
const CONFIRMED_TTL_MS = 60_000;
const CONFIRMED_MAX = 1_000;
/**
 * Calls to Supabase's /auth/v1/user per minute, per client address and in total. A token checked
 * against the published keys never counts, so ordinary polling is not limited.
 */
export const REMOTE_CHECKS_PER_ADDRESS = 30;
export const REMOTE_CHECKS_TOTAL = 300;
/**
 * Accounts with no role here (no membership and not a bootstrap coordinator) share this much smaller
 * allowance, apart from the one above. A forger choosing a new random account for every token uses
 * up only this, never the checks real desks need.
 */
export const REMOTE_CHECKS_UNKNOWN_TOTAL = 30;
/**
 * How long the list of accounts holding a role here is reused. At most one database read per
 * period, however many tokens arrive, and a new grant is recognised within this time.
 */
export const ROLE_HOLDERS_REFRESH_MS = 30_000;
/** After a failed read, the next one is tried this soon, so a brief outage does not hold real desks back. */
export const ROLE_HOLDERS_RETRY_MS = 5_000;
const LIMIT_WINDOW_MS = 60_000;
const LIMIT_ADDRESSES_MAX = 10_000;

class InvalidCredentialError extends Error {}

function decodePart(part) {
  try {
    const value = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/** The token's header, claims and signed parts, or null when it is not a three-part JWT. */
function decodeJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
  const header = decodePart(parts[0]);
  const claims = decodePart(parts[1]);
  if (!header || !claims) return null;
  return {
    header,
    claims,
    signed: Buffer.from(`${parts[0]}.${parts[1]}`),
    signature: Buffer.from(parts[2], "base64url"),
  };
}

/** The optional not-before claim restricts a token only when present. No clock tolerance. */
function validTokenTimes(claims, at) {
  const seconds = at / 1000;
  return (
    Number.isFinite(claims.exp) &&
    claims.exp > seconds &&
    (claims.nbf === undefined || (Number.isFinite(claims.nbf) && claims.nbf <= seconds))
  );
}

/**
 * Maps an Authorization header to the signed-in Supabase account's user ID, or throws:
 * InvalidCredentialError (401) for a bad token, VerifierUnavailableError (503) when Supabase cannot be reached and
 * VerifierRateLimitedError (429) when a client address has made too many remote checks.
 *
 * Sign-in proves who the account is, nothing more: which role it holds, if any, is the shared
 * workspace's own record (`store.viewer`), checked on every request.
 *
 * A token is first checked here: shape, validity times and issuer, then its
 * signature against Supabase's published keys (cached). A signed token naming a key that is not in
 * the current list is refused here. Every other token without a usable published key (a legacy
 * shared-secret token, no key ID, an unsupported or unreadable key, or the key list cannot be read)
 * is sent to /auth/v1/user, behind per-address and total limits. Before that call the account is
 * checked against the cached role holders (`roleHolders`) and the bootstrap list: an account with no
 * role here draws on its own small allowance, so made-up accounts cannot crowd out real desks.
 * Malformed, expired, not-yet-valid and wrong-issuer tokens never reach Supabase. A token verified
 * locally stays valid until it expires
 * (Supabase access tokens last an hour), even after sign-out, as with Supabase's own getClaims.
 */
export function createSupabaseAuthenticator(config, dependencies = {}) {
  if (config.supabase?.projectRef !== APPROVED_SUPABASE_PROJECT || config.supabase?.url !== APPROVED_SUPABASE_URL)
    throw new Error("Unapproved Supabase verifier configuration");
  const fetch = dependencies.fetch ?? globalThis.fetch;
  const now = dependencies.now ?? Date.now;
  const timeoutMs = dependencies.timeoutMs ?? 5000;
  const coordinatorIds = new Set(config.coordinatorIds ?? []);
  /** The accounts outside the bootstrap list that hold a role here. A failed read keeps the last list. */
  const loadRoleHolders = dependencies.roleHolders ?? (async () => []);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000) throw new Error("Invalid verifier deadline");

  /** One bounded GET to the approved project. Covers the body read too, not just the headers. */
  async function supabaseGet(path, headers, read) {
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new VerifierUnavailableError("Token verifier unavailable"));
        controller.abort();
      }, timeoutMs);
    });
    try {
      return await Promise.race([
        (async () =>
          read(
            await fetch(`${APPROVED_SUPABASE_URL}${path}`, {
              method: "GET",
              redirect: "error",
              signal: controller.signal,
              headers: { apikey: config.supabase.publishableKey, ...headers },
            }),
          ))(),
        deadline,
      ]);
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }

  const jwks = { keys: new Map(), listed: new Set(), fetchedAt: -Infinity, attemptedAt: -Infinity, pending: null };
  /**
   * The usable published key for a kid, and whether a current key list (younger than the cache
   * lifetime) does not name the kid at all. A key that is listed but unusable here is neither.
   */
  function cachedKey(kid) {
    const current = now() - jwks.fetchedAt < JWKS_TTL_MS;
    return {
      key: current ? (jwks.keys.get(kid) ?? null) : null,
      unlisted: current && !jwks.listed.has(kid),
      fetchedAt: jwks.fetchedAt,
    };
  }
  /**
   * Keys older than the cache lifetime are never used, even when a refresh fails, so a key Supabase
   * has removed stops working. Concurrent requests share one refresh.
   */
  async function publishedKey(kid) {
    const cached = cachedKey(kid);
    if (cached.key) return cached;
    if (jwks.pending) {
      await jwks.pending;
      return cachedKey(kid);
    }
    const at = now();
    if (at - jwks.attemptedAt < JWKS_RETRY_MS) return cached;
    jwks.attemptedAt = at;
    jwks.pending = (async () => {
      try {
        const keys = await supabaseGet("/auth/v1/.well-known/jwks.json", {}, async (response) => {
          if (!response.ok) throw new Error("JWKS unavailable");
          const body = await response.json();
          if (!Array.isArray(body?.keys)) throw new Error("JWKS unavailable");
          const listed = new Set(
            body.keys
              .slice(0, 100)
              .map((jwk) => jwk?.kid)
              .filter((kid) => typeof kid === "string"),
          );
          const next = new Map();
          for (const jwk of body.keys.slice(0, 20)) {
            const alg = jwk?.alg ?? Object.keys(ALGORITHMS).find((name) => ALGORITHMS[name].kty === jwk?.kty);
            if (typeof jwk?.kid !== "string" || !Object.hasOwn(ALGORITHMS, alg) || ALGORITHMS[alg].kty !== jwk.kty)
              continue;
            try {
              next.set(jwk.kid, { alg, key: createPublicKey({ key: jwk, format: "jwk" }) });
            } catch {
              // A key Node cannot read is skipped; tokens signed with it fall back to Supabase.
            }
          }
          return { next, listed };
        });
        jwks.keys = keys.next;
        jwks.listed = keys.listed;
        jwks.fetchedAt = at;
      } catch {
        // Keys stay usable until the cache lifetime ends. After that, tokens fall back to Supabase.
      } finally {
        jwks.pending = null;
      }
    })();
    await jwks.pending;
    return cachedKey(kid);
  }

  const confirmed = new Map();
  const holders = { ids: new Set(), nextReadAt: -Infinity, pending: null, startedAt: -Infinity };
  /** Start a read. Only the latest read may change the list, so an abandoned one that ends late is ignored. */
  function startRead() {
    /** @type {Promise<void>} */
    const read = Promise.resolve()
      .then(() => loadRoleHolders())
      .then(
        (ids) => {
          if (holders.pending !== read) return;
          holders.ids = new Set(Array.isArray(ids) ? ids : []);
          holders.nextReadAt = now() + ROLE_HOLDERS_REFRESH_MS;
        },
        () => {
          if (holders.pending === read) holders.nextReadAt = now() + ROLE_HOLDERS_RETRY_MS;
        },
      )
      .finally(() => {
        if (holders.pending === read) holders.pending = null;
      });
    holders.pending = read;
    holders.startedAt = now();
  }
  /**
   * Read the role holders at most once per refresh period, shared by every request waiting on it.
   * A request waits no longer than the verifier's deadline, then uses the last list it has. A read
   * still running after a whole refresh period is abandoned and a new one started.
   */
  async function holdsRole(subject) {
    if (coordinatorIds.has(subject)) return true;
    const stalled = holders.pending !== null && now() - holders.startedAt >= ROLE_HOLDERS_REFRESH_MS;
    if ((holders.pending === null && now() >= holders.nextReadAt) || stalled) startRead();
    if (holders.pending) {
      let timer;
      await Promise.race([holders.pending, new Promise((resolve) => (timer = setTimeout(resolve, timeoutMs)))]);
      clearTimeout(timer);
    }
    return holders.ids.has(subject);
  }
  const limits = { windowStart: -Infinity, total: 0, unknown: 0, addresses: new Map() };
  function startWindow() {
    const at = now();
    if (at - limits.windowStart < LIMIT_WINDOW_MS) return;
    limits.windowStart = at;
    limits.total = 0;
    limits.unknown = 0;
    limits.addresses.clear();
  }
  function addressKey(address) {
    return limits.addresses.size < LIMIT_ADDRESSES_MAX || limits.addresses.has(address) ? address : "overflow";
  }
  /**
   * Charged before the account lookup, refused or not, so every lookup counts against the address
   * and an address over its limit costs no database read.
   */
  function chargeAddress(address) {
    startWindow();
    const key = addressKey(address);
    const used = limits.addresses.get(key) ?? 0;
    if (used >= REMOTE_CHECKS_PER_ADDRESS) return false;
    limits.addresses.set(key, used + 1);
    return true;
  }
  /** A claimed subject is unverified, so it picks the pool but never has a budget of its own to spend. */
  function allowRemoteCheck(known) {
    startWindow();
    if (known ? limits.total >= REMOTE_CHECKS_TOTAL : limits.unknown >= REMOTE_CHECKS_UNKNOWN_TOTAL) return false;
    if (known) limits.total += 1;
    else limits.unknown += 1;
    return true;
  }

  async function remoteCheck(authorization) {
    return supabaseGet("/auth/v1/user", { Authorization: authorization }, async (response) => {
      if (response.status === 401 || response.status === 403) return null;
      if (!response.ok) throw new VerifierUnavailableError("Token verifier unavailable");
      const user = await response.json();
      if (!UUID.test(user?.id ?? "")) throw new VerifierUnavailableError("Token verifier unavailable");
      return user.id.toLowerCase();
    });
  }

  /**
   * When this account last signed in with its password or another factor: the newest `amr`
   * timestamp, in milliseconds. A refreshed token keeps it, so it answers "how recently did this
   * person prove it is them" for step-up (feature 9). Undefined when the token carries none.
   */
  const signedInAt = (claims) => {
    const times = Array.isArray(claims?.amr)
      ? claims.amr.map((entry) => entry?.timestamp).filter((value) => Number.isFinite(value))
      : [];
    return times.length ? Math.max(...times) * 1000 : undefined;
  };
  /**
   * `session`, when given, is filled once the token is verified: `signedInAt` (above) and `aal`.
   * The subject is still the only return value.
   */
  return async (authorization, { clientAddress = "unknown", session = null } = {}) => {
    const verified = (userId, claims) => {
      if (session) {
        session.signedInAt = signedInAt(claims);
        session.aal = typeof claims?.aal === "string" ? claims.aal : undefined;
      }
      return userId;
    };
    if (!/^Bearer [^\s]+$/.test(authorization ?? "") || authorization.length > 16_384)
      throw new InvalidCredentialError("Unauthorised");
    const jwt = decodeJwt(authorization.slice(7));
    const claims = jwt?.claims;
    const subject = typeof claims?.sub === "string" ? claims.sub.toLowerCase() : "";
    // Free checks first: nothing below runs, and nothing leaves this server, for a token that is
    // malformed, expired or from another project.
    if (!jwt || !validTokenTimes(claims, now()) || claims.iss !== ISSUER || !UUID.test(subject))
      throw new InvalidCredentialError("Unauthorised");
    const algorithm = ALGORITHMS[jwt.header.alg];
    if (Object.hasOwn(ALGORITHMS, jwt.header.alg) && typeof jwt.header.kid === "string") {
      const { key: published, unlisted, fetchedAt } = await publishedKey(jwt.header.kid);
      // A current key list that does not name this kid means Supabase does not sign with it, so the
      // token is not sent to Supabase. Refused outright when the list was read after the token was
      // issued (a removed key, or a made-up one). Otherwise answered as unavailable, so a client
      // retries once the list catches up with a new key.
      if (!published && unlisted) {
        const issuedAt = typeof claims.iat === "number" ? claims.iat * 1000 : -Infinity;
        if (fetchedAt >= issuedAt) throw new InvalidCredentialError("Unauthorised");
        throw new VerifierUnavailableError("Signing key not published");
      }
      if (published) {
        const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
        let valid = false;
        try {
          valid =
            published.alg === jwt.header.alg &&
            verifySignature(
              algorithm.hash,
              jwt.signed,
              algorithm.dsaEncoding ? { key: published.key, dsaEncoding: algorithm.dsaEncoding } : published.key,
              jwt.signature,
            );
        } catch {
          valid = false;
        }
        // Validity times are checked again after waiting for the published keys.
        if (
          !valid ||
          !validTokenTimes(claims, now()) ||
          !audience.includes("authenticated") ||
          claims.role !== "authenticated"
        )
          throw new InvalidCredentialError("Unauthorised");
        return verified(subject, claims);
      }
    }
    const tokenKey = createHash("sha256").update(authorization).digest("hex");
    const known = confirmed.get(tokenKey);
    if (known && known.until > now()) return verified(known.userId, claims);
    confirmed.delete(tokenKey);
    if (!chargeAddress(clientAddress)) throw new VerifierRateLimitedError("Too many sign-in checks");
    if (!allowRemoteCheck(await holdsRole(subject))) throw new VerifierRateLimitedError("Too many sign-in checks");
    let userId;
    try {
      userId = await remoteCheck(authorization);
    } catch {
      throw new VerifierUnavailableError("Token verifier unavailable");
    }
    // The server-returned account must be the token's own subject.
    if (!userId || userId !== subject || !validTokenTimes(claims, now()))
      throw new InvalidCredentialError("Unauthorised");
    if (confirmed.size >= CONFIRMED_MAX) confirmed.delete(confirmed.keys().next().value);
    confirmed.set(tokenKey, { userId, until: Math.min(now() + CONFIRMED_TTL_MS, claims.exp * 1000) });
    return verified(userId, claims);
  };
}

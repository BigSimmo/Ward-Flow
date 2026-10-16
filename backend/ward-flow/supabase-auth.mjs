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
 * is sent to /auth/v1/user, behind per-address and total limits. Malformed, expired, not-yet-valid
 * and wrong-issuer tokens never reach Supabase. A token verified locally stays
 * valid until it expires
 * (Supabase access tokens last an hour), even after sign-out, as with Supabase's own getClaims.
 */
export function createSupabaseAuthenticator(config, dependencies = {}) {
  if (config.supabase?.projectRef !== APPROVED_SUPABASE_PROJECT || config.supabase?.url !== APPROVED_SUPABASE_URL)
    throw new Error("Unapproved Supabase verifier configuration");
  const fetch = dependencies.fetch ?? globalThis.fetch;
  const now = dependencies.now ?? Date.now;
  const timeoutMs = dependencies.timeoutMs ?? 5000;
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
  const limits = { windowStart: -Infinity, total: 0, addresses: new Map() };
  function allowRemoteCheck(address) {
    const at = now();
    if (at - limits.windowStart >= LIMIT_WINDOW_MS) {
      limits.windowStart = at;
      limits.total = 0;
      limits.addresses.clear();
    }
    const key = limits.addresses.size < LIMIT_ADDRESSES_MAX || limits.addresses.has(address) ? address : "overflow";
    const used = limits.addresses.get(key) ?? 0;
    // A claimed subject is unverified: never let one source spend another source's account budget.
    if (used >= REMOTE_CHECKS_PER_ADDRESS || limits.total >= REMOTE_CHECKS_TOTAL) return false;
    limits.addresses.set(key, used + 1);
    limits.total += 1;
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

  return async (authorization, { clientAddress = "unknown" } = {}) => {
    if (!/^Bearer [^\s]+$/.test(authorization ?? "") || authorization.length > 16_384)
      throw new InvalidCredentialError("Unauthorised");
    const jwt = decodeJwt(authorization.slice(7));
    const claims = jwt?.claims;
    const subject = typeof claims?.sub === "string" ? claims.sub.toLowerCase() : "";
    // Free checks first: nothing below runs, and nothing leaves this server, for a token that is
    // malformed, expired or from another project.
    if (
      !jwt ||
      !validTokenTimes(claims, now()) ||
      claims.iss !== ISSUER ||
      !UUID.test(subject)
    )
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
        return subject;
      }
    }
    const tokenKey = createHash("sha256").update(authorization).digest("hex");
    const known = confirmed.get(tokenKey);
    if (known && known.until > now()) return known.userId;
    confirmed.delete(tokenKey);
    if (!allowRemoteCheck(clientAddress)) throw new VerifierRateLimitedError("Too many sign-in checks");
    let userId;
    try {
      userId = await remoteCheck(authorization);
    } catch {
      throw new VerifierUnavailableError("Token verifier unavailable");
    }
    // The server-returned account must be the token's own subject.
    if (!userId || userId !== subject || !validTokenTimes(claims, now())) throw new InvalidCredentialError("Unauthorised");
    if (confirmed.size >= CONFIRMED_MAX) confirmed.delete(confirmed.keys().next().value);
    confirmed.set(tokenKey, { userId, until: Math.min(now() + CONFIRMED_TTL_MS, claims.exp * 1000) });
    return userId;
  };
}

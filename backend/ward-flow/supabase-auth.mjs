import { createHash } from "node:crypto";
import { VerifierUnavailableError } from "./auth.mjs";
import { APPROVED_SUPABASE_PROJECT, APPROVED_SUPABASE_URL } from "./supabase-config.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class InvalidCredentialError extends Error {}

export function createSupabaseAuthenticator(config, dependencies = {}) {
  if (config.supabase?.projectRef !== APPROVED_SUPABASE_PROJECT || config.supabase?.url !== APPROVED_SUPABASE_URL)
    throw new Error("Unapproved Supabase verifier configuration");
  const fetch = dependencies.fetch ?? globalThis.fetch;
  const timeoutMs = dependencies.timeoutMs ?? 5000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000) throw new Error("Invalid verifier deadline");
  const cacheTtlMs = dependencies.cacheTtlMs ?? 20_000;
  const tokenCache = new Map();

  return async (authorization) => {
    if (!/^Bearer [^\s]+$/.test(authorization ?? "") || authorization.length > 16_384) throw new Error("Unauthorised");

    const cacheKey = createHash("sha256").update(authorization).digest("hex");
    if (cacheTtlMs > 0) {
      const cached = tokenCache.get(cacheKey);
      if (cached) {
        if (cached.expiresAt > Date.now()) {
          return cached.userId;
        }
        tokenCache.delete(cacheKey);
      }
    }

    const controller = new AbortController();
    let timer;
    // Covers response-body reads too; fetch resolving headers does not end the deadline.
    const deadline = new Promise((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new VerifierUnavailableError("Token verifier unavailable"));
        controller.abort();
      }, timeoutMs);
    });
    try {
      const result = await Promise.race([
        (async () => {
          const response = await fetch(`${APPROVED_SUPABASE_URL}/auth/v1/user`, {
            method: "GET",
            redirect: "error",
            signal: controller.signal,
            headers: { apikey: config.supabase.publishableKey, Authorization: authorization },
          });
          if (response.status === 401 || response.status === 403) return null;
          if (!response.ok) throw new VerifierUnavailableError("Token verifier unavailable");
          const user = await response.json();
          if (!UUID.test(user?.id ?? "")) throw new VerifierUnavailableError("Token verifier unavailable");
          const userId = user.id.toLowerCase();
          if (!config.coordinatorIds.includes(userId)) throw new InvalidCredentialError("Unauthorised");

          if (cacheTtlMs > 0) {
            const now = Date.now();
            for (const [k, e] of tokenCache) {
              if (e.expiresAt <= now) tokenCache.delete(k);
            }
            while (tokenCache.size >= 128) {
              const oldestKey = tokenCache.keys().next().value;
              if (!oldestKey) break;
              tokenCache.delete(oldestKey);
            }
            tokenCache.set(cacheKey, { userId, expiresAt: now + cacheTtlMs });
          }

          return userId;
        })(),
        deadline,
      ]);
      if (!result) throw new InvalidCredentialError("Unauthorised");
      return result;
    } catch (error) {
      if (error instanceof InvalidCredentialError) throw error;
      throw new VerifierUnavailableError("Token verifier unavailable");
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  };
}

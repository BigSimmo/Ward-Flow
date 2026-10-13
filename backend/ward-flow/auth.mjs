// Token problems the caller can fix by signing in again. Anything else (JWKS timeout,
// unreachable or malformed key set) is an identity-provider outage, not a bad credential.
const CREDENTIAL_FAILURES = new Set([
  "ERR_JOSE_ALG_NOT_ALLOWED",
  "ERR_JOSE_NOT_SUPPORTED",
  "ERR_JWKS_MULTIPLE_MATCHING_KEYS",
  "ERR_JWKS_NO_MATCHING_KEY",
  "ERR_JWS_INVALID",
  "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
  "ERR_JWT_CLAIM_VALIDATION_FAILED",
  "ERR_JWT_EXPIRED",
  "ERR_JWT_INVALID",
]);

export class VerifierUnavailableError extends Error {}

/**
 * A guest in this tenant: `acct` is 1 for guests when the optional claim is issued, and `idp` is
 * present only when the account signed in through another identity provider (its home tenant or
 * a consumer account). A member's token has no `idp`, or one naming this tenant.
 */
export function isGuestAccount(payload, tenant, issuer) {
  if (payload.acct === 1 || payload.acct === "1") return true;
  if (payload.idp === undefined) return false;
  return ![issuer, `https://sts.windows.net/${tenant}/`].includes(payload.idp);
}

export async function createAuthenticator(config, dependencies = {}) {
  const { createRemoteJWKSet, jwtVerify } = dependencies.jose ?? (await import("jose"));
  const issuer = `https://login.microsoftonline.com/${config.tenant}/v2.0`;
  const keys =
    dependencies.keys ??
    createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${config.tenant}/discovery/v2.0/keys`), {
      timeoutDuration: 5000,
      cooldownDuration: 30_000,
    });
  return async (authorization) => {
    if (!/^Bearer [^\s]+$/.test(authorization ?? "") || authorization.length > 16_384) throw new Error("Unauthorised");
    let payload;
    try {
      ({ payload } = await jwtVerify(authorization.slice(7), keys, {
        issuer,
        audience: config.audience,
        algorithms: ["RS256"],
        requiredClaims: ["exp", "iat", "oid", "tid"],
        clockTolerance: 5,
      }));
    } catch (error) {
      if (CREDENTIAL_FAILURES.has(error?.code)) throw new Error("Unauthorised");
      throw new VerifierUnavailableError("Token verifier unavailable");
    }
    const isUserAllowed =
      config.allowTenantUsers || payload.oid === config.allowedObjectId || config.coordinatorIds?.includes(payload.oid);
    if (
      payload.tid !== config.tenant ||
      !isUserAllowed ||
      typeof payload.scp !== "string" ||
      !payload.scp.split(" ").includes("WardFlow.Access")
    )
      throw new Error("Unauthorised");
    // Tenant-wide mode admits accounts nobody named, so it must narrow who and what by claims:
    // a guest (B2B) account carries `acct: 1` or an `idp` naming its home tenant, and the token
    // must have been issued to an approved client app (`azp` in v2 tokens, `appid` in v1).
    if (config.allowTenantUsers) {
      if (isGuestAccount(payload, config.tenant, issuer)) throw new Error("Unauthorised");
      const client = typeof payload.azp === "string" ? payload.azp : payload.appid;
      if (typeof client !== "string" || !config.allowedClientIds?.includes(client.toLowerCase()))
        throw new Error("Unauthorised");
    }
    return payload.oid;
  };
}

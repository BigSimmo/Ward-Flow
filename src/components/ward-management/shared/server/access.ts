import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * The minimal guard Josh asked for (feature 3): one shared access code, typed once per browser,
 * exchanged for a signed HttpOnly cookie that lasts 12 hours. It keeps the shared API off the open
 * internet. It is not authentication: everyone with the code is the same anonymous user, and the
 * role still comes from the route. Changing the code signs every browser out.
 */

export const SHARED_ACCESS_COOKIE = "ward_flow_shared";
export const SHARED_ACCESS_TTL_SECONDS = 12 * 60 * 60;
const TOKEN_PREFIX = "v1";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function signature(accessCode: string, expiresAt: number): string {
  return createHmac("sha256", accessCode).update(`ward-flow-shared:${TOKEN_PREFIX}:${expiresAt}`).digest("base64url");
}

/** Constant-time comparison of a typed code with the configured one (hashed first, so lengths match). */
export function accessCodeMatches(typed: unknown, accessCode: string): boolean {
  if (typeof typed !== "string" || typed.length === 0 || typed.length > 512) return false;
  return timingSafeEqual(digest(typed), digest(accessCode));
}

export function issueAccessToken(accessCode: string, nowSeconds: number): string {
  const expiresAt = nowSeconds + SHARED_ACCESS_TTL_SECONDS;
  return `${TOKEN_PREFIX}.${expiresAt}.${signature(accessCode, expiresAt)}`;
}

export function accessTokenValid(token: string | undefined, accessCode: string, nowSeconds: number): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return false;
  const expiresAt = Number(parts[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= nowSeconds) return false;
  if (expiresAt > nowSeconds + SHARED_ACCESS_TTL_SECONDS) return false;
  return timingSafeEqual(digest(parts[2] ?? ""), digest(signature(accessCode, expiresAt)));
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return undefined;
}

export function accessCookieHeader(token: string, secure: boolean): string {
  return [
    `${SHARED_ACCESS_COOKIE}=${token}`,
    "Path=/api/ward-flow/shared",
    `Max-Age=${SHARED_ACCESS_TTL_SECONDS}`,
    "HttpOnly",
    "SameSite=Strict",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

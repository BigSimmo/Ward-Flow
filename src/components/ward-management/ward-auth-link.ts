/**
 * The parts of shared sign-in that run on every page: the stored-session key, the error type and
 * erasing a recovery link from the address bar. They make no network call. The Supabase adapter
 * itself (`ward-supabase-auth.ts`) loads only when shared mode boots, so the demo's first load does
 * not carry it.
 */
export const WARD_AUTH_STORAGE_KEY = "ward-flow:auth:zakzoemeedfepxcstsou:v1";
export class WardAuthError extends Error {
  constructor(
    public readonly kind: "credentials" | "session" | "unavailable" | "cancelled",
    message: string,
  ) {
    super(message);
  }
}
export type WardAuthUser = { id: string };
export type WardAuthSession = {
  access_token: string;
  refresh_token: string;
  expiresAt: number;
  recovery: boolean;
  user?: WardAuthUser;
};
export function consumeRecoveryFragment(
  location: Pick<Location, "hash" | "pathname" | "search">,
  replace: (url: string) => void,
): WardAuthSession | null {
  const parts = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (
    !["access_token", "refresh_token", "error", "error_code", "error_description", "type"].some((key) => parts.has(key))
  )
    return null;
  replace(location.pathname + location.search);
  const failed = ["error", "error_code", "error_description"].some((key) => parts.has(key));
  if (parts.get("type") === "signup" && !failed) return null;
  const accessToken = parts.get("access_token");
  const refreshToken = parts.get("refresh_token");
  if (failed || parts.get("type") !== "recovery" || !accessToken || !refreshToken)
    throw new WardAuthError("session", "The recovery link is invalid or expired. Request a new link.");
  const expires = Number(parts.get("expires_in"));
  if (!Number.isFinite(expires) || expires <= 0)
    throw new WardAuthError("session", "The recovery link is invalid or expired. Request a new link.");
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expiresAt: Date.now() + expires * 1000,
    recovery: true,
  };
}

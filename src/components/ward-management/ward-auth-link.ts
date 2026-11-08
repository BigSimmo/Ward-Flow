/**
 * The parts of shared sign-in that run on every page: the stored-session key, the error type and
 * taking a recovery link off the address bar. They make no network call. The Supabase adapter
 * itself (`ward-supabase-auth.ts`) loads only when shared mode boots, so the demo's first load does
 * not carry it.
 */
export const WARD_AUTH_STORAGE_KEY = "ward-flow:auth:zakzoemeedfepxcstsou:v1";
/**
 * SEC-2 (Josh, 6 Nov 2026): the PKCE code verifier of the last recovery request, in this browser's
 * local storage so the emailed link can open in a new tab. Only this browser holds it, so a link
 * opened anywhere else (or a link someone else asked for) cannot sign this tab in. One use, and it
 * lapses with the link.
 */
export const WARD_RECOVERY_VERIFIER_KEY = "ward-flow:auth:recovery-verifier:v1";
/** How long a recovery request's verifier is kept: the recovery link's own lifetime. */
export const WARD_RECOVERY_VERIFIER_LIFETIME_MS = 60 * 60 * 1000;
/** A 429 from the sign-in service: the request was refused for rate, nothing was spent. */
export const WARD_AUTH_BUSY_MESSAGE = "Sign-in is busy right now. Wait a moment and try again.";
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
/** A recovery link opened in the browser that asked for it: the code and this browser's verifier. */
export type WardRecoveryLink = { code: string; verifier: string };
type LinkStorage = Pick<Storage, "getItem" | "removeItem">;

export const WARD_RECOVERY_LINK_INVALID = "The recovery link is invalid or expired. Request a new link.";
const WARD_RECOVERY_LINK_ELSEWHERE =
  "Open this link on the device and browser where you asked for it, or ask for a new link here.";

/** This browser's local storage, or nothing when the browser blocks it. Never throws. */
export const deviceStorage = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    window.localStorage.setItem(key, value);
  },
  removeItem(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage blocked: nothing was kept there.
    }
  },
};

const LINK_QUERY_KEYS = ["code", "error", "error_code", "error_description"] as const;
const FRAGMENT_KEYS = ["access_token", "refresh_token", "error", "error_code", "error_description", "type"] as const;

/**
 * Takes the stored verifier once: it is removed whatever happens next. "none" means this browser
 * never asked for a link (or already used it); "expired" means it asked too long ago.
 */
function takeVerifier(storage: LinkStorage | null | undefined, now: number): string | "none" | "expired" {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(WARD_RECOVERY_VERIFIER_KEY) ?? null;
    storage?.removeItem(WARD_RECOVERY_VERIFIER_KEY);
  } catch {
    return "none";
  }
  if (!raw) return "none";
  try {
    const row = JSON.parse(raw) as { verifier?: unknown; createdAt?: unknown };
    if (typeof row.verifier !== "string" || !/^[A-Za-z0-9._~-]{43,128}$/.test(row.verifier)) return "none";
    const age = typeof row.createdAt === "number" ? now - row.createdAt : NaN;
    return age >= 0 && age <= WARD_RECOVERY_VERIFIER_LIFETIME_MS ? row.verifier : "expired";
  } catch {
    return "none";
  }
}

/**
 * Reads and erases a recovery link from the address before anything else runs. A PKCE link
 * (`?code=`) returns the code with this browser's stored verifier; the exchange itself happens in
 * the adapter. The old implicit link (`#access_token=…&type=recovery`) is refused: it would sign
 * this tab in to whichever account the link belongs to. A signup confirmation is erased quietly.
 */
export function consumeRecoveryLink(
  location: Pick<Location, "hash" | "pathname" | "search">,
  replace: (url: string) => void,
  storage: LinkStorage | null | undefined,
  now = Date.now(),
): WardRecoveryLink | null {
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ""));
  // `location` may be the live address, which `replace` changes, so read everything first.
  const params = new URLSearchParams(location.search);
  const query = new URLSearchParams(location.search);
  const inFragment = FRAGMENT_KEYS.some((key) => fragment.has(key));
  const inQuery = query.has("code") || query.has("error_code") || query.has("error_description");
  if (!inFragment && !inQuery) return null;
  if (inQuery) for (const key of LINK_QUERY_KEYS) query.delete(key);
  const rest = query.toString();
  const search = inQuery ? (rest ? "?" + rest : "") : location.search;
  const hash = inFragment ? "" : location.hash;
  replace(location.pathname + search + hash);
  const fragmentFailed = ["error", "error_code", "error_description"].some((key) => fragment.has(key));
  if (inFragment && (fragmentFailed || fragment.get("type") !== "signup"))
    throw new WardAuthError("session", WARD_RECOVERY_LINK_INVALID);
  if (!inQuery) return null;
  const code = params.get("code");
  if (!code || ["error", "error_code", "error_description"].some((key) => params.has(key)))
    throw new WardAuthError("session", WARD_RECOVERY_LINK_INVALID);
  const verifier = takeVerifier(storage, now);
  if (verifier === "none") throw new WardAuthError("session", WARD_RECOVERY_LINK_ELSEWHERE);
  if (verifier === "expired") throw new WardAuthError("session", WARD_RECOVERY_LINK_INVALID);
  return { code, verifier };
}

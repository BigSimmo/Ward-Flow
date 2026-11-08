/**
 * Local admission for the public front-door account check. A pass does not grant a workspace role;
 * Supabase still decides whether the account token is accepted. No membership lookup belongs here.
 *
 * These bounds are per process: 30 checks/client/minute, 300 total/minute and eight pending checks.
 * Restarts reset them; multiple processes have independent budgets. No requests wait in a queue.
 *
 * Without a server-verified client address, the budget is keyed on the token's claimed subject, not
 * one shared bucket, so a script sending fake tokens cannot spend every real user's allowance
 * (review 8 Nov 2026). The claim is unverified, so it only picks a bucket; it never grants anything.
 * An account the provider accepted recently skips the all-clients cap and has a small reserve of
 * pending checks, so a flood of fake tokens cannot lock out staff who already signed in.
 */
const CHECKS_PER_CLIENT = 30;
const CHECKS_TOTAL = 300;
const CHECKS_IN_FLIGHT = 8;
const KNOWN_ACCOUNT_IN_FLIGHT_RESERVE = 4;
const KNOWN_ACCOUNT_MS = 12 * 60 * 60_000;
const KNOWN_ACCOUNT_LIMIT = 5_000;
const WINDOW_MS = 60_000;
const TIMEOUT_MS = 8_000;
type AccountCheck = { id: string } | "malformed" | "rate-limited" | "refused" | "unavailable";

/** Shape only: legacy HS256 tokens without a kid must still reach Supabase's authoritative check. */
function plausibleToken(token: string): boolean {
  if (!token || token.length > 8192) return false;
  const parts = token.split(".");
  if (
    parts.length !== 3 ||
    parts.some(
      (part) => !/^[A-Za-z0-9_-]+$/.test(part) || Buffer.from(part, "base64url").toString("base64url") !== part,
    )
  )
    return false;
  try {
    return parts.slice(0, 2).every((part) => {
      const value: unknown = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
      return value !== null && typeof value === "object" && !Array.isArray(value);
    });
  } catch {
    return false;
  }
}

/** The token's claimed subject, unverified: used only to choose a rate-limit bucket. */
function claimedSubject(token: string): string | null {
  try {
    const payload: unknown = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    const sub = (payload as { sub?: unknown } | null)?.sub;
    return typeof sub === "string" && sub.length > 0 && sub.length <= 64 ? sub : null;
  } catch {
    return null;
  }
}

function configuredOrigin(): string | null {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_WARD_SUPABASE_URL ?? "");
    return url.protocol === "https:" && /^[a-z0-9]+\.supabase\.co$/.test(url.hostname) ? url.origin : null;
  } catch {
    return null;
  }
}

export function createFrontDoorVerifier(dependencies: { fetch?: typeof fetch; now?: () => number } = {}) {
  const send: typeof fetch = dependencies.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const now = dependencies.now ?? (() => Date.now());
  let windowStart = -Infinity;
  let total = 0;
  let inFlight = 0;
  // At most CHECKS_TOTAL unknown-account entries can be charged in a window; known accounts add at
  // most KNOWN_ACCOUNT_LIMIT more.
  const clients = new Map<string, number>();
  // Subjects the provider accepted, with when that acceptance stops counting.
  const knownAccounts = new Map<string, number>();

  /**
   * A client identity may be supplied only from server-verified ingress metadata, never raw request
   * headers. The Next route has no verified socket/proxy fact, so it buckets by claimed subject.
   * Missing metadata still permits a bounded sign-in; rotating XFF cannot create new allowances, and
   * rotating fake subjects is held by the all-clients cap, which known accounts skip.
   */
  function rememberAccount(subject: string, at: number) {
    if (!knownAccounts.has(subject) && knownAccounts.size >= KNOWN_ACCOUNT_LIMIT)
      for (const [entry, until] of knownAccounts) if (until <= at) knownAccounts.delete(entry);
    if (knownAccounts.has(subject) || knownAccounts.size < KNOWN_ACCOUNT_LIMIT)
      knownAccounts.set(subject, at + KNOWN_ACCOUNT_MS);
  }

  return async (token: string, verifiedClientAddress?: string): Promise<AccountCheck> => {
    if (!plausibleToken(token)) return "malformed";
    const publishableKey = process.env.NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY ?? "";
    const origin = configuredOrigin();
    if (!origin || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) return "unavailable";
    const at = now();
    if (at < windowStart || at - windowStart >= WINDOW_MS) {
      windowStart = at;
      total = 0;
      clients.clear();
    }
    const subject = claimedSubject(token);
    const client =
      verifiedClientAddress && verifiedClientAddress.length <= 64
        ? verifiedClientAddress
        : subject
          ? `subject:${subject}`
          : "unknown";
    const known = subject !== null && (knownAccounts.get(subject) ?? -Infinity) > at;
    const used = clients.get(client) ?? 0;
    if (used >= CHECKS_PER_CLIENT) return "rate-limited";
    if (
      known
        ? inFlight >= CHECKS_IN_FLIGHT + KNOWN_ACCOUNT_IN_FLIGHT_RESERVE
        : total >= CHECKS_TOTAL || inFlight >= CHECKS_IN_FLIGHT
    )
      return "rate-limited";
    clients.set(client, used + 1);
    if (!known) total += 1;
    inFlight += 1;

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<AccountCheck>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve("unavailable");
      }, TIMEOUT_MS);
    });
    const operation = (async (): Promise<AccountCheck> => {
      try {
        const response = await send(`${origin}/auth/v1/user`, {
          headers: { apikey: publishableKey, authorization: `Bearer ${token}` },
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        });
        if (response.status === 401 || response.status === 403) return "refused";
        if (!response.ok) return "unavailable";
        const user = (await response.json()) as { id?: unknown; is_anonymous?: unknown } | null;
        // An anonymous Supabase account is not a staff sign-in: refused, and never remembered.
        if (typeof user?.id !== "string" || !user.id || user.is_anonymous === true) return "refused";
        if (user.id === subject) rememberAccount(user.id, now());
        return { id: user.id };
      } catch {
        return "unavailable";
      } finally {
        // Native fetch aborts its body reader too. Retain the permit until actual settlement: a
        // non-cooperative replacement must not accumulate abandoned work after caller timeouts.
        inFlight -= 1;
      }
    })();
    try {
      return await Promise.race([operation, deadline]);
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  };
}

export const checkFrontDoorAccount = createFrontDoorVerifier();

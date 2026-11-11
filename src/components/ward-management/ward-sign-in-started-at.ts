// Ward Flow's own copy of `signInStartedAt` in @/lib/front-door-pass, which the session route uses
// for the account pass. Kept separate so the ward's first load does not carry the front door's
// signing code, and because Ward Flow may not import a new shared module (tests/ward-flow-seam).
// tests/sign-in-started-at.test.ts runs the same cases against both copies.
/**
 * When a sign-in began, in milliseconds: the oldest `amr` factor time in a Supabase access token,
 * as the backend counts it (`startedAt` in backend/ward-flow/supabase-auth.mjs). A refresh or a later
 * factor never moves it, so the 12-hour session limit (ISM-0428) counts from here. `null` when the
 * token cannot be read or carries no factor time. The signature is not checked: callers use this only
 * to show or shorten a limit the server enforces itself.
 */
export function signInStartedAt(token: string): number | null {
  try {
    const part = (token.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(part), (char) => char.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes));
    const times = (Array.isArray(claims?.amr) ? claims.amr : [])
      .map((entry: { timestamp?: unknown }) => entry?.timestamp)
      .filter((value: unknown): value is number => Number.isFinite(value));
    return times.length ? Math.min(...times) * 1000 : null;
  } catch {
    return null;
  }
}

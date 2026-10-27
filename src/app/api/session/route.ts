import type { NextRequest } from "next/server";

import {
  ACCOUNT_PASS_HOURS,
  DEMO_PASS_HOURS,
  FRONT_DOOR_MARKER_COOKIE,
  FRONT_DOOR_PASS_COOKIE,
  demoCodeMatches,
  frontDoorRequired,
  frontDoorSecret,
  issuePass,
} from "@/lib/front-door-pass";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The front door's pass (see `@/lib/front-door-pass`). POST checks a Supabase sign-in, or a demo
 * code on the public demo, and sets the pass. DELETE ends it at sign-out, an idle sign-out and the
 * sign-in limit. Both answer 204 and do nothing while the `WARD_FRONT_DOOR` switch is off.
 *
 * The proxy's CSRF guard already refuses a cross-site POST or DELETE here.
 */

const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const answer = (status: number, error?: string) =>
  error ? Response.json({ error }, { status, headers: NO_STORE }) : new Response(null, { status, headers: NO_STORE });

/** A few wrong tries per address, then a pause, so a demo code cannot be guessed by brute force. */
const WRONG_TRY_LIMIT = 10;
const WRONG_TRY_WINDOW_MS = 10 * 60_000;
const wrongTries = new Map<string, { count: number; since: number }>();
function tooManyTries(address: string, now: number): boolean {
  const entry = wrongTries.get(address);
  if (!entry || now - entry.since > WRONG_TRY_WINDOW_MS) return false;
  return entry.count >= WRONG_TRY_LIMIT;
}
function countWrongTry(address: string, now: number) {
  const entry = wrongTries.get(address);
  if (!entry || now - entry.since > WRONG_TRY_WINDOW_MS) wrongTries.set(address, { count: 1, since: now });
  else entry.count += 1;
  // Keep the table small on a long-running server.
  if (wrongTries.size > 5_000) wrongTries.clear();
}

/** When the sign-in's 12-hour limit ends, from the token's first sign-in time, as the backend counts it. */
function signInEndsAt(token: string): number | null {
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    const times = (Array.isArray(claims?.amr) ? claims.amr : [])
      .map((entry: { timestamp?: unknown }) => entry?.timestamp)
      .filter((value: unknown): value is number => Number.isFinite(value));
    return times.length ? Math.min(...times) * 1000 + ACCOUNT_PASS_HOURS * 3_600_000 : null;
  } catch {
    return null;
  }
}

/** The site's own Supabase project, the one the app signs in with: an https `*.supabase.co` origin. */
function supabaseOrigin(): string | null {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_WARD_SUPABASE_URL ?? "");
    return url.protocol === "https:" && /^[a-z0-9]+\.supabase\.co$/.test(url.hostname) ? url.origin : null;
  } catch {
    return null;
  }
}

/** The account a Supabase access token belongs to, checked with Supabase itself. */
async function checkedAccount(token: string): Promise<{ id: string } | "refused" | "unavailable"> {
  const publishableKey = process.env.NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY ?? "";
  const origin = supabaseOrigin();
  if (!origin || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) return "unavailable";
  try {
    const response = await fetch(`${origin}/auth/v1/user`, {
      headers: { apikey: publishableKey, authorization: `Bearer ${token}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status === 401 || response.status === 403) return "refused";
    if (!response.ok) return "unavailable";
    const user = (await response.json()) as { id?: unknown };
    return typeof user.id === "string" && user.id ? { id: user.id } : "refused";
  } catch {
    return "unavailable";
  }
}

function withPass(request: NextRequest, value: string, maxAge: number) {
  const secure = request.nextUrl.protocol === "https:";
  const response = new Response(null, { status: 204, headers: NO_STORE });
  const cookie = (name: string, content: string, age: number, httpOnly: boolean) =>
    [
      `${name}=${content}`,
      "Path=/",
      `Max-Age=${age}`,
      "SameSite=Lax",
      ...(httpOnly ? ["HttpOnly"] : []),
      ...(secure ? ["Secure"] : []),
    ].join("; ");
  response.headers.append("Set-Cookie", cookie(FRONT_DOOR_PASS_COOKIE, value, maxAge, true));
  response.headers.append("Set-Cookie", cookie(FRONT_DOOR_MARKER_COOKIE, "1", 30 * 24 * 3600, false));
  return response;
}

export async function POST(request: NextRequest) {
  if (!frontDoorRequired()) return answer(204);
  const secret = frontDoorSecret();
  if (!secret) return answer(503, "Sign-in is not set up on this server yet. Tell the Ward Flow coordinator.");
  let body: { token?: unknown; demoCode?: unknown };
  try {
    body = await request.json();
  } catch {
    return answer(400, "Sign in again.");
  }
  const now = Date.now();

  if (typeof body.demoCode === "string") {
    // The signed-in site never opens with a demo code: only an account opens it.
    if (process.env.NEXT_PUBLIC_WARD_SHARED_ENABLED === "true") return answer(400, "Sign in with your account.");
    const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (tooManyTries(address, now)) return answer(429, "Too many tries. Wait 10 minutes, then try again.");
    if (!(await demoCodeMatches(body.demoCode))) {
      countWrongTry(address, now);
      return answer(401, "That demo code is not right. Check it and try again.");
    }
    const pass = await issuePass(secret, { kind: "demo", hours: DEMO_PASS_HOURS }, now);
    return withPass(request, pass.value, pass.maxAge);
  }

  if (typeof body.token !== "string" || body.token.length > 8_192) return answer(400, "Sign in again.");
  const account = await checkedAccount(body.token);
  if (account === "refused") return answer(401, "Your sign-in was not accepted. Sign in again.");
  if (account === "unavailable") return answer(503, "The sign-in service is busy. Try again in a moment.");
  const endsBy = signInEndsAt(body.token);
  if (endsBy !== null && endsBy <= now)
    return answer(401, "Your sign-in has reached its 12-hour limit. Sign in again.");
  const pass = await issuePass(
    secret,
    { kind: "account", subject: account.id, hours: ACCOUNT_PASS_HOURS, endsBy },
    now,
  );
  return withPass(request, pass.value, pass.maxAge);
}

export function DELETE(request: NextRequest) {
  const response = answer(204);
  const secure = request.nextUrl.protocol === "https:" ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `${FRONT_DOOR_PASS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly${secure}`,
  );
  return response;
}

import { z } from "zod";
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
import { edgeAddress, reserveDemoTry } from "@/lib/demo-code-tries";
import { checkFrontDoorAccount } from "@/lib/front-door-admission";

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

/** Secure on any https request, and always in production, where Railway's edge ends https before the app. */
function secureCookie(request: NextRequest): boolean {
  return process.env.NODE_ENV === "production" || request.nextUrl.protocol === "https:";
}

function withPass(request: NextRequest, value: string, maxAge: number) {
  const secure = secureCookie(request);
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
  let body: { token?: string; demoCode?: string };
  try {
    const parsed: unknown = await request.json();
    const checked = z
      .union([
        z.object({ token: z.string().min(1).max(8192) }).strict(),
        z.object({ demoCode: z.string().min(1).max(256) }).strict(),
      ])
      .safeParse(parsed);
    if (!checked.success) return answer(400, "Sign in again.");
    body = checked.data;
  } catch {
    return answer(400, "Sign in again.");
  }
  const now = Date.now();

  if (typeof body.demoCode === "string") {
    // The signed-in site never opens with a demo code: only an account opens it.
    if (process.env.NEXT_PUBLIC_WARD_SHARED_ENABLED === "true") return answer(400, "Sign in with your account.");
    const address = edgeAddress(request.headers);
    const release = reserveDemoTry(address, now);
    if (!release) return answer(429, "Too many tries. Wait 10 minutes, then try again.");
    if (!(await demoCodeMatches(body.demoCode))) {
      return answer(401, "That demo code is not right. Check it and try again.");
    }
    release();
    const pass = await issuePass(secret, { kind: "demo", hours: DEMO_PASS_HOURS }, now);
    return withPass(request, pass.value, pass.maxAge);
  }

  if (typeof body.token !== "string" || body.token.length > 8_192) return answer(400, "Sign in again.");
  const account = await checkFrontDoorAccount(body.token);
  if (account === "malformed") return answer(400, "Sign in again.");
  if (account === "rate-limited") {
    const response = answer(429, "Too many sign-in checks. Wait a minute, then try again.");
    response.headers.set("Retry-After", "60");
    return response;
  }
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
  const secure = secureCookie(request) ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `${FRONT_DOOR_PASS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly${secure}`,
  );
  return response;
}

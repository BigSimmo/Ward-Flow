/**
 * The front door's server check (Josh, 27 October 2026: "build the front door"). When the hosted
 * switch `WARD_FRONT_DOOR=required` is set, no Ward Flow page or API answers until this browser
 * holds a signed pass. The pass is an HttpOnly cookie that `POST /api/session` sets after it has
 * checked a Supabase sign-in with Supabase itself, or a demo code on the public demo. It ends with
 * the 12-hour sign-in limit (8 hours for a demo code) and on sign-out.
 *
 * The pass only opens the door. It never stands in for the sign-in: the shared workspace still
 * checks the account's own token on every request, so a pass without a sign-in shows the sign-in
 * screen and nothing else.
 *
 * Pure functions on Web Crypto with no other imports, so `src/proxy.ts` can use them.
 */

export const FRONT_DOOR_PASS_COOKIE = "wf_pass";
/**
 * Readable by the page and holds no secret: it says this site uses the front door, so the app
 * tells the server when someone signs in or out. Sites without the switch never set it, so they
 * make no extra request.
 */
export const FRONT_DOOR_MARKER_COOKIE = "wf_door";
export const FRONT_DOOR_SIGN_IN_PATH = "/sign-in";
export const ACCOUNT_PASS_HOURS = 12;
export const DEMO_PASS_HOURS = 8;
const HOME_PATH = "/ward-flow";
const MIN_SECRET_LENGTH = 32;

type Env = Record<string, string | undefined>;

/** Whether the hosted switch asks for the front door. Anything but `required` leaves it open. */
export function frontDoorRequired(env: Env = process.env): boolean {
  return env.WARD_FRONT_DOOR?.trim() === "required";
}

/** The signing secret, or null when it is missing or too short to trust. */
export function frontDoorSecret(env: Env = process.env): string | null {
  const secret = env.WARD_PASS_SECRET?.trim() ?? "";
  return secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

/**
 * Addresses that open without a pass: the sign-in page and its API, the health check Railway
 * needs, and the files a signed-out phone still asks for (offline page, alert worker, robots).
 * Static build files never reach the proxy at all (see its matcher).
 */
const OPEN_PATHS = new Set([
  FRONT_DOOR_SIGN_IN_PATH,
  "/api/session",
  "/api/health",
  "/api/local-project-id",
  "/robots.txt",
  "/opengraph-image",
  "/ward-flow-offline.html",
  "/ward-flow-push-sw.js",
]);

export function isFrontDoorOpenPath(pathname: string): boolean {
  return OPEN_PATHS.has(pathname);
}

/**
 * Where sign-in goes next: a Ward Flow address on this site, never anywhere else. Anything that is
 * not a plain `/ward-flow` path (another site, a protocol-relative `//host`, a backslash trick or a
 * very long value) falls back to Ward Flow's home, which then opens the role's own home page.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || raw.length > 512 || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return HOME_PATH;
  let url: URL;
  try {
    url = new URL(raw, "https://front-door.invalid");
  } catch {
    return HOME_PATH;
  }
  if (url.origin !== "https://front-door.invalid") return HOME_PATH;
  if (url.pathname !== HOME_PATH && !url.pathname.startsWith(`${HOME_PATH}/`)) return HOME_PATH;
  return url.pathname + url.search;
}

export type FrontDoorPass = {
  /** "account" after a checked sign-in, "demo" after a demo code. */
  kind: "account" | "demo";
  /** The Supabase account id for an account pass. */
  subject?: string;
  issuedAt: number;
  expiresAt: number;
};

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function sign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data))));
}

/** Compares in time that does not depend on where two strings first differ. */
function sameText(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1)
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  return difference === 0;
}

/** A signed pass value and its cookie lifetime in seconds. */
export async function issuePass(
  secret: string,
  pass: Omit<FrontDoorPass, "issuedAt" | "expiresAt"> & { hours: number; endsBy?: number | null },
  now = Date.now(),
): Promise<{ value: string; maxAge: number }> {
  const limit = now + pass.hours * 3_600_000;
  const expiresAt = pass.endsBy && pass.endsBy < limit ? pass.endsBy : limit;
  const body: FrontDoorPass = { kind: pass.kind, issuedAt: now, expiresAt };
  if (pass.subject) body.subject = pass.subject;
  const payload = toBase64Url(encoder.encode(JSON.stringify(body)));
  return {
    value: `${payload}.${await sign(secret, payload)}`,
    maxAge: Math.max(0, Math.floor((expiresAt - now) / 1000)),
  };
}

/** The pass a cookie holds, or null when it is missing, altered, malformed or past its time. */
export async function verifyPass(
  secret: string | null,
  value: string | undefined,
  now = Date.now(),
): Promise<FrontDoorPass | null> {
  if (!secret || !value || value.length > 1024) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  if (!sameText(await sign(secret, payload), signature)) return null;
  const bytes = fromBase64Url(payload);
  if (!bytes) return null;
  try {
    const pass = JSON.parse(new TextDecoder().decode(bytes)) as Partial<FrontDoorPass>;
    if (pass.kind !== "account" && pass.kind !== "demo") return null;
    if (!Number.isFinite(pass.issuedAt) || !Number.isFinite(pass.expiresAt)) return null;
    if (pass.expiresAt! <= now || pass.issuedAt! > now + 60_000) return null;
    return pass as FrontDoorPass;
  } catch {
    return null;
  }
}

/** The demo code's own form: capitals, with spaces and dashes ignored, so "ward 7q4k" still opens. */
function normaliseDemoCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]+/g, "");
}

/** Whether an entered demo code matches `WARD_DEMO_CODE`. False when no code is set. */
export async function demoCodeMatches(entered: string, env: Env = process.env): Promise<boolean> {
  const expected = normaliseDemoCode(env.WARD_DEMO_CODE ?? "");
  if (expected.length < 4) return false;
  // Hash both sides, so the comparison takes the same time whatever was typed.
  const digest = async (text: string) =>
    toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text))));
  return sameText(await digest(normaliseDemoCode(entered.slice(0, 64))), await digest(expected));
}

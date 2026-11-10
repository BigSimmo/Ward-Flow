#!/usr/bin/env node
// Audit M52 (absorbs M56): after a release, one read-only request confirms the live site sends the
// security headers the code builds. Free and local: plain fetch, no scanning service.
//
//   node scripts/check-live-security-headers.mjs <https-url> [--out <file.json>]
//
// Exit 0 when every header matches, 1 when any is missing or different, 2 on a usage or network
// error. The result is written as JSON to --out (or printed) so the post-release step (M67) can
// keep it. It sends no cookie, token or body, and never signs in.
//
// EXPECTED_HEADERS must equal buildSecurityHeaders() for a non-local runtime in
// src/lib/security-headers.ts; tests/ward-audit-m52-live-security-headers.test.ts fails if they drift.
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const EXPECTED_HEADERS = Object.freeze({
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "cross-origin-resource-policy": "same-site",
  "cross-origin-opener-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "origin-agent-cluster": "?1",
  "x-permitted-cross-domain-policies": "none",
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
});

/** Directives the production content security policy must hold, whatever its nonce and origins. */
export const REQUIRED_CSP = Object.freeze([
  ["default-src", /^'self'$/],
  ["base-uri", /^'self'$/],
  ["object-src", /^'none'$/],
  ["frame-ancestors", /^'none'$/],
  ["form-action", /^'self'$/],
  ["upgrade-insecure-requests", /^$/],
  ["script-src", /^'self' 'nonce-[A-Za-z0-9+/=_-]+' 'strict-dynamic'$/],
]);

function directives(csp) {
  const map = new Map();
  for (const part of csp.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [name, ...values] = trimmed.split(/\s+/);
    map.set(name.toLowerCase(), values.join(" "));
  }
  return map;
}

/**
 * Compares one response's headers with the code's. `headers` is a Headers object or anything with
 * get(name) and, for cookies, getSetCookie(). Returns { ok, problems, checked }.
 */
export function compareSecurityHeaders(headers) {
  const problems = [];
  const checked = [];
  for (const [name, expected] of Object.entries(EXPECTED_HEADERS)) {
    const actual = headers.get(name);
    checked.push(name);
    if (actual === null || actual === undefined) problems.push(`${name}: missing`);
    else if (actual.trim() !== expected) problems.push(`${name}: expected "${expected}", got "${actual.trim()}"`);
  }
  const csp = headers.get("content-security-policy");
  checked.push("content-security-policy");
  if (!csp) problems.push("content-security-policy: missing");
  else {
    const map = directives(csp);
    for (const [name, pattern] of REQUIRED_CSP) {
      if (!map.has(name)) problems.push(`content-security-policy: ${name} missing`);
      else if (!pattern.test(map.get(name))) problems.push(`content-security-policy: ${name} is "${map.get(name)}"`);
    }
  }
  // A page that sets a cookie on an anonymous visit must set it Secure, HttpOnly and SameSite.
  const cookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  for (const cookie of cookies) {
    const name = cookie.split("=")[0]?.trim() || "(unnamed)";
    checked.push(`set-cookie ${name}`);
    if (!/;\s*Secure\b/i.test(cookie)) problems.push(`set-cookie ${name}: not Secure`);
    if (!/;\s*SameSite=/i.test(cookie)) problems.push(`set-cookie ${name}: no SameSite`);
  }
  return { ok: problems.length === 0, problems, checked };
}

/** One read-only GET with no credentials. Redirects are not followed, so the first answer is judged. */
export async function checkLiveSecurityHeaders(url, { fetch: fetcher = fetch, now = () => new Date() } = {}) {
  const target = new URL(url);
  if (target.protocol !== "https:") throw new Error("Only an https address can be checked");
  const response = await fetcher(target.href, {
    method: "GET",
    redirect: "manual",
    credentials: "omit",
    headers: { "user-agent": "ward-flow-header-check" },
    signal: AbortSignal.timeout(15_000),
  });
  return {
    url: target.origin + target.pathname,
    status: response.status,
    at: now().toISOString(),
    ...compareSecurityHeaders(response.headers),
  };
}

async function main(argv) {
  const [url, flag, out] = argv;
  if (!url || (flag !== undefined && (flag !== "--out" || !out))) {
    console.error("Usage: node scripts/check-live-security-headers.mjs <https-url> [--out <file.json>]");
    return 2;
  }
  let result;
  try {
    result = await checkLiveSecurityHeaders(url);
  } catch (error) {
    console.error(`Header check could not run: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
  const text = `${JSON.stringify(result, null, 2)}\n`;
  if (out) writeFileSync(out, text);
  else process.stdout.write(text);
  for (const problem of result.problems) console.error(`::error::${problem}`);
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}

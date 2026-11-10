#!/usr/bin/env node
// Audit M67 and M52 (10 November 2026): the check after each release. Read-only. It waits until each
// Railway service runs the commit `live` points at, then checks both sites' health and the backend's,
// the security headers the code builds (M52), and a synthetic monitor sign-in and workspace read,
// and records one pass or fail per check. A synthetic save on live is a write and is not here.
//
// It has no built-in addresses, so it never reaches the live site by accident. Running it against
// the hosted services needs Josh's yes each time, given as --yes-live. Usage:
//   node scripts/ward-flow/post-release-check.mjs --live-sha <40 hex> --deployments <file.json>
//     --demo-url <url> --shared-url <url> --backend-url <url> --supabase-url <url>
//     [--out <result.json>] [--yes-live]
// <file.json> maps each Railway service name to the commit its newest successful deployment runs
// (read from Railway by a person, or by a future step that holds a Railway token: needs Josh).
// The monitor account comes from WARD_FLOW_MONITOR_EMAIL, WARD_FLOW_MONITOR_PASSWORD and
// WARD_FLOW_SUPABASE_PUBLISHABLE_KEY, the uptime check's secrets. Nothing secret is printed.
// Exit codes: 0 every check passed, 2 a check failed, 1 bad input.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const SERVICES = ["ward-flow", "ward-flow-shared", "ward-flow-backend"];

/**
 * The static headers `src/lib/security-headers.ts` builds for a hosted (HTTPS) runtime. A test keeps
 * this list equal to buildSecurityHeaders, so a code change cannot leave the live check behind.
 */
export const EXPECTED_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "cross-origin-resource-policy": "same-site",
  "cross-origin-opener-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "origin-agent-cluster": "?1",
  "x-permitted-cross-domain-policies": "none",
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
};
/** Parts the per-request content security policy (src/proxy.ts) must carry. */
export const CSP_PARTS = [
  "default-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "upgrade-insecure-requests",
];

const result = (name, pass, detail = "") => ({ name, pass, detail });

/** @typedef {(input: string | URL, init?: RequestInit) => Promise<Response>} Fetcher */
/** @typedef {{ attempts?: number, delayMs?: number, sleep?: (ms: number) => Promise<void> }} WaitOptions */

/**
 * Waits until every service's newest successful deployment runs `liveSha`. `read` returns {service: sha}.
 * @param {() => Promise<Record<string, string> | undefined>} read
 * @param {string} liveSha
 * @param {WaitOptions} [options]
 */
export async function waitForDeployments(read, liveSha, { attempts = 20, delayMs = 30_000, sleep } = {}) {
  const pause = sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let behind = SERVICES;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let deployed = {};
    try {
      deployed = (await read()) ?? {};
    } catch {
      deployed = {};
    }
    behind = SERVICES.filter((service) => deployed[service] !== liveSha);
    if (!behind.length) return result("railway-runs-live-commit", true);
    if (attempt < attempts) await pause(delayMs);
  }
  return result("railway-runs-live-commit", false, `not on ${liveSha.slice(0, 7)}: ${behind.join(", ")}`);
}

async function getJson(fetcher, url, init) {
  const response = await fetcher(url, { redirect: "manual", ...init });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, headers: response.headers, body };
}

export async function checkHealth(fetcher, { demoUrl, sharedUrl, backendUrl }) {
  const checks = [];
  for (const [name, base] of [
    ["demo-health", demoUrl],
    ["shared-health", sharedUrl],
  ]) {
    try {
      const { status, body } = await getJson(fetcher, new URL("/api/health", base));
      checks.push(result(name, status === 200 && body?.status === "ok", `HTTP ${status}`));
    } catch {
      checks.push(result(name, false, "no answer"));
    }
  }
  try {
    const { status, body } = await getJson(fetcher, new URL("/healthz", backendUrl));
    checks.push(result("backend-health", status === 200 && body?.service === "ward-flow-backend", `HTTP ${status}`));
  } catch {
    checks.push(result("backend-health", false, "no answer"));
  }
  return checks;
}

/** M52: the signed-in site's front page sends every header the code builds, with its value. */
export async function checkHeaders(fetcher, sharedUrl) {
  let response;
  try {
    response = await fetcher(new URL("/", sharedUrl), { redirect: "manual" });
  } catch {
    return result("security-headers", false, "no answer");
  }
  const wrong = Object.entries(EXPECTED_HEADERS)
    .filter(([name, value]) => response.headers.get(name) !== value)
    .map(([name]) => name);
  const csp = response.headers.get("content-security-policy") ?? "";
  if (!csp) wrong.push("content-security-policy");
  else {
    for (const part of CSP_PARTS) if (!csp.includes(part)) wrong.push(`content-security-policy (${part})`);
    if (!/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/u.test(csp))
      wrong.push("content-security-policy (script nonce)");
  }
  return result(
    "security-headers",
    wrong.length === 0,
    wrong.length ? `missing or different: ${wrong.join(", ")}` : "",
  );
}

/** Signs in as the synthetic monitor account, loads the workspace as a desk would, then signs out. */
export async function checkSignInRead(fetcher, { supabaseUrl, backendUrl, email, password, publishableKey }) {
  if (!email || !password || !publishableKey) return result("synthetic-sign-in-read", false, "monitor account not set");
  let token = "";
  try {
    const signIn = await getJson(fetcher, new URL("/auth/v1/token?grant_type=password", supabaseUrl), {
      method: "POST",
      headers: { apikey: publishableKey, "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    token = typeof signIn.body?.access_token === "string" ? signIn.body.access_token : "";
    if (signIn.status !== 200 || !token)
      return result("synthetic-sign-in-read", false, `sign-in HTTP ${signIn.status}`);
    const read = await getJson(fetcher, new URL("/v1/workspace", backendUrl), {
      headers: { authorization: `Bearer ${token}` },
    });
    const loaded =
      read.status === 200 && read.body?.data?.source === "synthetic" && typeof read.body?.snapshot === "object";
    return result("synthetic-sign-in-read", loaded, loaded ? "" : `workspace HTTP ${read.status}`);
  } catch {
    return result("synthetic-sign-in-read", false, "no answer");
  } finally {
    if (token)
      await fetcher(new URL("/auth/v1/logout?scope=local", supabaseUrl), {
        method: "POST",
        headers: { apikey: publishableKey, authorization: `Bearer ${token}` },
      }).catch(() => undefined);
  }
}

/**
 * Runs every check in order and returns the record to save.
 * @param {{ fetcher?: Fetcher, readDeployments: () => Promise<Record<string, string> | undefined>, liveSha: string,
 *   urls: Record<string, string>, monitor: Record<string, string>, wait?: WaitOptions, now?: Date }} options
 */
export async function postReleaseCheck({
  fetcher = fetch,
  readDeployments,
  liveSha,
  urls,
  monitor,
  wait = {},
  now = new Date(),
}) {
  const checks = [await waitForDeployments(readDeployments, liveSha, wait)];
  checks.push(...(await checkHealth(fetcher, urls)));
  checks.push(await checkHeaders(fetcher, urls.sharedUrl));
  checks.push(await checkSignInRead(fetcher, { ...urls, ...monitor }));
  return { checkedAt: now.toISOString(), liveSha, pass: checks.every((check) => check.pass), checks };
}

const loopback = (value) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname);

async function main(args) {
  const at = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const liveSha = at("--live-sha") ?? "";
  const urls = {
    demoUrl: at("--demo-url"),
    sharedUrl: at("--shared-url"),
    backendUrl: at("--backend-url"),
    supabaseUrl: at("--supabase-url"),
  };
  const deploymentsFile = at("--deployments");
  if (!/^[0-9a-f]{40}$/u.test(liveSha) || !deploymentsFile || Object.values(urls).some((value) => !value)) {
    console.error("Give --live-sha, --deployments and all four --*-url options. See the file header.");
    return 1;
  }
  if (Object.values(urls).some((value) => !loopback(value)) && !args.includes("--yes-live")) {
    console.error("These addresses are not local. A run against the hosted services needs Josh's yes: add --yes-live.");
    return 1;
  }
  const record = await postReleaseCheck({
    liveSha,
    urls,
    readDeployments: async () => JSON.parse(readFileSync(deploymentsFile, "utf8")),
    wait: { attempts: 1 },
    monitor: {
      email: process.env.WARD_FLOW_MONITOR_EMAIL,
      password: process.env.WARD_FLOW_MONITOR_PASSWORD,
      publishableKey: process.env.WARD_FLOW_SUPABASE_PUBLISHABLE_KEY,
    },
  });
  const text = `${JSON.stringify(record, null, 2)}\n`;
  const out = at("--out");
  if (out) writeFileSync(out, text);
  process.stdout.write(text);
  return record.pass ? 0 : 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main(process.argv.slice(2)).then((code) => (process.exitCode = code));

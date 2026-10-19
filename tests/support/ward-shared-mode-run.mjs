#!/usr/bin/env node
/**
 * Runs `tests/ward-shared-mode.spec.ts`: Ward Flow's shared mode in a real browser, against a real
 * local backend (`backend/ward-flow`) and a real local PostgreSQL, with nothing hosted.
 *
 *   WARD_E2E_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres node tests/support/ward-shared-mode-run.mjs
 *
 * WARD_E2E_DATABASE_URL is an ADMINISTRATOR URL for a throwaway loopback cluster (CI's postgres:16
 * service, or one started by hand). This creates its own database on it, migrates it with the
 * backend's own migration and runtime-role SQL, and drops it at the end. Extra arguments go to
 * `playwright test` (for example `--repeat-each=2`).
 *
 * What is real: the browser, `next dev`, the backend's HTTP handler, workspace store, engine and
 * runtime-role check, its Supabase token verifier (signatures checked against published keys), and
 * PostgreSQL. What is not: Supabase Auth itself. A small fake (below) signs ES256 tokens the verifier
 * accepts. The backend reaches it through the verifier's own `fetch` seam, and the browser through a
 * route the spec adds for the approved Supabase origin only (that origin is fixed in the client
 * code and its CSP, so a real request there must never leave this machine). Synthetic accounts only.
 *
 * `scripts/run-playwright.mjs` cannot run this: it builds the offline demo with shared mode off. A
 * dev server is used because the client accepts a plain-HTTP loopback API only in development.
 */
import { spawn } from "node:child_process";
import { generateKeyPairSync, randomBytes, randomUUID, sign, verify } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  appName,
  circularProjectPortRange,
  isReservedDevPort,
  localProjectId,
  stableProjectPort,
} from "../../src/lib/local-server-utils.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const backendRoot = path.join(projectRoot, "backend/ward-flow");
const backendRequire = createRequire(path.join(backendRoot, "package.json"));
const backend = (file) => import(pathToFileURL(path.join(backendRoot, file)).href);
const { Pool } = backendRequire("pg");

/** The one Supabase project the backend and the browser accept (backend/ward-flow/supabase-config.mjs). */
const SUPABASE_ORIGIN = "https://zakzoemeedfepxcstsou.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_wardflow_e2e_synthetic";
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

const adminUrl = process.env.WARD_E2E_DATABASE_URL;
if (!adminUrl || !LOOPBACK.has(new URL(adminUrl).hostname)) {
  console.error("WARD_E2E_DATABASE_URL must name an administrator on a throwaway loopback PostgreSQL server.");
  process.exit(2);
}

/** Two synthetic coordinator desks. Both are bootstrap statewide coordinators (WARD_COORDINATOR_USER_IDS). */
const accounts = ["one", "two"].map((name) => ({
  id: randomUUID(),
  email: `e2e.coordinator.${name}@example.invalid`,
  password: randomBytes(18).toString("base64url"),
}));

const cleanups = [];
async function cleanup() {
  for (const step of cleanups.reverse().splice(0)) {
    try {
      await step();
    } catch (error) {
      console.error(`[shared-mode] cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => void cleanup().finally(() => process.exit(signal === "SIGINT" ? 130 : 143)));

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = /** @type {net.AddressInfo} */ (server.address());
      server.close(() => resolve(port));
    });
  });
}

/** A port in this checkout's managed range, so `/api/local-project-id` reports a safe local origin. */
async function freeProjectPort() {
  const taken = (port) =>
    new Promise((resolve) => {
      const socket = net.createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => (socket.destroy(), resolve(true)));
      socket.once("error", () => resolve(false));
    });
  for (const port of circularProjectPortRange(stableProjectPort(projectRoot)))
    if (!isReservedDevPort(port) && !(await taken(port))) return port;
  throw new Error("No free port in this checkout's managed range.");
}

/**
 * The fake Supabase Auth: password sign-in, refresh, `/user`, logout and the published key list,
 * which is all `ward-supabase-auth.ts` and `supabase-auth.mjs` call. Tokens carry the claims the
 * backend verifier checks (issuer, audience, role, expiry, session id and sign-in time).
 */
function startFakeAuth() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const kid = `e2e-${randomUUID()}`;
  const jwk = { ...publicKey.export({ format: "jwk" }), kid, alg: "ES256", use: "sig" };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const refreshTokens = new Map();
  const issue = (account) => {
    const now = Math.floor(Date.now() / 1000);
    const head = `${encode({ alg: "ES256", kid, typ: "JWT" })}.${encode({
      iss: `${SUPABASE_ORIGIN}/auth/v1`,
      sub: account.id,
      aud: "authenticated",
      role: "authenticated",
      email: account.email,
      iat: now,
      exp: now + 3600,
      session_id: randomUUID(),
      aal: "aal1",
      amr: [{ method: "password", timestamp: now }],
    })}`;
    const signature = sign("sha256", Buffer.from(head), { key: privateKey, dsaEncoding: "ieee-p1363" });
    const refresh = randomBytes(24).toString("base64url");
    refreshTokens.set(refresh, account);
    return {
      access_token: `${head}.${signature.toString("base64url")}`,
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: refresh,
      user: { id: account.id, email: account.email },
    };
  };
  /** The account a bearer token names, when this fake signed it and it has not expired. */
  const bearer = (header) => {
    const [head, claims, signature] = (header ?? "").replace(/^Bearer /, "").split(".");
    if (!signature) return null;
    const signedHere = verify(
      "sha256",
      Buffer.from(`${head}.${claims}`),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(signature, "base64url"),
    );
    const { sub, exp } = JSON.parse(Buffer.from(claims, "base64url").toString("utf8"));
    return signedHere && exp > Date.now() / 1000 ? (accounts.find((account) => account.id === sub) ?? null) : null;
  };
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://fake-auth");
    let body = "";
    for await (const chunk of request) body += chunk;
    const send = (status, value) => {
      response.writeHead(status, {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "apikey, authorization, content-type",
        "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
        "cache-control": "no-store",
        ...(value === undefined ? {} : { "content-type": "application/json" }),
      });
      response.end(value === undefined ? undefined : JSON.stringify(value));
    };
    if (request.method === "OPTIONS") return send(204);
    if (request.headers.apikey !== PUBLISHABLE_KEY && url.pathname !== "/auth/v1/.well-known/jwks.json")
      return send(401, { message: "Invalid API key" });
    const input = body ? JSON.parse(body) : {};
    if (url.pathname === "/auth/v1/.well-known/jwks.json") return send(200, { keys: [jwk] });
    if (url.pathname === "/auth/v1/token" && request.method === "POST") {
      const grant = url.searchParams.get("grant_type");
      const account =
        grant === "password"
          ? accounts.find((candidate) => candidate.email === input.email && candidate.password === input.password)
          : grant === "refresh_token"
            ? refreshTokens.get(input.refresh_token)
            : undefined;
      if (grant === "refresh_token") refreshTokens.delete(input.refresh_token);
      return account ? send(200, issue(account)) : send(400, { error: "invalid_grant" });
    }
    const account = bearer(request.headers.authorization);
    if (url.pathname === "/auth/v1/user" && request.method === "GET")
      return account ? send(200, { id: account.id, email: account.email }) : send(401, { message: "Unauthorised" });
    if (url.pathname === "/auth/v1/logout" && request.method === "POST") return send(204);
    return send(404, { message: "Not found" });
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      const { port } = /** @type {net.AddressInfo} */ (server.address());
      cleanups.push(() => new Promise((done) => server.close(() => done(undefined))));
      resolve(`http://127.0.0.1:${port}`);
    }),
  );
}

/** A fresh database on the administrator's cluster, migrated by the backend's own SQL. */
async function createDatabase() {
  const name = `wardflow_e2e_${randomBytes(6).toString("hex")}`;
  const admin = new Pool({ connectionString: adminUrl, max: 1 });
  await admin.query(`CREATE DATABASE ${name}`);
  cleanups.push(async () => {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
  });
  const target = new URL(adminUrl);
  target.pathname = `/${name}`;
  const owner = new Pool({ connectionString: target.href, max: 1 });
  try {
    const { migratePortablePostgres } = await backend("migrate-postgres.mjs");
    await migratePortablePostgres(owner);
  } finally {
    await owner.end();
  }
  // The runtime role logs in through the cluster's own (trust) authentication; the URL still
  // needs a password to pass the backend's validator, so it gets a fresh meaningless one.
  const runtime = new URL(target.href);
  runtime.username = "wardflow_backend";
  Reflect.set(runtime, "password", `e2e-${randomBytes(12).toString("hex")}`);
  return runtime.href;
}

/** The shared engine, bundled into this run's folder exactly as build-engine.mjs bundles it. */
async function buildEngine(runRoot) {
  const outfile = path.join(runRoot, "engine.mjs");
  await backendRequire("esbuild").build({
    entryPoints: [path.join(backendRoot, "engine.ts")],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    tsconfig: path.join(projectRoot, "tsconfig.json"),
    logLevel: "warning",
  });
  return pathToFileURL(outfile).href;
}

/** backend/ward-flow/server.mjs's own startup, with the local seams its tests use. */
async function startBackend({ databaseUrl, authOrigin, appOrigin, engineUrl }) {
  const [{ readConfig }, { createBackend }, { createHandler, listen }, { createSupabaseAuthenticator }] =
    await Promise.all([
      backend("config.mjs"),
      backend("providers.mjs"),
      backend("server.mjs"),
      backend("supabase-auth.mjs"),
    ]);
  const { verifyPortableRuntimeRole } = await backend("portable-postgres.mjs");
  const port = await freePort();
  const config = readConfig({
    PORT: String(port),
    HOST: "127.0.0.1",
    WARD_ALLOWED_ORIGIN: appOrigin,
    WARD_SHARED_ENABLED: "true",
    WARD_WORKSPACE_ID: randomUUID(),
    WARD_DATABASE_PROVIDER: "postgres",
    WARD_POSTGRES_DATABASE_URL: databaseUrl,
    WARD_COORDINATOR_USER_IDS: accounts.map((account) => account.id).join(","),
    WARD_SUPABASE_PROJECT_REF: "zakzoemeedfepxcstsou",
    WARD_SUPABASE_URL: SUPABASE_ORIGIN,
    WARD_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
  });
  const store = await createBackend(config, {
    // The portable pool insists on TLS; a throwaway loopback cluster has none. The runtime-role
    // check is the real one.
    database: {
      postgres: async () => ({
        createPool: ({ connectionString }) => new Pool({ connectionString, max: 4 }),
        verifyPool: verifyPortableRuntimeRole,
      }),
    },
    // The real verifier, whose calls to the approved Supabase origin reach the fake instead.
    auth: {
      supabase: async () => (authConfig, dependencies) =>
        createSupabaseAuthenticator(authConfig, {
          ...dependencies,
          fetch: (url, init) => fetch(String(url).replace(SUPABASE_ORIGIN, authOrigin), init),
        }),
    },
    engine: () => import(engineUrl),
  });
  const server = listen(createHandler({ ...store, log: () => {} }), config);
  cleanups.push(async () => {
    await new Promise((done) => server.close(() => done(undefined)));
    await store.pool?.end();
  });
  await new Promise((resolve) => (server.listening ? resolve(undefined) : server.once("listening", resolve)));
  return `http://127.0.0.1:${port}`;
}

/** `next dev` in shared mode, from its own build folder so it never touches the checkout's `.next`. */
async function startNext({ runId, runRoot, port, apiBaseUrl }) {
  const relativeRoot = `.next-playwright/${runId}`;
  // Same isolated tsconfig as scripts/run-playwright.mjs, so the dev server never edits tsconfig.json.
  writeFileSync(
    path.join(runRoot, "tsconfig.json"),
    `${JSON.stringify({ extends: "../../tsconfig.json", compilerOptions: { ignoreDeprecations: "6.0", baseUrl: "../..", paths: { "@/*": ["src/*"] } }, include: ["../../next-env.d.ts", "../../src/**/*.ts", "../../src/**/*.tsx", "dist/types/**/*.ts", "dist/dev/types/**/*.ts"] }, null, 2)}\n`,
  );
  const child = spawn(
    process.execPath,
    [
      path.join(projectRoot, "node_modules/next/dist/bin/next"),
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: projectRoot,
      detached: true,
      stdio: ["ignore", "inherit", "inherit"],
      env: {
        ...process.env,
        NODE_ENV: "development",
        NEXT_TELEMETRY_DISABLED: "1",
        NEXT_DIST_DIR: `${relativeRoot}/dist`,
        NEXT_TSCONFIG_PATH: `${relativeRoot}/tsconfig.json`,
        NEXT_PUBLIC_WARD_SHARED_ENABLED: "true",
        NEXT_PUBLIC_WARD_API_BASE_URL: apiBaseUrl,
        NEXT_PUBLIC_WARD_SUPABASE_URL: SUPABASE_ORIGIN,
        NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
      },
    },
  );
  // Stop the whole process group (next dev forks its server), and wait until every member is gone:
  // a worker still running would write into the build folder after the cleanup below removes it.
  cleanups.push(async () => {
    const group = -(/** @type {number} */ (child.pid));
    const alive = () => {
      try {
        process.kill(group, 0);
        return true;
      } catch {
        return false;
      }
    };
    const gone = async (ms) => {
      for (const end = Date.now() + ms; alive() && Date.now() < end;)
        await new Promise((done) => setTimeout(done, 200));
      return !alive();
    };
    if (!alive()) return;
    process.kill(group, "SIGTERM");
    if (await gone(10_000)) return;
    process.kill(group, "SIGKILL");
    await gone(5_000);
  });
  const baseUrl = `http://localhost:${port}`;
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next dev exited early (code ${child.exitCode}).`);
    try {
      const identity = await (await fetch(`${baseUrl}/api/local-project-id`)).json();
      // The first /ward-flow request compiles the page, so the spec's first navigation is quick.
      if (
        identity.appName === appName &&
        identity.projectId === localProjectId(projectRoot) &&
        identity.localServer?.safeLocalOrigin === true &&
        (await fetch(`${baseUrl}/ward-flow`)).ok
      )
        return baseUrl;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("next dev did not become ready within four minutes.");
}

let exitCode = 1;
try {
  const runId = `shared-mode-${process.pid}-${Date.now()}`;
  const runRoot = path.join(projectRoot, ".next-playwright", runId);
  mkdirSync(runRoot, { recursive: true });
  cleanups.push(async () => {
    const { rmSync } = await import("node:fs");
    rmSync(runRoot, { recursive: true, force: true, maxRetries: 3 });
  });
  const nextPort = await freeProjectPort();
  const appOrigin = `http://localhost:${nextPort}`;
  const [authOrigin, databaseUrl, engineUrl] = await Promise.all([
    startFakeAuth(),
    createDatabase(),
    buildEngine(runRoot),
  ]);
  const apiBaseUrl = await startBackend({ databaseUrl, authOrigin, appOrigin, engineUrl });
  console.log(`[shared-mode] backend ${apiBaseUrl}, fake auth ${authOrigin}; starting next dev on ${appOrigin}`);
  const baseUrl = await startNext({ runId, runRoot, port: nextPort, apiBaseUrl });
  // Asynchronous on purpose: the fake sign-in service and the backend live in this process, so a
  // synchronous spawn would stop them answering the browser.
  const playwright = spawn(
    process.execPath,
    [
      path.join(projectRoot, "node_modules/playwright/cli.js"),
      "test",
      "--project=ward-shared-mode",
      ...process.argv.slice(2),
    ],
    {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: baseUrl,
        WARD_E2E_SUPABASE_ORIGIN: SUPABASE_ORIGIN,
        WARD_E2E_AUTH_ORIGIN: authOrigin,
        WARD_E2E_ACCOUNTS: JSON.stringify(accounts.map(({ email, password }) => ({ email, password }))),
      },
    },
  );
  exitCode = await new Promise((resolve) => {
    playwright.once("error", () => resolve(1));
    playwright.once("exit", (code) => resolve(code ?? 1));
  });
} catch (error) {
  console.error(`[shared-mode] ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await cleanup();
}
process.exit(exitCode);

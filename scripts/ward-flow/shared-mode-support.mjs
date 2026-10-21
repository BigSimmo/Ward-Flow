/** Local-only dependencies for the production shared-mode proof. */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { offlineTestEnvironment } from "../test-environment.mjs";
export function sharedModeEnvironment(source, { relativeRoot, apiBaseUrl, authOrigin, publishableKey }) {
  const api = new URL(apiBaseUrl);
  if (api.protocol !== "https:" || api.hostname !== "127.0.0.1")
    throw new Error("Production shared proof requires a local HTTPS API");
  return offlineTestEnvironment(source, {
    NODE_ENV: "production",
    WARD_GATE_BUILD: "",
    WARD_FLOW_SHOWCASE: "0",
    NEXT_PUBLIC_DEMO_MODE: "false",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_DIST_DIR: `${relativeRoot}/dist`,
    NEXT_TSCONFIG_PATH: `${relativeRoot}/tsconfig.json`,
    NEXT_PUBLIC_WARD_SHARED_ENABLED: "true",
    NEXT_PUBLIC_MOCKUPS_ENABLED: "false",
    NEXT_PUBLIC_WARD_AUTH_PROVIDER: "supabase",
    NEXT_PUBLIC_WARD_API_BASE_URL: apiBaseUrl,
    NEXT_PUBLIC_WARD_SUPABASE_URL: authOrigin,
    NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  });
}
export function sharedNextCommands(nextBin, port) {
  return {
    build: [nextBin, "build", "--webpack"],
    start: [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)],
  };
}
export function waitForChild(child, description) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) =>
      code === 0 && !signal
        ? resolve(undefined)
        : reject(new Error(`${description} failed (code ${code}, signal ${signal ?? "none"})`)),
    );
  });
}
export async function createSharedApiTlsProxy({ target, runRoot }) {
  const backend = new URL(target);
  if (backend.protocol !== "http:" || backend.hostname !== "127.0.0.1")
    throw new Error("Shared TLS proxy must target the local synthetic backend");
  const key = path.join(runRoot, "loopback-key.pem");
  const cert = path.join(runRoot, "loopback-cert.pem");
  const certificate = spawn(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      key,
      "-out",
      cert,
      "-days",
      "1",
      "-subj",
      "/CN=127.0.0.1",
      "-addext",
      "subjectAltName=IP:127.0.0.1",
    ],
    { stdio: "ignore", timeout: 20_000 },
  );
  await waitForChild(certificate, "Local synthetic TLS certificate generation");
  const server = https.createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (request, response) => {
    const upstream = http.request(
      {
        hostname: backend.hostname,
        port: backend.port,
        path: request.url,
        method: request.method,
        headers: request.headers,
      },
      (incoming) => {
        response.writeHead(incoming.statusCode ?? 502, incoming.headers);
        incoming.pipe(response);
      },
    );
    upstream.on("error", () => {
      response.writeHead(502);
      response.end();
    });
    request.on("aborted", () => upstream.destroy());
    request.pipe(upstream);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(undefined));
  });
  return { server, origin: `https://127.0.0.1:${server.address().port}` };
}

import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { getPlaywrightBaseUrl } from "../scripts/playwright-base-url";
import { appName, localProjectId } from "@/lib/local-server-utils.mjs";

const projectRoot = process.cwd();
const temporary = mkdtempSync(path.join(tmpdir(), "ward-playwright-identity-"));
const servers: ChildProcess[] = [];
const identity = { appName, projectId: localProjectId(projectRoot), localServer: { safeLocalOrigin: true } };

// Identity verification is synchronous. A separate server process keeps answering while the
// test process waits for the verifier child; an in-process server would deadlock.
const serverScript = `
const fs = require("node:fs");
const [protocol, cert, key, body] = process.argv.slice(1);
const handler = (request, response) => {
  if (request.url !== "/api/local-project-id") { response.writeHead(404); return response.end(); }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(body);
};
const server = protocol === "https"
  ? require("node:https").createServer({cert: fs.readFileSync(cert), key: fs.readFileSync(key)}, handler)
  : require("node:http").createServer(handler);
server.listen(0, "127.0.0.1", () => process.send({url: protocol + "://127.0.0.1:" + server.address().port}));
process.on("disconnect", () => server.close(() => process.exit(0)));
`;

function certificate(name: string, ip: string) {
  const cert = path.join(temporary, `${name}.pem`);
  const key = path.join(temporary, `${name}.key`);
  execFileSync(
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
      "/CN=Ward Flow local test",
      "-addext",
      `subjectAltName=IP:${ip}`,
    ],
    { stdio: "ignore", timeout: 20_000 },
  );
  return { cert, key };
}

let trusted: ReturnType<typeof certificate>;
let wrongHost: ReturnType<typeof certificate>;
beforeAll(() => {
  trusted = certificate("loopback", "127.0.0.1");
  wrongHost = certificate("wrong-host", "127.0.0.2");
});

async function serve(protocol: "http" | "https", payload = identity, certificate = trusted) {
  const child = spawn(
    process.execPath,
    ["-e", serverScript, protocol, certificate.cert, certificate.key, JSON.stringify(payload)],
    { stdio: ["ignore", "ignore", "pipe", "ipc"] },
  );
  servers.push(child);
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Synthetic identity server did not start")), 5_000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("message", (message) => {
      clearTimeout(timer);
      resolve((message as { url: string }).url);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error("Synthetic identity server stopped before starting"));
    });
  });
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    servers.splice(0).map(
      (child) =>
        new Promise<void>((resolve) => {
          if (child.exitCode !== null) return resolve();
          child.once("exit", () => resolve());
          child.kill();
        }),
    ),
  );
});
afterAll(() => rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

it("keeps HTTP identity verification and does not use a TLS fixture CA for HTTP", async () => {
  const url = await serve("http");
  vi.stubEnv("PLAYWRIGHT_BASE_URL", url);
  vi.stubEnv("PLAYWRIGHT_LOCAL_CA_CERT", path.join(temporary, "absent.pem"));
  expect(getPlaywrightBaseUrl({ allowEnsure: false })).toBe(url);
});

it("accepts HTTPS only after the explicit fixture CA and the full local identity agree", async () => {
  const url = await serve("https");
  vi.stubEnv("PLAYWRIGHT_BASE_URL", url);
  vi.stubEnv("PLAYWRIGHT_LOCAL_CA_CERT", trusted.cert);
  expect(getPlaywrightBaseUrl({ allowEnsure: false })).toBe(url);
  expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).not.toBe("0");
});

it.each([
  { ...identity, appName: "Another app" },
  { ...identity, projectId: "another-checkout" },
  { ...identity, localServer: { safeLocalOrigin: false } },
])("refuses HTTPS with a trusted certificate but a wrong app, checkout or unsafe origin: %j", async (payload) => {
  const url = await serve("https", payload);
  vi.stubEnv("PLAYWRIGHT_BASE_URL", url);
  vi.stubEnv("PLAYWRIGHT_LOCAL_CA_CERT", trusted.cert);
  expect(() => getPlaywrightBaseUrl({ allowEnsure: false })).toThrow(/failed.*guard/u);
});

it("does not trust a self-signed HTTPS certificate without an explicit fixture CA", async () => {
  const url = await serve("https");
  vi.stubEnv("PLAYWRIGHT_BASE_URL", url);
  vi.stubEnv("PLAYWRIGHT_LOCAL_CA_CERT", "");
  expect(() => getPlaywrightBaseUrl({ allowEnsure: false })).toThrow();
});

it("keeps hostname verification when the supplied fixture CA is trusted", async () => {
  const url = await serve("https", identity, wrongHost);
  vi.stubEnv("PLAYWRIGHT_BASE_URL", url);
  vi.stubEnv("PLAYWRIGHT_LOCAL_CA_CERT", wrongHost.cert);
  expect(() => getPlaywrightBaseUrl({ allowEnsure: false })).toThrow();
});

it.each([
  "https://example.invalid:4594",
  "https://user@127.0.0.1:4594",
  "https://127.0.0.1:4594/",
  "https://127.0.0.1:4594/ward-flow",
  "https://127.0.0.1:4594?query=1",
  "https://127.0.0.1:4594#fragment",
  "https://127.0.0.1:4594\\@example.invalid",
  "file://127.0.0.1:4594",
  "http://user@localhost:4594",
])("rejects a remote, credentialed or non-origin URL before probing: %s", (url) => {
  vi.stubEnv("PLAYWRIGHT_BASE_URL", url);
  expect(() => getPlaywrightBaseUrl({ allowEnsure: false })).toThrow(/must be a localhost URL/u);
});

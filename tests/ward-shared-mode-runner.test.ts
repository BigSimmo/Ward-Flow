import { describe, expect, it } from "vitest";
import { EventEmitter } from "node:events";
import http from "node:http";
import https from "node:https";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createSharedApiTlsProxy,
  sharedModeEnvironment,
  sharedNextCommands,
  waitForChild,
} from "../scripts/ward-flow/shared-mode-support.mjs";
describe("production shared-mode runner", () => {
  const settings = {
    relativeRoot: ".next-playwright/shared-fixture",
    apiBaseUrl: "https://127.0.0.1:3201",
    authOrigin: "https://synthetic.invalid",
    publishableKey: "synthetic",
  };
  it("bakes shared flags and HTTPS into a provider-scrubbed production build", () => {
    const environment = sharedModeEnvironment(
      { OPENAI_API_KEY: "must-be-cleared", SENTRY_DSN: "must-be-cleared", WARD_GATE_BUILD: "1" },
      settings,
    );
    expect(environment).toMatchObject({
      NODE_ENV: "production",
      OPENAI_API_KEY: "",
      SENTRY_DSN: "",
      WARD_GATE_BUILD: "",
      NEXT_PUBLIC_WARD_SHARED_ENABLED: "true",
      NEXT_PUBLIC_DEMO_MODE: "false",
      NEXT_PUBLIC_WARD_API_BASE_URL: settings.apiBaseUrl,
    });
    expect(() => sharedModeEnvironment({}, { ...settings, apiBaseUrl: "http://127.0.0.1:3201" })).toThrow(/HTTPS/);
    expect(() => sharedModeEnvironment({}, { ...settings, apiBaseUrl: "https://hosted.invalid" })).toThrow(/HTTPS/);
  });
  it("builds with webpack before serving the compiled app", () => {
    expect(sharedNextCommands("next-cli", 3200)).toEqual({
      build: ["next-cli", "build", "--webpack"],
      start: ["next-cli", "start", "--hostname", "127.0.0.1", "--port", "3200"],
    });
  });
  it("does not accept a signalled or failed build as production evidence", async () => {
    const child = new EventEmitter();
    const result = waitForChild(child, "shared build");
    child.emit("close", null, "SIGTERM");
    await expect(result).rejects.toThrow(/shared build failed/);
  });
  it("serves production CSP over HTTPS on the app's reserved loopback port", async () => {
    const runRoot = await mkdtemp(path.join(tmpdir(), "ward-shared-tls-"));
    let forwardedProtocol;
    const upstream = http.createServer((request, response) => {
      forwardedProtocol = request.headers["x-forwarded-proto"];
      response.writeHead(200, { "content-security-policy": "default-src 'self'; upgrade-insecure-requests" });
      response.end("Synthetic sign-in");
    });
    const reservation = http.createServer();
    let proxy: Awaited<ReturnType<typeof createSharedApiTlsProxy>> | undefined;
    try {
      await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
      await new Promise<void>((resolve) => reservation.listen(0, "127.0.0.1", resolve));
      const port = (reservation.address() as import("node:net").AddressInfo).port;
      await new Promise<void>((resolve) => reservation.close(() => resolve()));
      proxy = await createSharedApiTlsProxy({
        target: `http://127.0.0.1:${(upstream.address() as import("node:net").AddressInfo).port}`,
        runRoot,
        port,
      });
      expect(new URL(proxy.origin).port).toBe(String(port));
      const origin = proxy.origin;
      const certificate = await readFile(proxy.certificatePath);
      const reply = await new Promise<{ body: string; csp: string | string[] | undefined }>((resolve, reject) => {
        // Trust only this run's certificate; retain TLS hostname verification.
        https
          .get(origin, { ca: certificate }, (response) => {
            let body = "";
            response.on("data", (chunk) => {
              body += chunk;
            });
            response.on("end", () => resolve({ body, csp: response.headers["content-security-policy"] }));
            response.on("error", reject);
          })
          .on("error", reject);
      });
      expect(reply).toEqual({ body: "Synthetic sign-in", csp: "default-src 'self'; upgrade-insecure-requests" });
      expect(forwardedProtocol).toBe("https");
    } finally {
      for (const server of [proxy?.server, upstream, reservation]) {
        server?.closeAllConnections();
        if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
      }
      await rm(runRoot, { recursive: true, force: true });
    }
  });
});

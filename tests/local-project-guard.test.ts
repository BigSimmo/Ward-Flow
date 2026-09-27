import { describe, expect, it } from "vitest";
import {
  UnsafeLocalProjectOriginError,
  assertSafeLocalProjectRequest,
  isLocalUrl,
  isManagedProjectPort,
  isSafeLocalProjectRequest,
  localProjectIdentityPayload,
  localProjectOriginErrorResponse,
  localProjectRequestIdentityPayload,
  unsafeLocalProjectResponse,
} from "../src/lib/local-project-guard";
import { projectPortEnd, projectPortStart } from "../src/lib/local-server-utils.mjs";

const managedUrl = `http://localhost:${projectPortStart}/api/setup-status`;
const unmanagedUrl = "http://localhost:3000/api/setup-status";

function request(url: string, headers?: Record<string, string>) {
  return new Request(url, headers ? { headers } : undefined);
}

describe("local project guard", () => {
  it("recognizes loopback hosts and the managed project port range", () => {
    expect(isLocalUrl(new URL("http://127.0.0.1:3100/"))).toBe(true);
    expect(isLocalUrl(new URL("http://[::1]:3100/"))).toBe(true);
    expect(isLocalUrl(new URL("http://LOCALHOST:3100/"))).toBe(true);
    expect(isLocalUrl(new URL("https://psychiatry.tools/"))).toBe(false);

    expect(isManagedProjectPort(projectPortStart)).toBe(true);
    expect(isManagedProjectPort(projectPortEnd)).toBe(true);
    expect(isManagedProjectPort(projectPortStart - 1)).toBe(false);
    expect(isManagedProjectPort(projectPortEnd + 1)).toBe(false);
    expect(isManagedProjectPort(null)).toBe(false);
  });

  it("reports the ensured local URL as a safe managed origin", () => {
    const payload = localProjectIdentityPayload(managedUrl);

    expect(payload).toMatchObject({
      appName: "Ward Flow",
      identityPath: "/api/local-project-id",
      localServer: {
        currentUrl: `http://localhost:${projectPortStart}`,
        currentPort: projectPortStart,
        projectPortStart,
        projectPortEnd,
        safeLocalOrigin: true,
        requestOrigin: null,
        requestReferer: null,
        unsafeLocalCaller: null,
      },
    });
    expect(payload.projectId).toMatch(/^clinical-kb:[0-9a-f]{12}$/);
  });

  it("flags an unmanaged local port so callers are pushed back to npm run ensure", () => {
    expect(localProjectIdentityPayload(unmanagedUrl).localServer).toMatchObject({
      currentUrl: "http://localhost:3000",
      currentPort: 3000,
      safeLocalOrigin: false,
    });
  });

  it("infers the protocol default port when the URL carries none", () => {
    expect(localProjectIdentityPayload("http://localhost/api/setup-status").localServer).toMatchObject({
      currentPort: 80,
      safeLocalOrigin: false,
    });
    expect(localProjectIdentityPayload("https://localhost/api/setup-status").localServer).toMatchObject({
      currentPort: 443,
      safeLocalOrigin: false,
    });
  });

  it("leaves deployed hosts unguarded because the port range is a local-only concept", () => {
    expect(localProjectIdentityPayload("https://psychiatry.tools/api/setup-status").localServer).toMatchObject({
      currentUrl: null,
      currentPort: null,
      safeLocalOrigin: true,
    });
  });

  it("treats an unmanaged local Origin as an unsafe caller even on a managed server port", () => {
    const payload = localProjectRequestIdentityPayload(request(managedUrl, { origin: "http://localhost:3000" }));

    expect(payload.localServer).toMatchObject({
      requestOrigin: "http://localhost:3000",
      requestReferer: null,
      unsafeLocalCaller: "http://localhost:3000",
      safeLocalOrigin: false,
    });
    expect(isSafeLocalProjectRequest(request(managedUrl, { origin: "http://localhost:3000" }))).toBe(false);
  });

  it("falls back to the Referer when no Origin header is present", () => {
    const payload = localProjectRequestIdentityPayload(
      request(managedUrl, { referer: "http://127.0.0.1:3000/documents" }),
    );

    expect(payload.localServer).toMatchObject({
      unsafeLocalCaller: "http://127.0.0.1:3000",
      safeLocalOrigin: false,
    });
  });

  it("accepts managed, remote, and unparseable caller headers", () => {
    const managedOrigin = `http://localhost:${projectPortStart}`;

    expect(
      localProjectRequestIdentityPayload(request(managedUrl, { origin: managedOrigin })).localServer,
    ).toMatchObject({ unsafeLocalCaller: null, safeLocalOrigin: true });
    expect(
      localProjectRequestIdentityPayload(request(managedUrl, { origin: "https://psychiatry.tools" })).localServer,
    ).toMatchObject({ unsafeLocalCaller: null, safeLocalOrigin: true });
    expect(localProjectRequestIdentityPayload(request(managedUrl, { origin: "null" })).localServer).toMatchObject({
      unsafeLocalCaller: null,
      safeLocalOrigin: true,
    });
    expect(isSafeLocalProjectRequest(request(managedUrl))).toBe(true);
  });

  it("asserts safe requests and throws a payload-carrying error for unsafe ones", () => {
    expect(() => assertSafeLocalProjectRequest(request(managedUrl))).not.toThrow();

    let thrown: unknown;
    try {
      assertSafeLocalProjectRequest(request(unmanagedUrl));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(UnsafeLocalProjectOriginError);
    const error = thrown as UnsafeLocalProjectOriginError;
    expect(error.name).toBe("UnsafeLocalProjectOriginError");
    expect(error.message).toContain("npm run ensure");
    expect(error.payload.localServer.safeLocalOrigin).toBe(false);
  });

  /*
   * ⚠️ **EVERY TEST ABOVE BUILDS ITS `Request` FROM A `localhost` URL, AND NO REAL REQUEST EVER
   * LOOKS LIKE THAT.** Measured 2026-09-07 against this project's live `next dev` on port 4215: a
   * plain `curl http://localhost:4215/api/local-project-id` arrives with
   * `request.url === "http://0.0.0.0:4215/api/local-project-id"` — the address the server BOUND to,
   * not the one the caller asked for. `0.0.0.0` is not a loopback name, so `isLocalUrl` was false
   * for every request that has ever reached this guard, `currentPort` was null, and
   * `!local || isManagedProjectPort(port)` had a permanently-true first branch. The managed-port
   * half of the guard decided nothing; only the Origin/Referer half above still worked.
   *
   * The suite went green throughout, because the tests and the code shared one wrong assumption
   * about `request.url`. So these cases are written from the live payload instead: the URL is the
   * bind address and the requested host is in the `Host` header, which is where it actually is.
   */
  describe("judges the request by the host the caller asked for, not the address the server bound to", () => {
    const boundUrl = (port: number) => `http://0.0.0.0:${port}/api/setup-status`;

    it("rejects a local caller on an unmanaged port even though request.url says 0.0.0.0", () => {
      const payload = localProjectRequestIdentityPayload(request(boundUrl(3000), { host: "localhost:3000" }));

      expect(payload.localServer).toMatchObject({
        currentUrl: "http://localhost:3000",
        currentPort: 3000,
        safeLocalOrigin: false,
      });
      expect(isSafeLocalProjectRequest(request(boundUrl(3000), { host: "localhost:3000" }))).toBe(false);
      expect(() => assertSafeLocalProjectRequest(request(boundUrl(3000), { host: "localhost:3000" }))).toThrow(
        UnsafeLocalProjectOriginError,
      );
    });

    it("accepts the ensured server and reports the URL the caller can actually reuse", () => {
      const payload = localProjectRequestIdentityPayload(
        request(boundUrl(projectPortStart), { host: `localhost:${projectPortStart}` }),
      );

      expect(payload.localServer).toMatchObject({
        currentUrl: `http://localhost:${projectPortStart}`,
        currentPort: projectPortStart,
        safeLocalOrigin: true,
      });
    });

    it("reads loopback literals and IPv6 brackets out of the Host header", () => {
      expect(
        localProjectRequestIdentityPayload(request(boundUrl(3000), { host: "127.0.0.1:3000" })).localServer,
      ).toMatchObject({ currentPort: 3000, safeLocalOrigin: false });
      expect(
        localProjectRequestIdentityPayload(request(boundUrl(3000), { host: "[::1]:3000" })).localServer,
      ).toMatchObject({ currentUrl: "http://[::1]:3000", currentPort: 3000, safeLocalOrigin: false });
      expect(
        localProjectRequestIdentityPayload(request(boundUrl(projectPortEnd), { host: `[::1]:${projectPortEnd}` }))
          .localServer.safeLocalOrigin,
      ).toBe(true);
    });

    it("leaves the deployed host unguarded, which is the branch production depends on", () => {
      /*
       * The whole repair rests on `Host` being the browser-facing host in production rather than
       * anything loopback. That is not an assumption this file introduces: `src/lib/api-csrf.ts`
       * already admits `Host`/`X-Forwarded-Host` as the addressed host precisely because Railway
       * terminates TLS in front of the app, so every state-changing request in production already
       * depends on it. If it were loopback there, CSRF would be rejecting real users today.
       */
      expect(
        localProjectRequestIdentityPayload(
          request("http://0.0.0.0:8080/api/setup-status", { host: "psychiatry.tools" }),
        ).localServer,
      ).toMatchObject({ currentUrl: null, currentPort: null, safeLocalOrigin: true, pid: null });
    });

    it("falls back to the request URL when there is no Host header to judge by", () => {
      // HTTP/1.1 requires Host, so this is the in-process caller. Judging by the URL is what the
      // guard did before, and it must stay strict rather than defaulting to "safe".
      expect(localProjectRequestIdentityPayload(request(unmanagedUrl)).localServer.safeLocalOrigin).toBe(false);
      expect(localProjectRequestIdentityPayload(request(managedUrl)).localServer.safeLocalOrigin).toBe(true);
    });

    it("still lets an unmanaged Origin condemn a request that arrived on a managed port", () => {
      // The half of the guard that was never inert must survive the repair.
      expect(
        localProjectRequestIdentityPayload(
          request(boundUrl(projectPortStart), {
            host: `localhost:${projectPortStart}`,
            origin: "http://localhost:3000",
          }),
        ).localServer,
      ).toMatchObject({ unsafeLocalCaller: "http://localhost:3000", safeLocalOrigin: false });
    });
  });

  it("answers an unsafe local caller with an uncached 409 that names the remediation", async () => {
    const error = new UnsafeLocalProjectOriginError(localProjectIdentityPayload(unmanagedUrl));
    const response = localProjectOriginErrorResponse(error);
    const body = (await response.json()) as { error: string; run: string; identity: { projectId: string } };

    expect(response.status).toBe(409);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Clinical-KB-Local-Guard")).toBe("unsafe-local-origin");
    expect(body.run).toBe("npm run ensure");
    expect(body.error).toContain("ensured Ward Flow local URL");
    expect(body.identity.projectId).toBe(error.payload.projectId);

    const direct = unsafeLocalProjectResponse(error.payload);
    expect(direct.status).toBe(409);
  });
});

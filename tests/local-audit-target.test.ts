import { describe, expect, it, vi } from "vitest";
import { auditTargetOrigin, resolveAuditTarget } from "../scripts/ward-flow/local-audit-target.mjs";
import { localProjectId } from "../src/lib/local-server-utils.mjs";
import { selectedStartupPort, startupFailure } from "../scripts/local-server-startup.mjs";
describe("local audit target", () => {
  it("does not silently move an ensure-selected port and preserves interactive fallback", async () => {
    const findFree = vi.fn(async () => 4153),
      canListen = vi.fn(async () => false),
      isReserved = () => false;
    await expect(selectedStartupPort(4152, { strict: true, canListen, isReserved, findFree })).rejects.toThrow(
      /will not move/,
    );
    expect(findFree).not.toHaveBeenCalled();
    await expect(selectedStartupPort(4152, { strict: false, canListen, isReserved, findFree })).resolves.toBe(4153);
    expect(startupFailure({ error: undefined, exitCode: 1, signalCode: null })).toMatch(/before readiness/);
    expect(startupFailure({ error: undefined, exitCode: null, signalCode: null })).toBeNull();
  });
  it("rejects nonlocal origins, credentials, routes and implicit ports before making a request", async () => {
    const request = vi.fn();
    for (const url of [
      "https://localhost:4153",
      "http://example.com:4153",
      "http://localhost",
      "http://user@localhost:4153",
      "http://localhost:4153/route",
    ]) {
      expect(() => auditTargetOrigin(url)).toThrow();
      await expect(resolveAuditTarget({ url, request })).rejects.toThrow();
    }
    expect(request).not.toHaveBeenCalled();
  });
  it("verifies ensure output and keeps checkout provenance separate from server identity", async () => {
    const root = process.cwd();
    const ensure = vi.fn(() => "http://localhost:4153");
    const request = vi.fn(async (_url: string, _options: { redirect: string }) => ({
      ok: true,
      redirected: false,
      json: async () => ({
        appName: "Ward Flow",
        projectId: localProjectId(root),
        localServer: { safeLocalOrigin: true },
        runtimeMode: "development",
      }),
    }));
    const result = await resolveAuditTarget({
      root,
      url: "",
      ensure,
      request,
      source: () => ({ sha: "controlled-checkout", dirty: true }),
    });
    expect(ensure).toHaveBeenCalledOnce();
    expect(request.mock.calls[0][1].redirect).toBe("error");
    expect(result).toMatchObject({ url: "http://localhost:4153", source: { sha: "controlled-checkout", dirty: true } });
  });
  it("rejects redirects and wrong checkout responses", async () => {
    const common = { url: "http://127.0.0.1:4153", source: () => ({ sha: "fixture", dirty: false }) };
    await expect(
      resolveAuditTarget({ ...common, request: async () => ({ ok: true, redirected: true }) }),
    ).rejects.toThrow(/redirected/);
    await expect(
      resolveAuditTarget({
        ...common,
        request: async () => ({
          ok: true,
          redirected: false,
          json: async () => ({ appName: "Ward Flow", projectId: "other", localServer: { safeLocalOrigin: true } }),
        }),
      }),
    ).rejects.toThrow(/identity/);
  });
});

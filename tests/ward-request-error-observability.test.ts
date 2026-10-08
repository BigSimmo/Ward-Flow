import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";
import { onRequestError } from "../src/instrumentation";

afterEach(() => vi.restoreAllMocks());

const context = {
  routerKind: "App Router",
  routePath: "/mockups/ward-flow/patients/[id]",
  routeType: "render",
  renderSource: "react-server-components",
  revalidateReason: undefined,
  renderType: "dynamic",
} as const;

describe("Ward server error instrumentation", () => {
  it("records useful operational context without raw request, error or record text", async () => {
    const emit = vi.spyOn(logger, "error").mockImplementation(() => {});
    const outbound = vi.spyOn(globalThis, "fetch");
    const secret = "SYNTHETIC_PRIVATE_SENTINEL";
    await onRequestError(
      new Error(secret),
      { method: "GET", path: `/patients/${secret}?token=${secret}`, headers: { authorization: secret } },
      context,
    );
    expect(emit).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenCalledWith("ward.request_failed", {
      incidentId: expect.stringMatching(/^[a-f0-9-]{36}$/),
      method: "GET",
      routerKind: "App Router",
      routeType: "render",
    });
    expect(JSON.stringify(emit.mock.calls)).not.toContain(secret);
    expect(outbound).not.toHaveBeenCalled();
  });

  it("does not forward arbitrary method/context strings", async () => {
    const emit = vi.spyOn(logger, "error").mockImplementation(() => {});
    await onRequestError(null, { method: "PRIVATE_SENTINEL", path: "/", headers: {} }, {
      ...context,
      routeType: "PRIVATE_SENTINEL",
      routerKind: "PRIVATE_SENTINEL",
    } as unknown as Parameters<typeof onRequestError>[2]);
    expect(JSON.stringify(emit.mock.calls)).not.toContain("PRIVATE_SENTINEL");
  });

  it("cannot replace the application failure with a monitoring failure", async () => {
    vi.spyOn(logger, "error").mockImplementation(() => {
      throw new Error("monitor unavailable");
    });
    await expect(
      onRequestError(new Error("original"), { method: "GET", path: "/", headers: {} }, context),
    ).resolves.toBeUndefined();
  });
});

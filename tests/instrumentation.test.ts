import { afterEach, describe, expect, it, vi } from "vitest";

// The boot guard (src/instrumentation.ts) only refuses to start a production
// server when PLAYWRIGHT_OFFLINE_MODE is set outside the isolated, provider-free
// Playwright test profile. Every other production/runtime combination is a
// no-op. It must also be a no-op outside the Node.js production runtime so dev
// and Edge keep working. env is parsed at import time, so each case re-imports
// the module with fresh stubs.

const ENV_KEYS = ["NEXT_RUNTIME", "NODE_ENV", "PLAYWRIGHT_OFFLINE_MODE", "NEXT_DIST_DIR"] as const;

async function loadInstrumentation(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  vi.resetModules();
  for (const key of ENV_KEYS) {
    vi.stubEnv(key, overrides[key]);
  }
  return import("../src/instrumentation");
}

async function loadRegister(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  const mod = await loadInstrumentation(overrides);
  return mod.register;
}

const PRODUCTION_NODE = { NEXT_RUNTIME: "nodejs", NODE_ENV: "production" } as const;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("instrumentation boot guard", () => {
  it("allows only the isolated Playwright production profile", async () => {
    const valid = await loadRegister({
      ...PRODUCTION_NODE,
      PLAYWRIGHT_OFFLINE_MODE: "true",
      NEXT_DIST_DIR: ".next-playwright/123-456/dist",
    });
    await expect(valid()).resolves.toBeUndefined();

    const invalidOutput = await loadRegister({
      ...PRODUCTION_NODE,
      PLAYWRIGHT_OFFLINE_MODE: "true",
      NEXT_DIST_DIR: ".next",
    });
    await expect(invalidOutput()).rejects.toThrow(/invalid isolated Playwright offline environment/);
  });

  it("is a no-op on the Edge runtime", async () => {
    const register = await loadRegister({ NEXT_RUNTIME: "edge", NODE_ENV: "production" });
    await expect(register()).resolves.toBeUndefined();
  });
});

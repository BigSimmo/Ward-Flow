import { afterEach, describe, expect, it, vi } from "vitest";

// The boot guard (src/instrumentation.ts) only refuses to start a production
// server when PLAYWRIGHT_OFFLINE_MODE is set outside the isolated, provider-free
// Playwright test profile. Every other production/runtime combination is a
// no-op. It must also be a no-op outside the Node.js production runtime so dev
// and Edge keep working. env is parsed at import time, so each case re-imports
// the module with fresh stubs.

const MATCHING_URL = "https://invented-not-a-real-ref.supabase.co";

const ENV_KEYS = [
  "NEXT_RUNTIME",
  "NODE_ENV",
  "NEXT_PUBLIC_DEMO_MODE",
  "NEXT_PUBLIC_WARD_SHARED_ENABLED",
  "NEXT_PUBLIC_WARD_API_BASE_URL",
  "NEXT_PUBLIC_WARD_SUPABASE_URL",
  "NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY",
  "WARD_SUPABASE_DATABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PLAYWRIGHT_OFFLINE_MODE",
  "NEXT_DIST_DIR",
] as const;

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
  it("allows only the isolated provider-free Playwright production profile", async () => {
    const offline = {
      ...PRODUCTION_NODE,
      PLAYWRIGHT_OFFLINE_MODE: "true",
      NEXT_DIST_DIR: ".next-playwright/123-456/dist",
      NEXT_PUBLIC_DEMO_MODE: "true",
      NEXT_PUBLIC_WARD_SHARED_ENABLED: "false",
    };
    const valid = await loadRegister(offline);
    await expect(valid()).resolves.toBeUndefined();

    // CB-6: each of Ward Flow's own provider settings refuses the start on its own.
    const live: Partial<Record<(typeof ENV_KEYS)[number], string>>[] = [
      { NEXT_PUBLIC_WARD_SUPABASE_URL: MATCHING_URL },
      { NEXT_PUBLIC_WARD_SHARED_ENABLED: "true" },
      { NEXT_PUBLIC_WARD_API_BASE_URL: "https://api.example.invalid" },
      { NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic" },
      { WARD_SUPABASE_DATABASE_URL: "postgresql://synthetic@db.example.invalid/ward" },
      { SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-role" },
      { NEXT_PUBLIC_DEMO_MODE: "false" },
      { NEXT_DIST_DIR: ".next" },
    ];
    for (const setting of live) {
      const register = await loadRegister({ ...offline, ...setting });
      await expect(register(), JSON.stringify(Object.keys(setting))).rejects.toThrow(
        /invalid isolated Playwright offline environment/,
      );
    }
  });

  it("is a no-op on the Edge runtime", async () => {
    const register = await loadRegister({ NEXT_RUNTIME: "edge", NODE_ENV: "production" });
    await expect(register()).resolves.toBeUndefined();
  });
});

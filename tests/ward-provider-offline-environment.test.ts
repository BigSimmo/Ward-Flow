import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { offlineTestEnvironment, providerEnvironmentKeys } from "../scripts/test-environment.mjs";

describe("Ward provider isolation in offline runners", () => {
  it("overrides inherited shared mode and blanks provider values against local env reload", () => {
    const keys = [
      "NEXT_PUBLIC_WARD_API_BASE_URL",
      "NEXT_PUBLIC_WARD_AUTH_PROVIDER",
      "NEXT_PUBLIC_WARD_SUPABASE_URL",
      "NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_WARD_COORDINATOR_EMAIL",
      "NEXT_PUBLIC_WARD_CLIENT_ID",
      "NEXT_PUBLIC_WARD_TENANT_ID",
      "NEXT_PUBLIC_WARD_API_SCOPE",
      "WARD_DATABASE_PROVIDER",
      "WARD_AUTH_PROVIDER",
      "WARD_SUPABASE_PROJECT_REF",
      "WARD_SUPABASE_URL",
      "WARD_SUPABASE_PUBLISHABLE_KEY",
      "WARD_SUPABASE_DATABASE_URL",
      "WARD_SUPABASE_CA_CERT_FILE",
    ];
    expect(providerEnvironmentKeys).toEqual(expect.arrayContaining(keys));
    const inherited = Object.fromEntries(keys.map((key: string) => [key, "live-provider-value"]));
    const env: Record<string, string | undefined> = offlineTestEnvironment({
      ...inherited,
      NEXT_PUBLIC_WARD_SHARED_ENABLED: "true",
    });
    expect(env.NEXT_PUBLIC_WARD_SHARED_ENABLED).toBe("false");
    for (const key of keys) expect(env[key]).toBe("");
  });

  it("the production browser runner explicitly selects demo operation", () => {
    const runner = readFileSync(new URL("../scripts/run-playwright.mjs", import.meta.url), "utf8");
    expect(runner).toMatch(
      /offlineTestEnvironment\(lock\.environment,\s*\{[\s\S]*?NEXT_PUBLIC_WARD_SHARED_ENABLED: "false"/,
    );
  });
});

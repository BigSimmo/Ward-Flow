import { afterEach, describe, expect, it, vi } from "vitest";
import { selectWardAuthProvider } from "../src/components/ward-management/ward-shared-access";
import { resolveWardAuthProvider } from "../src/lib/security-headers";

describe("browser auth provider selection", () => {
  afterEach(() => vi.unstubAllEnvs());
  // The component cannot import src/lib (Ward Flow seam), so its copy of the selector must agree
  // with the CSP side for every combination of the public settings.
  it("agrees between the sign-in adapter and the CSP for every public setting combination", () => {
    const selectors = ["", " supabase ", "entra", "unknown"];
    const ids = ["", "00000000-0000-4000-8000-0000000000aa"];
    const urls = ["", "https://zakzoemeedfepxcstsou.supabase.co"];
    for (const selector of selectors)
      for (const tenant of ids)
        for (const client of ids)
          for (const url of urls) {
            vi.stubEnv("NEXT_PUBLIC_WARD_AUTH_PROVIDER", selector);
            vi.stubEnv("NEXT_PUBLIC_WARD_TENANT_ID", tenant);
            vi.stubEnv("NEXT_PUBLIC_WARD_CLIENT_ID", client);
            vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_URL", url);
            expect(selectWardAuthProvider()).toBe(resolveWardAuthProvider());
          }
  });
});

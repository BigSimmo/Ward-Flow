import { describe, expect, it, vi } from "vitest";

import { SupabaseWardAuth } from "../src/components/ward-management/ward-supabase-auth";

/**
 * Part B item 49 (26 October 2026): groundwork for signing in with a second step, either an
 * authenticator app (a Supabase factor) or the health service's own sign-in. Nothing in the app
 * calls these yet; the tests pin the Supabase Auth requests they make. Synthetic values only.
 */
const url = "https://zakzoemeedfepxcstsou.supabase.co";
const user = { id: "12345678-1234-1234-1234-123456789abc" };
const factorId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const session = (access_token: string) => ({ access_token, refresh_token: "refresh", expires_in: 3600, user });

function signedIn(route: (path: string, init?: RequestInit) => Response | undefined) {
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace(url + "/auth/v1", "");
    const answer = route(path, init);
    if (answer) return answer;
    if (path === "/user") return Response.json(user);
    return Response.json(session("access-1"));
  });
  const auth = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", fetch: fetcher });
  return { auth, fetcher, start: () => auth.signIn("synthetic@example.invalid", "synthetic-password") };
}

describe("second sign-in step groundwork (Part B item 49)", () => {
  it("lists only authenticator app factors and whether each is confirmed", async () => {
    let listing = false;
    const { auth, start } = signedIn((path) =>
      path === "/user" && listing
        ? Response.json({
            ...user,
            factors: [
              { id: factorId, factor_type: "totp", status: "verified" },
              { id: "other", factor_type: "phone", status: "verified" },
              { id: "pending", factor_type: "totp", status: "unverified" },
            ],
          })
        : undefined,
    );
    await start();
    listing = true;
    expect(await auth.secondStepFactors()).toEqual([
      { id: factorId, verified: true },
      { id: "pending", verified: false },
    ]);
    auth.dispose();
  });

  it("starts adding an authenticator app and returns its QR code once", async () => {
    const { auth, fetcher, start } = signedIn((path) =>
      path === "/factors"
        ? Response.json({
            id: factorId,
            type: "totp",
            totp: { qr_code: "data:image/svg+xml;synthetic", secret: "SYNTHETIC", uri: "otpauth://totp/synthetic" },
          })
        : undefined,
    );
    await start();
    expect(await auth.enrolSecondStep("Synthetic phone")).toEqual({
      id: factorId,
      qrCode: "data:image/svg+xml;synthetic",
      uri: "otpauth://totp/synthetic",
    });
    const [, init] = fetcher.mock.calls.at(-1)!;
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ factor_type: "totp", friendly_name: "Synthetic phone" });
    expect((init?.headers as Record<string, string>).authorization).toBe("Bearer access-1");
    auth.dispose();
  });

  it("checks a code with a challenge, then uses the raised sign-in", async () => {
    const { auth, fetcher, start } = signedIn((path) => {
      if (path === `/factors/${factorId}/challenge`) return Response.json({ id: "challenge-1" });
      if (path === `/factors/${factorId}/verify`) return Response.json(session("access-aal2"));
      return undefined;
    });
    await start();
    await auth.verifySecondStep(factorId, "123456");
    const verify = fetcher.mock.calls.find(([input]) => String(input).endsWith("/verify"));
    expect(JSON.parse(String(verify?.[1]?.body))).toEqual({ challenge_id: "challenge-1", code: "123456" });
    expect(await auth.token()).toBe("access-aal2");
    auth.dispose();
  });

  it("refuses a code that is not 6 digits without asking the server", async () => {
    const { auth, fetcher, start } = signedIn(() => undefined);
    await start();
    const calls = fetcher.mock.calls.length;
    await expect(auth.verifySecondStep(factorId, "12345")).rejects.toMatchObject({ kind: "credentials" });
    await expect(auth.verifySecondStep("not-a-factor", "123456")).rejects.toMatchObject({ kind: "credentials" });
    expect(fetcher.mock.calls.length).toBe(calls);
    auth.dispose();
  });

  it("asks for the health service's sign-in address and accepts only https", async () => {
    let answer = "https://sso.example.invalid/saml/start";
    const { auth, fetcher } = signedIn((path) => (path === "/sso" ? Response.json({ url: answer }) : undefined));
    expect(await auth.singleSignOnUrl(" Health.Example.Invalid ", "https://wardflow.example.invalid/ward-flow")).toBe(
      answer,
    );
    expect(JSON.parse(String(fetcher.mock.calls.at(-1)?.[1]?.body))).toEqual({
      domain: "health.example.invalid",
      redirect_to: "https://wardflow.example.invalid/ward-flow",
      skip_http_redirect: true,
    });
    answer = "http://sso.example.invalid/saml/start";
    await expect(
      auth.singleSignOnUrl("health.example.invalid", "https://wardflow.example.invalid/ward-flow"),
    ).rejects.toMatchObject({ kind: "unavailable" });
    await expect(
      auth.singleSignOnUrl("health.example.invalid", "https://wardflow.example.invalid/elsewhere"),
    ).rejects.toMatchObject({ kind: "unavailable" });
    auth.dispose();
  });
});

import { describe, expect, it } from "vitest";
import { findSecretMatches } from "../scripts/check-client-bundle-secrets.mjs";

// Every fixture below is invented and assembled at runtime, so no literal credential shape sits in
// the source for the repository's own added-lines scan or external secret scanners to flag.
const filler = (length: number) => "FAKEfixture0123456789".repeat(4).slice(0, length);
const segment = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (role: string) =>
  [segment({ alg: "HS256", typ: "JWT" }), segment({ iss: "supabase", role, ref: "synthetic" }), filler(30)].join(".");

const rulesIn = (text: string) => findSecretMatches(text).map((match: { rule: string }) => match.rule);

describe("client bundle secret patterns (A4-06)", () => {
  it.each([
    ["Supabase Secret Key", "sb_" + "secret_" + filler(32)],
    ["Supabase service-role JWT", jwt("service_" + "role")],
    ["Supabase service-role JWT", jwt("supabase_" + "admin")],
    ["Slack Token", "xox" + "b-" + "1234567890-" + filler(20)],
    ["Slack Token", "xox" + "p-" + filler(24)],
    ["Stripe Live Secret or Restricted Key", "sk" + "_live_" + filler(24)],
    ["Stripe Live Secret or Restricted Key", "rk" + "_live_" + filler(24)],
    ["Sentry Auth Token", "sntr" + "ys_" + segment({ iat: 1, org: "synthetic" }) + "_" + filler(20)],
  ])("flags a fake %s", (rule, value) => {
    expect(rulesIn(`const leaked = "${value}";`)).toContain(rule);
  });

  it("passes the public anon-role JWT a client bundle legitimately carries", () => {
    expect(rulesIn(`createClient(url, "${jwt("anon")}")`)).toEqual([]);
    expect(rulesIn(`const t = "${jwt("authenticated")}";`)).toEqual([]);
  });

  it("passes ordinary code and near-miss strings", () => {
    for (const text of [
      'export const safe = true; const id = "sb_publishable_" + key;',
      "const live = sk_test_mode; // sk_live_ prefix only in docs",
      "const slack = 'xoxo-hugs';",
      "const sentry = process.env.SENTRY_AUTH_TOKEN;",
      "const notJwt = 'eyJ.not.a.token';",
    ]) {
      expect(rulesIn(text), text).toEqual([]);
    }
  });
});

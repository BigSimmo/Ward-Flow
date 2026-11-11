import { describe, expect, it } from "vitest";
import { signInStartedAt } from "@/lib/sign-in-started-at";

const token = (claims: unknown) => `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;

describe("signInStartedAt", () => {
  it("returns the oldest factor time in milliseconds", () => {
    expect(signInStartedAt(token({ amr: [{ timestamp: 200 }, { timestamp: 100 }] }))).toBe(100_000);
  });
  it("reads base64url payloads with - and _ characters and non-ASCII text", () => {
    const value = token({ amr: [{ timestamp: 1_700_000_000 }], note: "ü??>>>" });
    expect(value).toMatch(/[-_]/);
    expect(signInStartedAt(value)).toBe(1_700_000_000_000);
  });
  it("returns null for a token without factor times or an unreadable token", () => {
    expect(signInStartedAt(token({ amr: [] }))).toBeNull();
    expect(signInStartedAt(token({}))).toBeNull();
    expect(signInStartedAt("not-a-token")).toBeNull();
  });
});

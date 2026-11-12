import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  FRONT_DOOR_PASS_COOKIE,
  demoCodeFingerprint,
  issuePass,
  passMatchesDemoCode,
  verifyPass,
} from "../src/lib/front-door-pass";
import { frontDoorVerdict } from "../src/proxy";

// Synthetic secrets and codes only: these values exist for this test file.
const SECRET = "synthetic-binding-secret-0123456789abcdef"; // gitleaks:allow
const CODE = "SYNTHETIC-DEMO-CODE-A";
const ON = { WARD_FRONT_DOOR: "required", WARD_PASS_SECRET: SECRET, WARD_DEMO_CODE: CODE };

function page(path: string, pass: string): NextRequest {
  const request = new NextRequest(new URL(path, "https://ward.example.test"));
  request.cookies.set(FRONT_DOOR_PASS_COOKIE, pass);
  return request;
}

describe("demo pass bound to the demo code", () => {
  it("carries a fingerprint of the code, never the code itself", async () => {
    const { value } = await issuePass(SECRET, { kind: "demo", hours: 8 }, Date.now(), ON);
    const pass = (await verifyPass(SECRET, value))!;
    expect(pass.code).toBe(await demoCodeFingerprint(SECRET, ON));
    expect(Buffer.from(value.split(".")[0]!, "base64url").toString("utf8")).not.toContain("SYNTHETIC");
    // The same code in another form (case, spaces, dashes) is the same code.
    expect(await demoCodeFingerprint(SECRET, { WARD_DEMO_CODE: "synthetic demo code a" })).toBe(pass.code);
  });

  it("opens the demo while the code stands and closes it as soon as the code changes", async () => {
    const { value } = await issuePass(SECRET, { kind: "demo", hours: 8 }, Date.now(), ON);
    expect(await frontDoorVerdict(page("/ward-flow/capacity", value), ON)).toBeNull();
    const changed = { ...ON, WARD_DEMO_CODE: "SYNTHETIC-DEMO-CODE-B" };
    const refused = await frontDoorVerdict(page("/ward-flow/capacity", value), changed);
    expect(refused?.status).toBe(307);
    expect(new URL(refused!.headers.get("location")!).pathname).toBe("/sign-in");
    expect((await frontDoorVerdict(page("/api/workspace", value), changed))?.status).toBe(401);
    const removed = { WARD_FRONT_DOOR: "required", WARD_PASS_SECRET: SECRET };
    expect((await frontDoorVerdict(page("/api/workspace", value), removed))?.status).toBe(401);
  });

  it("refuses a demo pass with no fingerprint and leaves account passes alone", async () => {
    const now = Date.now();
    const bare = { kind: "demo" as const, issuedAt: now, expiresAt: now + 60_000 };
    expect(await passMatchesDemoCode(SECRET, bare, ON)).toBe(false);
    const account = (await issuePass(SECRET, { kind: "account", subject: "synthetic-id", hours: 12 }, now, ON)).value;
    const checked = (await verifyPass(SECRET, account))!;
    expect(checked.code).toBeUndefined();
    expect(await passMatchesDemoCode(SECRET, checked, { ...ON, WARD_DEMO_CODE: "OTHER" })).toBe(true);
    expect(await frontDoorVerdict(page("/ward-flow", account), { ...ON, WARD_DEMO_CODE: "OTHER" })).toBeNull();
  });
});

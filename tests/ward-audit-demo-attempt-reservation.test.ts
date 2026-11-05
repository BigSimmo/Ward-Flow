import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/session/route";
import { resetWrongTriesForTests } from "@/lib/demo-code-tries";
import { demoCodeMatches } from "@/lib/front-door-pass";

vi.mock("@/lib/front-door-pass", async (original) => ({
  ...(await original<typeof import("@/lib/front-door-pass")>()),
  demoCodeMatches: vi.fn(),
}));

afterEach(() => {
  resetWrongTriesForTests();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("reserves the address budget before admitting asynchronous code comparisons", async () => {
  vi.stubEnv("WARD_FRONT_DOOR", "required");
  vi.stubEnv("WARD_PASS_SECRET", "synthetic-audit-reservation-secret-0123456789"); // gitleaks:allow
  vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "false");
  const finish: Array<() => void> = [];
  vi.mocked(demoCodeMatches).mockImplementation(
    () => new Promise<boolean>((resolve) => finish.push(() => resolve(false))),
  );
  const requests: Array<Promise<Response>> = [];
  try {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const before = vi.mocked(demoCodeMatches).mock.calls.length;
      let settled = false;
      const pending = POST(
        new NextRequest("https://ward.example.test/api/session", {
          method: "POST",
          headers: { "content-type": "application/json", "x-real-ip": "192.0.2.80" },
          body: JSON.stringify({ demoCode: "WRONG" }),
        }),
      );
      requests.push(pending);
      void pending.then(() => {
        settled = true;
      });
      // Stage real body reads so this checks the separate wrong-code budget, not the8-read
      // parser limit. Keep every admitted comparison pending. Without pre-await reservation,
      // all20 comparisons enter; with it, the last10 requests refuse before comparison.
      await vi.waitFor(
        () => {
          expect(settled || vi.mocked(demoCodeMatches).mock.calls.length > before).toBe(true);
        },
        { interval: 1, timeout: 1000 },
      );
    }
    expect(demoCodeMatches).toHaveBeenCalledTimes(10);
  } finally {
    finish.forEach((resolve) => resolve());
    await Promise.all(requests);
  }
  const statuses = (await Promise.all(requests)).map((response) => response.status);
  expect(statuses.filter((status) => status === 401)).toHaveLength(10);
  expect(statuses.filter((status) => status === 429)).toHaveLength(10);
});

it("does not exhaust the wrong-code budget with successful presenter sign-ins", async () => {
  vi.stubEnv("WARD_FRONT_DOOR", "required");
  vi.stubEnv("WARD_PASS_SECRET", "synthetic-audit-reservation-secret-0123456789"); // gitleaks:allow
  vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "false");
  vi.mocked(demoCodeMatches).mockResolvedValue(true);
  for (let i = 0; i < 20; i++) {
    const response = await POST(
      new NextRequest("https://ward.example.test/api/session", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": "192.0.2.81" },
        body: JSON.stringify({ demoCode: "VALID-SYNTHETIC" }),
      }),
    );
    expect(response.status).toBe(204);
  }
});

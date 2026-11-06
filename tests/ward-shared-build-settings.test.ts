import { describe, expect, it } from "vitest";

import { assertSharedBuildSettings, sharedBuildSettingProblems } from "@/lib/ward-shared-build-settings";

/** CB-5 (front-end audit, 5 Nov 2026): a shared build without its sign-in settings stops with a plain message. */
const READY = {
  NEXT_PUBLIC_WARD_SHARED_ENABLED: "true",
  NEXT_PUBLIC_WARD_API_BASE_URL: "https://api.example.invalid",
  NEXT_PUBLIC_WARD_SUPABASE_URL: "https://auth.example.invalid",
  NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic",
};

describe("shared build settings (CB-5)", () => {
  it("asks nothing of a demo build", () => {
    expect(sharedBuildSettingProblems({})).toEqual([]);
    expect(sharedBuildSettingProblems({ NEXT_PUBLIC_WARD_SHARED_ENABLED: "false" })).toEqual([]);
    expect(() => assertSharedBuildSettings({})).not.toThrow();
  });

  it("accepts a complete shared build, and plain http to this computer only in development", () => {
    expect(sharedBuildSettingProblems(READY)).toEqual([]);
    const loopback = {
      ...READY,
      NEXT_PUBLIC_WARD_API_BASE_URL: "http://127.0.0.1:8787",
      NEXT_PUBLIC_WARD_SUPABASE_URL: "http://localhost:54321",
    };
    expect(sharedBuildSettingProblems({ ...loopback, NODE_ENV: "development" })).toEqual([]);
    // `next build` runs with NODE_ENV=production, where the CSP blocks plain http (security-headers.ts).
    for (const NODE_ENV of ["production", undefined]) {
      expect(sharedBuildSettingProblems({ ...loopback, NODE_ENV })).toEqual([
        "NEXT_PUBLIC_WARD_API_BASE_URL must start with https:// (plain http to this computer is allowed only in development).",
        "NEXT_PUBLIC_WARD_SUPABASE_URL must start with https:// (plain http to this computer is allowed only in development).",
      ]);
    }
  });

  it("names every missing or unusable setting, never its value", () => {
    const problems = sharedBuildSettingProblems({
      NEXT_PUBLIC_WARD_SHARED_ENABLED: "true",
      NEXT_PUBLIC_WARD_API_BASE_URL: "http://api.example.invalid",
      NEXT_PUBLIC_WARD_SUPABASE_URL: "not an address",
      NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY: " ",
    });
    expect(problems).toEqual([
      "NEXT_PUBLIC_WARD_API_BASE_URL must start with https:// (plain http to this computer is allowed only in development).",
      "NEXT_PUBLIC_WARD_SUPABASE_URL is not a web address.",
      "NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY is not set.",
    ]);
    expect(sharedBuildSettingProblems({ NEXT_PUBLIC_WARD_SHARED_ENABLED: "true" })).toHaveLength(3);
    expect(
      sharedBuildSettingProblems({
        ...READY,
        NEXT_PUBLIC_WARD_API_BASE_URL: "https://user:secret@api.example.invalid",
      }),
    ).toEqual(["NEXT_PUBLIC_WARD_API_BASE_URL must not carry a user name or password."]);
  });

  it("stops the build with one message that lists the problems", () => {
    expect(() => assertSharedBuildSettings({ ...READY, NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY: "" })).toThrow(
      /cannot sign anyone in:\n- NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY is not set\./,
    );
    let message = "";
    try {
      assertSharedBuildSettings({ ...READY, NEXT_PUBLIC_WARD_API_BASE_URL: "https://user:secret@api.example.invalid" });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toContain("secret");
  });
});

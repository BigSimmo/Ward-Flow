import { isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SignInPage, { metadata } from "../src/app/sign-in/page";
import { metadata as wardSignInMetadata } from "../src/app/ward-flow-sign-in/page";
import { BRAND_DESCRIPTION, BRAND_NAME } from "../src/lib/brand";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the /sign-in page", () => {
  it("simply opens Ward Flow while the front door is off", async () => {
    vi.stubEnv("WARD_FRONT_DOOR", "");
    await expect(SignInPage({ searchParams: Promise.resolve({ next: "/ward-flow/ed" }) })).rejects.toThrow(
      /NEXT_REDIRECT/,
    );
  });

  it("shows the door for a safe Ward Flow page while the front door is on", async () => {
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", "s".repeat(48));
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "true");
    const page = await SignInPage({ searchParams: Promise.resolve({ next: "/ward-flow/bed-meeting?tv=1" }) });
    expect(isValidElement(page)).toBe(true);
    expect((page as { props: { mode: string; next: string } }).props).toMatchObject({ mode: "account" });
    const offsite = await SignInPage({ searchParams: Promise.resolve({ next: ["//elsewhere.test"] }) });
    expect((offsite as { props: { next: string } }).props.next).toBe("/ward-flow");
  });

  it("previews the product, not the sign-in step, when a link is shared (INV-A18-104)", () => {
    for (const page of [metadata, wardSignInMetadata]) {
      expect(page.title).toBe("Sign in — Ward Flow");
      expect(page.openGraph).toMatchObject({ title: BRAND_NAME, description: BRAND_DESCRIPTION });
      expect(page.twitter).toMatchObject({ title: BRAND_NAME, description: BRAND_DESCRIPTION });
    }
  });
});

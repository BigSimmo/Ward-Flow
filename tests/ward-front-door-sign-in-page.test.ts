import { isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SignInPage, { metadata } from "../src/app/sign-in/page";
import { metadata as wardSignInMetadata } from "../src/app/bedchart-sign-in/page";
import { BRAND_DESCRIPTION, BRAND_NAME } from "../src/lib/brand";

// The root layout's metadata reads the request headers, and its font loader runs only in Next's
// build; the test has neither. The sign-in page reads no headers.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/font/local", () => ({ default: () => ({ className: "font", variable: "font", style: {} }) }));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the /sign-in page", () => {
  it("simply opens BedChart while the front door is off", async () => {
    vi.stubEnv("WARD_FRONT_DOOR", "");
    await expect(SignInPage({ searchParams: Promise.resolve({ next: "/bedchart/ed" }) })).rejects.toThrow(
      /NEXT_REDIRECT/,
    );
  });

  it("shows the door for a safe BedChart page while the front door is on", async () => {
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", "s".repeat(48));
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "true");
    const page = await SignInPage({ searchParams: Promise.resolve({ next: "/bedchart/bed-meeting?tv=1" }) });
    expect(isValidElement(page)).toBe(true);
    expect((page as { props: { mode: string; next: string } }).props).toMatchObject({ mode: "account" });
    const offsite = await SignInPage({ searchParams: Promise.resolve({ next: ["//elsewhere.test"] }) });
    expect((offsite as { props: { next: string } }).props.next).toBe("/bedchart");
  });

  it("previews the product, not the sign-in step, when a link is shared (INV-A18-104)", async () => {
    // The sign-in pages keep their own tab title and inherit the app's product preview.
    for (const page of [metadata, wardSignInMetadata]) {
      expect(page.title).toBe("Sign in — BedChart");
      expect(page.openGraph).toBeUndefined();
      expect(page.twitter).toBeUndefined();
    }
    const { generateMetadata } = await import("../src/app/layout");
    const app = await generateMetadata();
    expect(app.openGraph).toMatchObject({ title: BRAND_NAME, description: BRAND_DESCRIPTION });
    expect(app.twitter).toMatchObject({ title: BRAND_NAME, description: BRAND_DESCRIPTION });
  });
});

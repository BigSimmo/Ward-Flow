import { afterEach, describe, expect, it, vi } from "vitest";

import { isPhoneWidth } from "@/components/ward-management/ward-phone-width";
import { WF_PHONE_QUERY } from "@/components/wf";

/*
 * Search and forms review (31 Oct 2026): ED row forms and discharge sections put the cursor in
 * their first field only on a larger screen. On a phone the keyboard would rise over the form, so
 * focus on open asks this first.
 */
describe("isPhoneWidth", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubWidth(phone: boolean) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({ matches: phone && query === WF_PHONE_QUERY, media: query })),
    );
  }

  it("is true at phone width and false on a larger screen", () => {
    stubWidth(true);
    expect(isPhoneWidth()).toBe(true);
    stubWidth(false);
    expect(isPhoneWidth()).toBe(false);
  });

  it("is false where the browser cannot answer, so a larger-screen form still takes focus", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(isPhoneWidth()).toBe(false);
  });
});

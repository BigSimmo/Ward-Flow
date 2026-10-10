import { describe, expect, it } from "vitest";

import { isPhoneDesktopOnlyPath } from "@/components/ward-management/shell/ward-phone-desktop-only";
import {
  WARD_ADD_PERSON_HREF,
  WARD_VIEWS,
  resolveWardPrimaryAction,
  resolveWardScreenTitle,
} from "@/components/ward-management/ward-nav";

/** v10 build pass 2 shell fixes (10 Oct 2026). */
describe("v10 pass 2 shell", () => {
  it("titles the two report pages by their own names, not Home", () => {
    expect(resolveWardScreenTitle("/mockups/ward-flow/reports/downtime")).toBe("Downtime pack");
    expect(resolveWardScreenTitle("/mockups/ward-flow/reports/chronology")).toBe("Patient chronology");
    expect(resolveWardScreenTitle("/mockups/ward-flow/reports/chronology/")).toBe("Patient chronology");
  });

  it("puts New referral in the header on every statistics route, never Export the figures", () => {
    for (const route of [
      "/mockups/ward-flow/statistics",
      "/mockups/ward-flow/statistics/ward/rph-adult-secure",
      "/mockups/ward-flow/statistics/community/any-team",
      "/mockups/ward-flow/statistics/ed/rph",
      "/mockups/ward-flow/statistics/service/east",
    ]) {
      expect(resolveWardPrimaryAction(route)?.kind, route).toBe("new-referral");
    }
  });

  it("no longer gates Governance or Add a patient on a phone: both have their own phone layout", () => {
    const governance = WARD_VIEWS.find((view) => view.id === "governance")?.href;
    expect(governance).toBeDefined();
    expect(isPhoneDesktopOnlyPath(governance!)).toBe(false);
    expect(isPhoneDesktopOnlyPath(`${governance!}/registers`)).toBe(false);
    expect(isPhoneDesktopOnlyPath(WARD_ADD_PERSON_HREF)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { QUICK_BAR } from "@/components/ward-management/quick-bar/ward-quick-bar-spec";
import { ROLE_SCREENS } from "@/components/ward-management/ward-role-access";

describe("Quick bar (Josh, 8 Nov 2026)", () => {
  it("gives every desk at least two controls, none repeated", () => {
    for (const [role, controls] of Object.entries(QUICK_BAR)) {
      expect(controls.length, role).toBeGreaterThanOrEqual(2);
      const keys = controls.map((control) => (control.kind === "tool" ? control.tool : "referral"));
      expect(new Set(keys).size, role).toBe(keys.length);
    }
  });

  it("offers New referral only to desks that may start one", () => {
    for (const [role, controls] of Object.entries(QUICK_BAR)) {
      const offers = controls.some((control) => control.kind === "referral");
      const screens = ROLE_SCREENS[role as keyof typeof ROLE_SCREENS];
      const mayRefer = role === "coordinator" || screens["referral-new"] !== undefined;
      if (offers) expect(mayRefer, role).toBe(true);
    }
  });

  it("never offers network bed figures to the officer or the access admin", () => {
    for (const role of ["officer", "admin"] as const) {
      const tools = QUICK_BAR[role].flatMap((control) => (control.kind === "tool" ? [control.tool] : []));
      expect(tools).not.toContain("bed-finder");
      expect(tools).not.toContain("figures");
      expect(tools).not.toContain("messages");
    }
  });
});

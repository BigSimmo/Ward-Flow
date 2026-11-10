import { existsSync } from "node:fs";
import { join } from "node:path";
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
      // A desk may start a referral when it holds the screen with more than counts.
      const mayRefer = screens["referral-new"] === "all" || screens["referral-new"] === "own";
      if (offers) expect(mayRefer, role).toBe(true);
    }
  });

  it("lets the coordinator start a referral", () => {
    expect(ROLE_SCREENS.coordinator["referral-new"]).toBe("all");
  });

  it("never offers network bed figures to the officer or the access admin", () => {
    for (const role of ["officer", "admin"] as const) {
      const tools = QUICK_BAR[role].flatMap((control) => (control.kind === "tool" ? [control.tool] : []));
      expect(tools).not.toContain("bed-finder");
      expect(tools).not.toContain("figures");
      expect(tools).not.toContain("messages");
    }
  });

  // Page tops v6 (Josh, 9 Nov 2026: the mock-ups are the source of truth): Home's four chips.
  it("gives the coordinator Home's mock-up chips, in order", () => {
    expect(QUICK_BAR.coordinator.map((control) => control.label)).toEqual([
      "Ward updates",
      "Find a bed",
      "Call and contacts",
      "Handover",
    ]);
  });

  it("links only to pages the app has", () => {
    for (const controls of Object.values(QUICK_BAR)) {
      for (const control of controls) {
        if (control.kind !== "link") continue;
        expect(existsSync(join(process.cwd(), "src/app", control.href, "page.tsx")), control.href).toBe(true);
      }
    }
  });
});

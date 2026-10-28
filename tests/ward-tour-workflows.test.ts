import { describe, expect, it } from "vitest";

import { ROLE_SCREENS, screenForPath, WARD_ACCESS_ROLES } from "@/components/ward-management/ward-role-access";
import { tourSteps } from "@/components/ward-management/help/ward-tour-steps";

describe("optional tour workflows", () => {
  it("offers short daily-work and recovery topics for every desk on both devices", () => {
    for (const role of WARD_ACCESS_ROLES) {
      for (const device of ["desk", "phone"] as const) {
        for (const topic of ["workflows", "safe-use"] as const) {
          const steps = tourSteps(role, device, {}, topic);
          expect(steps[0]?.id, `${role} ${device} ${topic}`).toBe(
            topic === "workflows" ? "workflow-start" : "safe-start",
          );
          expect(steps.length).toBeLessThanOrEqual(9);
          expect(steps.at(-1)?.canDo).toBe(true);
          expect(new Set(steps.map((step) => step.id)).size).toBe(steps.length);
        }
      }
    }
  });

  it("only offers existing destinations granted to that role", () => {
    let links = 0;
    for (const role of WARD_ACCESS_ROLES) {
      for (const topic of ["workflows", "safe-use"] as const) {
        for (const step of tourSteps(role, "desk", {}, topic)) {
          if (!step.open) continue;
          const screen = screenForPath(step.open.href)?.screen;
          expect(screen, step.open.href).toBeDefined();
          expect(ROLE_SCREENS[role][screen!], `${role} ${step.open.href}`).toBeDefined();
          expect(step.open.href).not.toMatch(/\?|https?:|patient\//);
          links++;
        }
      }
    }
    expect(links).toBeGreaterThan(12);
  });

  it("explains synthetic data, uncertain saves, freshness and privacy without promising unavailable actions", () => {
    for (const role of WARD_ACCESS_ROLES) {
      const text = tourSteps(role, "desk", {}, "safe-use")
        .map((step) => step.body)
        .join(" ");
      expect(text).toMatch(/synthetic/i);
      expect(text).toMatch(/time|updat|fresh/i);
      expect(text).toMatch(/privacy|private|screen|sign out/i);
      expect(text).not.toMatch(/automatically.*(?:clinical|legal)|guaranteed|\bundefined\b|\bNaN\b/);
    }
    const shared = tourSteps("ed", "desk", {}, "safe-use").find((step) => step.id === "safe-saves");
    expect(shared?.body).toMatch(/not confirmed|unconfirmed/i);
    expect(shared?.body).toMatch(/do not reload/i);
    const executive = tourSteps("executive", "desk", {}, "safe-use")
      .map((step) => step.body)
      .join(" ");
    expect(executive).toMatch(/fewer than 5/i);
    expect(executive).toMatch(/not zero/);
    expect(executive).not.toMatch(/open.*patient record/i);
    const manager = tourSteps("bed_manager", "desk", {}, "workflows")
      .map((step) => step.body)
      .join(" ");
    expect(manager).toMatch(/confirm/i);
    expect(manager).toMatch(/read only/i);
    const admin = tourSteps("admin", "desk", {}, "workflows")
      .map((step) => step.body)
      .join(" ");
    expect(admin).toMatch(/does not grant|separate|restricted/i);
    expect(admin).toMatch(/end date/);
  });
});

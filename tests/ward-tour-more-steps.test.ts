import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { checklistsForDesk } from "@/components/ward-management/help/ward-help-checklists";
import {
  MAX_GO_FURTHER,
  MAX_TOUR_STEPS,
  TOUR_CHECKLISTS,
  fullTourSteps,
  goFurtherScreens,
  goFurtherSteps,
  moreTourSteps,
} from "@/components/ward-management/help/ward-tour-more-steps";
import { ROLE_SCREENS } from "@/components/ward-management/ward-role-access";
import {
  TOUR_ROLE_LABELS,
  tourMinutes,
  tourSteps,
  type TourDevice,
  type TourFacts,
  type TourRole,
} from "@/components/ward-management/help/ward-tour-steps";

/**
 * The opening tour's extra steps (Josh, 2 Nov 2026): a few more parts of each desk, joined into the
 * existing chapters before the last step, pointing only at controls the chrome still carries.
 */

const ROLES = Object.keys(TOUR_ROLE_LABELS) as TourRole[];
const DEVICES: readonly TourDevice[] = ["desk", "tablet", "phone"];
const CHAPTERS = ["Your desk", "Your daily work", "Finding your way", "What you can do"];
const FULL: TourFacts = {
  place: "Dabakarn at Royal Perth Hospital",
  placeName: "Dabakarn",
  readyBeds: 26,
  openMovements: 70,
  referralsWaiting: 7,
  waitingInEd: 62,
  ward: { beds: 20, occupied: 16, ready: 1, confirmedAt: "10:22" },
  ed: { waiting: 5, longest: "13h 24m", targetHours: 24 },
  activeJobs: 13,
};

function sourceText(dir: string): string {
  return readdirSync(dir)
    .map((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceText(path);
      // The tour and how-to files only name test ids; the screens must carry them.
      return /\.(tsx?|mts)$/.test(name) && !/ward-tour-(more-)?steps|ward-help-howto|ward-help-screen-tours/.test(path)
        ? readFileSync(path, "utf8")
        : "";
    })
    .join("\n");
}

describe("more tour steps", () => {
  it("adds a few steps per desk, keeps ids unique, chapters in order and what the desk can do last", () => {
    for (const role of ROLES) {
      for (const device of DEVICES) {
        const label = `${role} ${device}`;
        const added = moreTourSteps(role, device);
        expect(added.length, label).toBeGreaterThanOrEqual(2);
        expect(added.length, label).toBeLessThanOrEqual(device === "phone" ? 4 : 5);
        for (const step of added) expect(step.id, label).toMatch(/^more-/);

        const base = tourSteps(role, device, FULL);
        const steps = fullTourSteps(role, device, FULL);
        expect(steps.length, label).toBe(base.length + added.length);
        expect(steps.length, label).toBeLessThanOrEqual(MAX_TOUR_STEPS);
        expect(new Set(steps.map((step) => step.id)).size, label).toBe(steps.length);
        expect(steps[0]?.id, label).toBe("welcome");
        expect(steps.at(-1)?.canDo, label).toBe(true);
        expect(steps.filter((step) => step.canDo).length, label).toBe(1);
        const order = steps.map((step) => CHAPTERS.indexOf(step.chapter));
        expect(order, label).toEqual(order.toSorted((a, b) => a - b));
        // The home walk keeps its own order.
        const kept = steps.filter((step) => !step.id.startsWith("more-")).map((step) => step.id);
        expect(kept, label).toEqual(base.map((step) => step.id));
        // What Help holds follows Help's own step, where the tour has one.
        const help = steps.findIndex((step) => step.id === "help");
        if (help >= 0) expect(steps[help + 1]?.id, label).toBe("more-learn");
      }
    }
  });

  it("says in the welcome how long the longer tour takes", () => {
    for (const role of ROLES) {
      const steps = fullTourSteps(role, "desk", FULL);
      const welcome = steps[0]?.body ?? "";
      expect(welcome, role).toMatch(new RegExp(`This takes ${tourMinutes(steps.length, "desk")}\\.$`));
      expect(welcome.match(/This takes/g)?.length, role).toBe(1);
      const tablet = fullTourSteps(role, "tablet", FULL);
      expect(tablet[0]?.body, role).toMatch(new RegExp(`This takes ${tourMinutes(tablet.length, "tablet")}\\.$`));
      // The phone welcome has no length, as before.
      expect(fullTourSteps(role, "phone", FULL)[0]?.body, role).not.toMatch(/This takes/);
    }
  });

  it("never ranks, suggests or places for a person, and writes no gaps", () => {
    for (const role of ROLES) {
      for (const device of DEVICES) {
        for (const facts of [{}, FULL]) {
          for (const step of fullTourSteps(role, device, facts)) {
            const words = `${step.title} ${step.body} ${step.tryIt ?? ""}`;
            expect(words, `${role} ${device} ${step.id}`).not.toMatch(
              /best (match|ward)|recommended ward|risk score|auto(-| )?(place|release)/i,
            );
            expect(words, `${role} ${device} ${step.id}`).not.toMatch(/undefined|NaN|null|\s\.|\s,|\s{2}/);
          }
        }
      }
    }
  });

  it("points every new step at a test id the screens still carry", () => {
    const source = sourceText(join(process.cwd(), "src"));
    for (const role of ROLES) {
      for (const device of DEVICES) {
        for (const step of moreTourSteps(role, device)) {
          for (const [, value] of (step.target?.sel ?? "").matchAll(/\[data-testid\^?="([^"]+)"\]/g)) {
            expect(source.includes(`"${value}"`), `${role} ${device} ${step.id}: ${value}`).toBe(true);
          }
        }
      }
    }
  });

  it("offers practice only to desks with shift work, and names Help's own checklists", () => {
    for (const role of ROLES) {
      // Every desk has Getting started (5 Nov 2026); the shift lists stay with the desks that work shifts.
      expect(TOUR_CHECKLISTS[role], role).toEqual(checklistsForDesk(role).map((each) => each.title));
      expect(TOUR_CHECKLISTS[role][0], role).toBe("Getting started");
      for (const device of DEVICES) {
        const words = moreTourSteps(role, device)
          .map((step) => step.body)
          .join(" ");
        expect(words, `${role} ${device}`).toContain("Checklists has Getting started for your first week");
        if (role === "admin" || role === "executive") {
          expect(words, `${role} ${device}`).not.toMatch(/Practise|Start of shift|Handover/);
        }
        if (role === "officer" || role === "bed_manager") expect(words, `${role} ${device}`).not.toMatch(/Practise/);
      }
    }
  });
});

describe("the tablet's extra steps (5 Nov 2026)", () => {
  it("lights the bar's Menu, never the side menu the tablet folds away", () => {
    for (const role of ROLES) {
      for (const step of fullTourSteps(role, "tablet", FULL)) {
        expect(step.target?.sel ?? "", `${role} ${step.id}`).not.toMatch(/ward-rail|ward-my-wards-pin/);
      }
      expect(
        moreTourSteps(role, "tablet").map((step) => step.id),
        role,
      ).toEqual(moreTourSteps(role, "desk").map((step) => step.id));
    }
  });
});

describe("Go further (5 Nov 2026)", () => {
  it("offers up to eight optional steps per desk, in their own chapter, after the first-run tour", () => {
    for (const role of ROLES) {
      for (const device of DEVICES) {
        const label = `${role} ${device}`;
        const further = goFurtherSteps(role, device, FULL);
        expect(further.length, label).toBeGreaterThanOrEqual(2);
        expect(further.length, label).toBeLessThanOrEqual(MAX_GO_FURTHER);
        const first = fullTourSteps(role, device, FULL);
        expect(first.length, label).toBeLessThanOrEqual(MAX_TOUR_STEPS);
        const ids = [...first, ...further].map((step) => step.id);
        expect(new Set(ids).size, label).toBe(ids.length);
        for (const step of further) {
          expect(step.chapter, `${label} ${step.id}`).toBe("Go further");
          expect(step.id, `${label} ${step.id}`).toMatch(/^further-/);
          expect(step.canDo, `${label} ${step.id}`).toBeUndefined();
          const words = `${step.title} ${step.body} ${step.tryIt ?? ""}`;
          expect(words, `${label} ${step.id}`).not.toMatch(/undefined|NaN|null|\s\.|\s,|\s{2}/);
          expect(words, `${label} ${step.id}`).not.toMatch(
            /best (match|ward)|recommended ward|risk score|auto(-| )?(place|release)|due in/i,
          );
          const outsideQuotes = (step.target?.sel ?? "").replace(/"[^"]*"/g, "");
          expect(outsideQuotes, `${label} ${step.id}`).not.toMatch(/\.[A-Za-z_]/);
        }
      }
    }
  });

  it("only tours screens the desk's access table opens", () => {
    for (const role of ROLES) {
      for (const screen of goFurtherScreens(role)) {
        expect(ROLE_SCREENS[role][screen], `${role} ${screen}`).toBeDefined();
      }
    }
    const officer = goFurtherSteps("officer", "desk", FULL).map((step) => step.body);
    expect(officer.some((body) => /Movements|Legal forms|Waiting/.test(body))).toBe(false);
    const executive = goFurtherSteps("executive", "desk", FULL).map((step) => step.body);
    expect(executive.some((body) => /Handover|Waiting|Legal forms/.test(body))).toBe(false);
  });

  it("says where each screen is on each kind of screen, and lights it there", () => {
    const desk = goFurtherSteps("coordinator", "desk", FULL);
    expect(desk.find((step) => step.id === "further-movements")?.target?.sel).toBe(
      '[data-testid="ward-rail-role-menu"] a[href$="/movements"]',
    );
    expect(desk.find((step) => step.id === "further-discharges")?.body).toContain("Discharges, under More,");
    for (const step of goFurtherSteps("coordinator", "tablet", FULL)) {
      expect(step.target?.sel, step.id).toBe('[data-testid="ward-bar-phone-menu"]');
    }
    const phone = goFurtherSteps("ward", "phone", FULL);
    expect(phone.find((step) => step.id === "further-referrals")?.body).toContain("in the tab bar");
  });

  it("points every Go further step at a test id the screens still carry", () => {
    const source = sourceText(join(process.cwd(), "src"));
    for (const role of ROLES) {
      for (const device of DEVICES) {
        for (const step of goFurtherSteps(role, device, FULL)) {
          for (const [, value] of (step.target?.sel ?? "").matchAll(/\[data-testid\^?="([^"]+)"\]/g)) {
            expect(source.includes(`"${value}"`), `${role} ${device} ${step.id}: ${value}`).toBe(true);
          }
        }
      }
    }
  });
});

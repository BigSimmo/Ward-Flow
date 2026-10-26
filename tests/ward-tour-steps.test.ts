import { describe, expect, it } from "vitest";

import {
  TOUR_ROLE_LABELS,
  tourCanDo,
  tourMinutes,
  tourSteps,
  type TourDevice,
  type TourFacts,
  type TourRole,
} from "@/components/ward-management/help/ward-tour-steps";
import { deskActions } from "@/components/ward-management/settings/workstation-desks";

/**
 * The role-tailored tour (Josh approved the mock-up on 22 Oct 2026): each desk's steps on desktop
 * and phone, the words built from the desk's own figures, and the last step's can-do list.
 */

const ROLES = Object.keys(TOUR_ROLE_LABELS) as TourRole[];
const DEVICES: readonly TourDevice[] = ["desk", "phone"];
const CHAPTERS = ["Your desk", "Your daily work", "Finding your way", "What you can do"];

const FULL: TourFacts = {
  place: "Dabakarn at Royal Perth Hospital",
  placeName: "Dabakarn",
  readyBeds: 26,
  openMovements: 70,
  referralsWaiting: 7,
  waitingInEd: 62,
  topEd: { name: "Armadale ED", waiting: 22, longest: "7d 1h" },
  ward: { beds: 20, occupied: 16, ready: 1, confirmedAt: "10:22" },
  ed: { waiting: 5, longest: "13h 24m", targetHours: 24 },
  activeJobs: 13,
};

describe("tour steps", () => {
  it("opens with a welcome, keeps the chapters in order and ends with what the desk can do", () => {
    for (const role of ROLES) {
      for (const device of DEVICES) {
        const steps = tourSteps(role, device, FULL);
        expect(steps[0]?.id, `${role} ${device}`).toBe("welcome");
        expect(steps.at(-1)?.canDo, `${role} ${device}`).toBe(true);
        const order = steps.map((step) => CHAPTERS.indexOf(step.chapter));
        expect(order, `${role} ${device}`).toEqual(order.toSorted((a, b) => a - b));
        expect(new Set(steps.map((step) => step.id)).size, `${role} ${device}`).toBe(steps.length);
      }
    }
  });

  it("writes a sentence without its figure when the figure is missing, never a gap or a guess", () => {
    for (const role of ROLES) {
      for (const device of DEVICES) {
        for (const facts of [{}, FULL]) {
          for (const step of tourSteps(role, device, facts)) {
            const words = `${step.title} ${step.body} ${step.tryIt ?? ""}`;
            expect(words, `${role} ${device} ${step.id}`).not.toMatch(/undefined|NaN|null|\s\.|\s,|\s{2}/);
          }
        }
      }
    }
  });

  it("points only at attributes the production build keeps, never at a class name", () => {
    for (const role of ROLES) {
      for (const device of DEVICES) {
        for (const step of tourSteps(role, device, FULL)) {
          if (!step.target) continue;
          const outsideQuotes = step.target.sel.replace(/"[^"]*"/g, "");
          expect(outsideQuotes, `${role} ${device} ${step.id}`).not.toMatch(/\.[A-Za-z_]/);
        }
      }
    }
  });

  it("uses the person, the place and the screen's own figures", () => {
    const ward = tourSteps("ward", "desk", FULL);
    expect(ward[0]?.title).toBe("Welcome, K. Vance");
    expect(ward[0]?.body).toContain("Nurse in charge of Dabakarn at Royal Perth Hospital.");
    expect(ward.find((step) => step.id === "hero")?.body).toContain("1 bed ready now and 16 of 20 occupied.");
    expect(ward.find((step) => step.id === "confirm")?.body).toContain("last confirmed at 10:22");
    const coordinator = tourSteps("coordinator", "desk", FULL);
    expect(coordinator.find((step) => step.id === "menu")?.body).toContain(
      "Capacity has 26 beds ready now, Movements has 70 still open and 7 referrals are waiting for a decision.",
    );
    expect(coordinator.find((step) => step.id === "eds")?.body).toContain("Armadale ED has 22 waiting");
    expect(tourSteps("ed", "phone", FULL).find((step) => step.id === "card")?.body).toContain(
      "The longest wait is 13h 24m against a 24h target.",
    );
  });

  it("says how long the desktop tour takes from its number of steps", () => {
    const steps = tourSteps("coordinator", "desk", FULL);
    expect(steps[0]?.body).toContain(`This takes ${tourMinutes(steps.length, "desk")}.`);
    expect(tourMinutes(4, "desk")).toBe("about a minute");
    expect(tourMinutes(12, "desk")).toBe("about 3 minutes");
  });
});

describe("what the desk can do", () => {
  it("reads the same action table the app enforces for a desk that acts", () => {
    for (const role of ["coordinator", "ward", "ed", "community", "officer"] as const) {
      const actions = deskActions(role);
      expect(tourCanDo(role)).toEqual({ canTitle: "You can", can: actions.can, ask: actions.cannot });
    }
    expect(tourCanDo("coordinator").ask).toEqual([]);
  });

  it("lists only the screens the access table opens for the other desks", () => {
    expect(tourCanDo("executive").can).toEqual([
      "Statistics, as counts with no patient names",
      "Settings for your own account",
    ]);
    expect(tourCanDo("admin").can).toEqual([
      "Governance: overrides, refused actions and record access",
      "Settings for your own account",
    ]);
    const bedManager = tourCanDo("bed_manager").can;
    expect(bedManager).toContain("Capacity, Wards and ward boards, your site");
    expect(bedManager).toContain("Seclusion and restraint, your site");
    expect(bedManager).toContain("On-call, all services");
    expect(bedManager.some((line) => line.startsWith("Governance"))).toBe(false);
  });
});

// Help and tour audit, 26 Oct 2026 (stream D).
describe("help and tour audit fixes", () => {
  it("lights the coordinator's Home by test ids, so a label change cannot lose the spotlight (HF-03)", () => {
    const target = (device: TourDevice, id: string) =>
      tourSteps("coordinator", device, FULL).find((step) => step.id === id)?.target?.sel ?? "";
    for (const [device, id] of [
      ["desk", "eds"],
      ["desk", "shortlist"],
      ["phone", "eds"],
      ["phone", "queue"],
    ] as const) {
      expect(target(device, id), `${device} ${id}`).toMatch(/^\[data-testid=/);
      expect(target(device, id), `${device} ${id}`).not.toContain("aria-label");
    }
  });

  it("never describes the queue or Find a bed as a ranking or a suggestion (HF-15, HF-16)", () => {
    for (const role of ROLES) {
      for (const device of DEVICES) {
        const words = tourSteps(role, device, FULL)
          .map((step) => `${step.title} ${step.body}`)
          .join(" ");
        expect(words, `${role} ${device}`).not.toMatch(/top of the priority queue|could go|best match/i);
      }
    }
  });

  it("shows the access admin how to give and remove roles (HF-05)", () => {
    for (const device of DEVICES) {
      const ids = tourSteps("admin", device, FULL).map((step) => step.id);
      expect(ids, device).toEqual(expect.arrayContaining(["give-role", "requests"]));
    }
  });
});

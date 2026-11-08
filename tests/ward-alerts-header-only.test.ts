import { describe, expect, it } from "vitest";

import { TOUR_ROLE_LABELS, tourSteps, type TourRole } from "@/components/ward-management/help/ward-tour-steps";
import { railEntries, roleMenu } from "@/components/ward-management/shell/ward-rail-entries";

const moreIds = (role: Parameters<typeof roleMenu>[1]) =>
  roleMenu(railEntries(), role).more.flatMap((group) => group.entries.map((entry) => entry.id));

/**
 * P115 and P116 (Josh, 27 Oct 2026, "yes to both"). P115: the tour no longer says the header chips
 * count open alerts; there is no alerts chip. P116: on the desk whose header button is the Alerts
 * bell (the bed coordinator), Alerts lives in the header only and is no longer repeated under More.
 * Other desks have no Alerts bell, so they keep Alerts under More.
 */
describe("P115: tour copy does not mention an alerts chip", () => {
  it("no tour step says the chips count open alerts", () => {
    const facts = { readyBeds: 26, openMovements: 70, referralsWaiting: 7 };
    for (const role of Object.keys(TOUR_ROLE_LABELS) as TourRole[]) {
      for (const device of ["desk", "phone"] as const) {
        for (const step of tourSteps(role, device, facts)) {
          expect(step.body, `${role} ${device} ${step.id}`).not.toMatch(/open alerts/u);
        }
      }
    }
  });
});

describe("P115 tour wording, updated to the redesigned Home (Josh, 8 Nov 2026)", () => {
  // Josh's 28 Oct wording named four chips beside the title. The redesigned Home replaced them
  // with a next-step line and its button, and Josh asked for the tour to follow (8 Nov 2026).
  const facts = { readyBeds: 26, openMovements: 70, referralsWaiting: 7 };

  it("the desktop hero step names the next step and what the chips count", () => {
    const step = tourSteps("coordinator", "desk", facts).find((s) => s.id === "pressure");
    expect(step?.body).toContain("The line under it says what needs you first, and its button shows just those.");
    expect(step?.body).toContain("referrals to decide, waits past target, Tier 1 patients");
  });

  it("the phone step names the next-step line, not chips the phone no longer shows", () => {
    const step = tourSteps("coordinator", "phone", facts).find((s) => s.id === "chips");
    expect(step?.body).toContain("This line says what needs you first");
    expect(step?.body).not.toContain("The chips beside it");
  });
});

describe("P116: Alerts lives in the header bell, not under More", () => {
  it("the coordinator's More has no Alerts entry", () => {
    expect(moreIds("coordinator")).not.toContain("alerts");
  });

  it("a desk without the Alerts bell still reaches Alerts under More", () => {
    expect(moreIds("ward")).toContain("alerts");
  });
});

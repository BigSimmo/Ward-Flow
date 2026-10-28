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

describe("P115 tour wording (Josh, 28 Oct 2026, 12:23 AM AWST)", () => {
  const facts = { readyBeds: 26, openMovements: 70, referralsWaiting: 7 };
  const chips = "The chips beside it count Act now, Referrals to decide, Overdue waits and Tier 1 patients.";

  it("the desktop ring step names the four Home chips", () => {
    const step = tourSteps("coordinator", "desk", facts).find((s) => s.id === "pressure");
    expect(step?.body).toContain(chips);
  });

  it("the phone chips step names the four Home chips", () => {
    const step = tourSteps("coordinator", "phone", facts).find((s) => s.id === "chips");
    // On the phone the second Home chip is labelled "To decide", so the tour says that.
    expect(step?.body).toContain(
      "The chips beside it count Act now, To decide, Overdue waits and Tier 1 patients. The figures update as the network changes.",
    );
    expect(step?.body).not.toContain("Referrals to decide");
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

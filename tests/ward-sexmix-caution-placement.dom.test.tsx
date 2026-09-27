import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The mid-update caution's PLACEMENT and SCOPE, moved here on 25 September 2026 from
 * `ward-capacity-sexmix-release.dom.test.tsx`, which used to reach this state by pressing
 * `RELEASE_BED`. Owner ruling 2026-09-25: a bed release names the patient, and the count moves when
 * that person leaves (`departAdmission` moves `sexMix` and occupancy in the same write), so no
 * ordinary action now leaves the sex register and occupancy disagreeing. The caution is still on the
 * screen for data that disagrees, so its placement assertions are kept, word for word in intent,
 * against a seed where one ward's recorded sex mix is one lower than its occupancy (lower, because
 * `unitCapacity` takes the larger of the two as occupied, so a higher census would simply count).
 */
const SUBJECT = "rph-adult-secure";

// The state's units come from `scenarioUnits`; the admissions seed reads `ward-sites` directly and
// is left alone, so only the ward's recorded sex mix is off by one, which is the disagreement.
vi.mock("@/components/ward-management/ward-scenarios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-scenarios")>();
  return {
    ...actual,
    scenarioUnits: (...args: Parameters<typeof actual.scenarioUnits>) =>
      actual
        .scenarioUnits(...args)
        .map((unit) =>
          unit.id === "rph-adult-secure"
            ? { ...unit, sexMix: { ...unit.sexMix, Female: Math.max(0, (unit.sexMix.Female ?? 0) - 1) } }
            : unit,
        ),
  };
});

describe("the mid-update caution sits in the sex-mix cell of the ward whose records disagree", () => {
  it("shows on that ward, inside its sex-mix cell and not under Ready, and on no other ward", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
      </WardFlowProvider>,
    );

    const caution = screen.getByTestId(`ward-capacity-mid-update-${SUBJECT}`);
    expect(caution, "the ward's figures disagree and nothing says they may not have settled").toHaveTextContent(
      /may not be settled/iu,
    );

    const sexCell = screen.getByTestId(`ward-capacity-sexmix-${SUBJECT}`);
    expect(
      sexCell.contains(caution),
      "the mid-update caution is not in the sex-mix cell. It qualifies the sex register - putting it " +
        "anywhere else tells a reader to distrust a number the predicate does not even read",
    ).toBe(true);

    const readyCell = within(screen.getByTestId(`ward-capacity-network-row-${SUBJECT}`)).getByTestId(
      "ward-capacity-network-ready",
    );
    expect(
      readyCell.contains(caution),
      "the caution is back under Ready. Ready is `allocatable`, and this predicate never reads it",
    ).toBe(false);

    // The direction check: a screen warning on every row would pass the assertions above while
    // telling a coordinator that no figure anywhere can be trusted.
    const others = allUnits().filter((unit) => unit.id !== SUBJECT);
    expect(others.length).toBeGreaterThan(0);
    for (const unit of others) {
      expect(
        screen.queryByTestId(`ward-capacity-mid-update-${unit.id}`),
        `${unit.id}'s records agree and it must not claim to be mid-update`,
      ).not.toBeInTheDocument();
    }
  });
});

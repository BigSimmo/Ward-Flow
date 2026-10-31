import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
 *
 * Capacity redesign (Josh, 31 Oct 2026): the network table and its sex-mix cell are gone. A ward's
 * gender mix and the caution now live in its ward drawer, opened from the ward's bed map card. The
 * caution sits in the drawer's notices and names the gender mix in its own words; it is still never
 * inside the "Beds now" section that carries the Ready figure, and still on no other ward.
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

/** A ward card's visible name: its text without the spelled-out code a screen reader hears. */
function visibleName(element: Element | null): string {
  if (!element) return "";
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll("abbr + span").forEach((node) => node.remove());
  return (clone.textContent ?? "").trim();
}

/** Opens a ward's drawer from its bed map card, as a coordinator would. */
function openWardDrawer(unit: { id: string; name: string }): HTMLElement {
  const map = document.getElementById("capacity-bed-map");
  if (!map) throw new Error("no bed map on the Capacity screen");
  const card = Array.from(map.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]')).find(
    (button) => visibleName(button.firstElementChild) === unit.name,
  );
  if (!card) throw new Error(`no bed map card for ${unit.id}`);
  fireEvent.click(card);
  const drawer = screen.getByTestId("ward-capacity-ward-drawer");
  expect(drawer).toHaveAccessibleName(unit.name);
  return drawer;
}

const CAUTION = /may not be settled/iu;

describe("the mid-update caution sits with the gender mix of the ward whose records disagree", () => {
  it("shows in that ward's drawer, naming the gender mix and not under Ready, and on no other ward", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
      </WardFlowProvider>,
    );

    const subject = allUnits().find((unit) => unit.id === SUBJECT)!;
    const drawer = openWardDrawer(subject);
    const caution = within(drawer).getByText(CAUTION);
    expect(caution, "the ward's figures disagree and nothing says they may not have settled").toBeInTheDocument();
    expect(
      caution,
      "the mid-update caution no longer names the gender mix. It qualifies the sex register - a " +
        "caution that does not say so tells a reader to distrust a number the predicate does not even read",
    ).toHaveTextContent(/gender mix/iu);

    const beds = within(drawer).getByRole("region", { name: "Beds now" });
    expect(
      beds.contains(caution),
      "the caution is back under Ready. Ready is `allocatable`, and this predicate never reads it",
    ).toBe(false);

    // The direction check: a screen warning on every ward would pass the assertions above while
    // telling a coordinator that no figure anywhere can be trusted.
    const others = allUnits().filter((unit) => unit.id !== SUBJECT);
    expect(others.length).toBeGreaterThan(0);
    for (const unit of others) {
      const other = openWardDrawer(unit);
      expect(
        within(other).queryByText(CAUTION),
        `${unit.id}'s records agree and it must not claim to be mid-update`,
      ).not.toBeInTheDocument();
    }
  });
});

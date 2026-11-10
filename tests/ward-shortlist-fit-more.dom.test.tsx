import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * D-71 guard for item 26 (More fit details). Opening "More" on a ward card explains the gates
 * already checked; it must not reorder the wards, tint them or add ranking words. Synthetic
 * fixture movement only.
 */
const MOVEMENT_ID = "WF-308";

function Harness() {
  const { movements, units, bedReleases, leaveBeds, referrals, now, dispatch, configuration } = useWardFlow();
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined);
  return (
    <ShortlistPanel
      movement={movements.find((candidate) => candidate.id === MOVEMENT_ID)}
      now={now}
      units={units}
      bedReleases={bedReleases}
      leaveBeds={leaveBeds}
      admissions={wardAdmissions}
      referrals={referrals}
      selectedUnitId={selectedUnitId}
      onSelectUnit={setSelectedUnitId}
      dispatch={dispatch}
      parallelReferralCap={configuration.parallelReferralCap}
    />
  );
}

const RANKING_WORDS =
  /\b(best|top|ranked|ranking|rank|score|scored|recommended|recommend|suggested|suggest|closest match|ideal)\b/iu;

/** The ward card order, read from both the selectable and the unavailable cards. */
function wardOrder(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-testid^="ward-shortlist-candidate-"], [data-testid^="ward-shortlist-unavailable-"]',
    ),
  )
    .map((card) => card.dataset.testid ?? "")
    .filter((id) => !id.startsWith("ward-shortlist-unavailable-why-"));
}

function openReviewWards() {
  const toggle = screen.queryByTestId("ward-shortlist-review-toggle");
  if (toggle && toggle.getAttribute("aria-expanded") !== "true") fireEvent.click(toggle);
}

describe("More fit details keeps the neutral ward order (D-71)", () => {
  it("opening every More toggle leaves the ward order unchanged", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Harness />
      </WardFlowProvider>,
    );
    openReviewWards();
    const before = wardOrder();
    const toggles = screen.queryAllByTestId(/^ward-shortlist-fit-more-/u);
    expect(before.length).toBeGreaterThan(1);
    expect(toggles.length).toBeGreaterThan(0);
    for (const toggle of toggles) {
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      const list = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
      expect(list).not.toBeNull();
      expect(list).toBeVisible();
      for (const row of Array.from(list!.querySelectorAll("li"))) {
        expect(row.textContent).toMatch(/: (Met|Not met|To check)$/u);
      }
    }
    expect(wardOrder()).toEqual(before);
  });

  it("the opened details carry no ranking or suggestion words", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Harness />
      </WardFlowProvider>,
    );
    openReviewWards();
    for (const toggle of screen.queryAllByTestId(/^ward-shortlist-fit-more-/u)) fireEvent.click(toggle);
    const lists = Array.from(document.querySelectorAll<HTMLElement>("[data-gate]")).map((row) => row.textContent);
    expect(lists.length).toBeGreaterThan(0);
    for (const text of lists) expect(text).not.toMatch(RANKING_WORDS);
  });
});

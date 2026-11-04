import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GovernanceRestrictiveRegister } from "@/components/ward-management/governance-restrictive-register";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Gap list item 9 (Josh, 4 Nov 2026): a finished seclusion in the Governance register carries Done
 * or Not yet follow-up marks a person sets. Synthetic seed only.
 */
function Harness() {
  const { units, admissions, now, dispatch, rejections } = useWardFlow();
  const stay = admissions.find((admission) => admission.state === "occupied")!;
  const finish = () => {
    dispatch({
      type: "RECORD_RESTRICTIVE_PRACTICE_START",
      role: "coordinator",
      now,
      unitId: stay.unitId,
      admissionId: stay.id,
      practice: "seclusion",
      startedAt: now - 60,
    });
  };
  const end = () => {
    const episode = units.find((unit) => unit.id === stay.unitId)!.restrictivePractice!.episodes.at(-1)!;
    dispatch({
      type: "RECORD_RESTRICTIVE_PRACTICE_END",
      role: "coordinator",
      now,
      unitId: stay.unitId,
      episodeId: episode.id,
      endedAt: now - 10,
    });
  };
  return (
    <>
      <button type="button" onClick={finish}>
        start
      </button>
      <button type="button" onClick={end}>
        end
      </button>
      <span data-testid="rejection-count">{rejections.length}</span>
      <GovernanceRestrictiveRegister units={units} now={now} />
    </>
  );
}

describe("Governance follow-up marks (gap list item 9)", () => {
  it("marks a follow-up task Done on a finished seclusion, and counts it", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Harness />
      </WardFlowProvider>,
    );
    const before = Number(screen.getByTestId("rejection-count").textContent);
    fireEvent.click(screen.getByRole("button", { name: "start" }));
    fireEvent.click(screen.getByRole("button", { name: "end" }));
    expect(Number(screen.getByTestId("rejection-count").textContent)).toBe(before);

    const open = screen.getByRole("button", { name: "Mark follow-up" });
    const followUp = open.closest("[data-testid^='governance-follow-up-']:not(button)") as HTMLElement;
    expect(within(followUp).getByText("Follow-up 0 of 4 marked done")).toBeInTheDocument();
    fireEvent.click(open);
    const debrief = within(followUp).getByRole("radiogroup", { name: "Debrief offered to the person" });
    fireEvent.click(within(debrief).getByRole("radio", { name: "Done" }));
    expect(Number(screen.getByTestId("rejection-count").textContent)).toBe(before);
    expect(within(followUp).getByText("Follow-up 1 of 4 marked done")).toBeInTheDocument();
  });
});

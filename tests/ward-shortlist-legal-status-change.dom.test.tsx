import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";

/** Owner rule (19 Oct 2026): legal status is never prefilled, so the coordinator's change starts blank. */
const MOVEMENT = seedWardFlowState().movements.find((movement) => isOpen(movement))!;

function Harness() {
  const { movements, units, bedReleases, leaveBeds, referrals, now, dispatch, configuration } = useWardFlow();
  const movement = movements.find((candidate) => candidate.id === MOVEMENT.id);
  return (
    <>
      <p data-testid="recorded-legal-status">{movement?.legalStatus}</p>
      <ShortlistPanel
        movement={movement}
        now={now}
        units={units}
        bedReleases={bedReleases}
        leaveBeds={leaveBeds}
        admissions={wardAdmissions}
        referrals={referrals}
        selectedUnitId={undefined}
        onSelectUnit={() => {}}
        dispatch={dispatch}
        parallelReferralCap={configuration.parallelReferralCap}
      />
    </>
  );
}

describe("the coordinator's legal status change", () => {
  it("starts with no status chosen and records only once a status and a reason are chosen", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Harness />
      </WardFlowProvider>,
    );
    const toggle = screen.getByTestId("ward-change-legal-status-toggle");
    fireEvent.click(toggle);
    const status = screen.getByLabelText(/^Legal status for/u) as HTMLSelectElement;
    const reason = document.querySelector("#ward-change-legal-status-reason") as HTMLSelectElement;
    const submit = screen.getByRole("button", { name: "Record legal status change" });
    expect(status.value, "the new legal status arrives pre-selected").toBe("");
    expect(submit).toHaveAttribute("aria-disabled", "true");
    expect(submit.getAttribute("title") ?? "").toContain("Choose the new legal status");

    const reasonValue = [...reason.options].map((option) => option.value).find((value) => value !== "")!;
    fireEvent.change(reason, { target: { value: reasonValue } });
    expect(submit, "a reason alone records a status nobody chose").toHaveAttribute("aria-disabled", "true");

    const next = [...status.options]
      .map((option) => option.value)
      .find((value) => value !== "" && value !== MOVEMENT.legalStatus)!;
    fireEvent.change(status, { target: { value: next } });
    expect(submit).not.toHaveAttribute("aria-disabled");
    fireEvent.click(submit);
    expect(screen.getByTestId("recorded-legal-status")).toHaveTextContent(next);

    // Opened again, it starts blank rather than at the last choice.
    fireEvent.click(toggle);
    expect((screen.getByLabelText(/^Legal status for/u) as HTMLSelectElement).value).toBe("");
    expect(within(document.body).getByRole("button", { name: "Record legal status change" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

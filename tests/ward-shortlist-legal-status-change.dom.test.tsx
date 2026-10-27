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
      <p data-testid="recorded-legal-form">{movement?.legalForm?.code}</p>
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
    // The reason shows as visible text tied to the button, never a hover-only title.
    expect(submit).toHaveAttribute("aria-describedby", "ward-change-legal-status-reason-blocked");
    expect(document.getElementById("ward-change-legal-status-reason-blocked")?.textContent ?? "").toContain(
      "Choose the new legal status",
    );

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

  // Finding 120 (27 Oct 2026): the form and the time it was made are asked in the same step.
  it("records the legal form and the time it was made with the status change", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Harness />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-change-legal-status-toggle"));
    const status = screen.getByLabelText(/^Legal status for/u) as HTMLSelectElement;
    const next = [...status.options]
      .map((option) => option.value)
      .find((value) => value !== "" && value !== "Voluntary" && value !== MOVEMENT.legalStatus)!;
    fireEvent.change(status, { target: { value: next } });
    const reason = document.querySelector("#ward-change-legal-status-reason") as HTMLSelectElement;
    fireEvent.change(reason, { target: { value: [...reason.options].find((option) => option.value !== "")!.value } });

    // No form chosen yet: a warning, never a block.
    expect(screen.getByTestId("ward-change-legal-status-form-warning")).toHaveTextContent("No form chosen");
    const submit = screen.getByRole("button", { name: "Record legal status change" });
    expect(submit).not.toHaveAttribute("aria-disabled");

    const form = screen.getByTestId("ward-change-legal-status-form") as HTMLSelectElement;
    const code = [...form.options].find((option) => option.value !== "")!.value;
    fireEvent.change(form, { target: { value: code } });
    fireEvent.change(document.querySelector("#ward-change-legal-status-form-day")!, { target: { value: "-1" } });
    fireEvent.change(screen.getByTestId("ward-change-legal-status-form-time"), { target: { value: "10:00" } });
    expect(screen.queryByTestId("ward-change-legal-status-form-warning")).not.toBeInTheDocument();

    fireEvent.click(submit);
    expect(screen.getByTestId("recorded-legal-status")).toHaveTextContent(next);
    expect(screen.getByTestId("recorded-legal-form")).toHaveTextContent(code);
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";

/**
 * Clinical-safety audit (1 Nov 2026): Home's legal status and urgency changes closed whatever the
 * answer, and the legal form was recorded even when the status change was refused. Each now waits
 * for its answer: a refusal or an unconfirmed save keeps the form open with the reason inside it
 * until the form is closed (CT-09), and the form is recorded only after the status is.
 */
const MOVEMENT = seedWardFlowState().movements.find((movement) => isOpen(movement))!;

type Answer = (event: WardFlowEvent) => WardCommandOutcome | Promise<WardCommandOutcome> | undefined;

function Harness({ answer, sent }: { answer: Answer; sent: string[] }) {
  const { movements, units, bedReleases, leaveBeds, referrals, now, dispatch, configuration } = useWardFlow();
  const movement = movements.find((candidate) => candidate.id === MOVEMENT.id);
  return (
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
      dispatch={(event) => {
        sent.push(event.type);
        return answer(event) ?? dispatch(event);
      }}
      parallelReferralCap={configuration.parallelReferralCap}
    />
  );
}

function renderPanel(answer: Answer) {
  const sent: string[] = [];
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Harness answer={answer} sent={sent} />
    </WardFlowProvider>,
  );
  return sent;
}

const REFUSED: WardCommandOutcome = { commandId: "synthetic", status: "refused", message: "Synthetic refusal." };

/** Opens the legal status change and fills a non-voluntary status, a reason, a form and its time. */
function fillLegalStatusWithForm() {
  fireEvent.click(screen.getByTestId("ward-change-legal-status-toggle"));
  const status = screen.getByLabelText(/^Legal status for/u) as HTMLSelectElement;
  const next = [...status.options]
    .map((option) => option.value)
    .find((value) => value !== "" && value !== "Voluntary" && value !== MOVEMENT.legalStatus)!;
  fireEvent.change(status, { target: { value: next } });
  const reason = document.querySelector("#ward-change-legal-status-reason") as HTMLSelectElement;
  fireEvent.change(reason, { target: { value: [...reason.options].find((option) => option.value !== "")!.value } });
  const form = screen.getByTestId("ward-change-legal-status-form") as HTMLSelectElement;
  fireEvent.change(form, { target: { value: [...form.options].find((option) => option.value !== "")!.value } });
  fireEvent.change(document.querySelector("#ward-change-legal-status-form-day")!, { target: { value: "-1" } });
  fireEvent.change(screen.getByTestId("ward-change-legal-status-form-time"), { target: { value: "10:00" } });
}

describe("Home's legal status change waits for its answer", () => {
  it("keeps the form open with the refusal and never records the legal form", () => {
    const sent = renderPanel((event) => (event.type === "CHANGE_LEGAL_STATUS" ? REFUSED : undefined));
    fillLegalStatusWithForm();
    fireEvent.click(screen.getByRole("button", { name: "Record legal status change" }));

    expect(sent).toEqual(["CHANGE_LEGAL_STATUS"]);
    expect(screen.getByTestId("ward-change-legal-status")).toBeInTheDocument();
    expect(screen.getByTestId("ward-change-legal-status-failure")).toHaveTextContent(
      "Not recorded: Synthetic refusal.",
    );
    expect(screen.getByTestId("ward-change-legal-status-failure")).toHaveAttribute("role", "alert");

    // The warning stays until the form is closed.
    fireEvent.change(screen.getByTestId("ward-change-legal-status-form-time"), { target: { value: "09:00" } });
    expect(screen.getByTestId("ward-change-legal-status-failure")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ward-change-legal-status-toggle"));
    expect(screen.queryByTestId("ward-change-legal-status-failure")).not.toBeInTheDocument();
  });

  it("records the form only after a shared save confirms the status, then closes", async () => {
    let confirm: (outcome: WardCommandOutcome) => void = () => {};
    const sent = renderPanel((event) =>
      event.type === "CHANGE_LEGAL_STATUS"
        ? new Promise<WardCommandOutcome>((resolve) => {
            confirm = resolve;
          })
        : undefined,
    );
    fillLegalStatusWithForm();
    fireEvent.click(screen.getByRole("button", { name: "Record legal status change" }));
    expect(sent).toEqual(["CHANGE_LEGAL_STATUS"]);
    expect(screen.getByTestId("ward-change-legal-status")).toBeInTheDocument();

    await act(async () => confirm({ commandId: "synthetic", status: "accepted" }));
    expect(sent).toEqual(["CHANGE_LEGAL_STATUS", "RECORD_LEGAL_FORM_WRITTEN"]);
    expect(screen.queryByTestId("ward-change-legal-status")).not.toBeInTheDocument();
  });

  it("says when the status was recorded but the form was not", () => {
    renderPanel((event) => (event.type === "RECORD_LEGAL_FORM_WRITTEN" ? REFUSED : undefined));
    fillLegalStatusWithForm();
    fireEvent.click(screen.getByRole("button", { name: "Record legal status change" }));
    expect(screen.getByTestId("ward-change-legal-status-failure")).toHaveTextContent(
      "Legal status recorded, but not the form. Not recorded: Synthetic refusal.",
    );
  });
});

describe("Home's urgency change waits for its answer", () => {
  it("keeps the form open with an unconfirmed save until it is closed", () => {
    renderPanel((event) =>
      event.type === "CHANGE_URGENCY" || event.type === "CLEAR_MOVEMENT_URGENT_FLAG"
        ? { commandId: "synthetic", status: "failed", message: "Synthetic save not confirmed." }
        : undefined,
    );
    fireEvent.click(screen.getByTestId("ward-change-urgency-toggle"));
    const tier = document.querySelector("#ward-change-urgency-tier") as HTMLSelectElement;
    fireEvent.change(tier, { target: { value: MOVEMENT.urgency === 3 ? "2" : "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Record urgency change" }));

    expect(screen.getByTestId("ward-change-urgency")).toBeInTheDocument();
    expect(screen.getByTestId("ward-change-urgency-failure")).toHaveTextContent("Synthetic save not confirmed.");
    fireEvent.click(screen.getByTestId("ward-change-urgency-toggle"));
    expect(screen.queryByTestId("ward-change-urgency-failure")).not.toBeInTheDocument();
  });

  it("closes once the change is recorded", () => {
    renderPanel(() => undefined);
    fireEvent.click(screen.getByTestId("ward-change-urgency-toggle"));
    const tier = document.querySelector("#ward-change-urgency-tier") as HTMLSelectElement;
    fireEvent.change(tier, { target: { value: MOVEMENT.urgency === 3 ? "2" : "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Record urgency change" }));
    expect(screen.queryByTestId("ward-change-urgency")).not.toBeInTheDocument();
  });
});

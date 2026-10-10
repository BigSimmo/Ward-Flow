import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function renderMovements() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MovementsScreen />
    </WardFlowProvider>,
  );
}

function DomainStateProbe() {
  const { movements, referrals } = useWardFlow();
  return <output data-testid="ward-refinement-domain-state">{JSON.stringify({ movements, referrals })}</output>;
}

function renderCoordinator() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CoordinatorScreen />
      <DomainStateProbe />
    </WardFlowProvider>,
  );
}

function firstAttentionTarget(): { button: HTMLElement; movementId: string } {
  // Owner, 26 Sept 2026: the pill names the patient; its movement is read from the hidden key.
  const button = screen.getAllByRole("button", { name: /^Find .+ in worklist:/u })[0];
  expect(button, "the real fixture must expose at least one attention journey").toBeDefined();
  const movementId = button!.getAttribute("data-record-key");
  expect(movementId, "the attention action must carry the movement it reveals").not.toBeNull();
  return { button: button!, movementId: movementId! };
}

/** The worklist record for a movement, found by its hidden key (rows show the patient's name). */
function recordFor(movementId: string): HTMLElement {
  const row = document.querySelector<HTMLElement>(`li[data-record-key='${movementId}']`);
  expect(row, `no worklist record for ${movementId}`).not.toBeNull();
  return row!;
}

describe("Q004 refinement interaction regressions", () => {
  it("consumes an attention reveal once, preserves grouping-control focus, and permits a fresh repeated reveal", () => {
    renderMovements();
    const { button, movementId } = firstAttentionTarget();

    fireEvent.click(button);
    expect(recordFor(movementId)).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();

    const transportOrder = screen.getByRole("radio", { name: "By transport leg, and what has none" });
    transportOrder.focus();
    fireEvent.click(transportOrder);
    expect(transportOrder).toHaveAttribute("aria-checked", "true");
    expect(transportOrder).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(button);
    expect(recordFor(movementId)).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("returns from Resolved today to Every movement and focuses the requested attention record", () => {
    renderMovements();
    const { button, movementId } = firstAttentionTarget();
    const resolvedTab = screen.getByRole("tab", { name: /Resolved today/u });

    fireEvent.click(resolvedTab);
    expect(resolvedTab).toHaveAttribute("aria-selected", "true");
    expect(document.querySelector(`li[data-record-key='${movementId}']`)).toBeNull();

    fireEvent.click(button);
    expect(screen.getByRole("tab", { name: /Every movement/u })).toHaveAttribute("aria-selected", "true");
    expect(recordFor(movementId)).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("starts Command with the shortlist closed, opens it only on selection, and Close clears view state only", () => {
    renderCoordinator();
    const queue = screen.getByRole("region", { name: "Priority queue" });
    const row = within(queue).getAllByTestId(/^ward-queue-row-/u)[0]!;
    const before = screen.getByTestId("ward-refinement-domain-state").textContent;

    // Direction A (owner, 10 Oct 2026): at rest Placement shows the top of the queue, labelled so,
    // with no Close and no queue row pressed. Nothing is selected until a coordinator picks a row.
    const atRest = screen.getByLabelText("Placement");
    expect(within(atRest).getByTestId("ward-placement-top-of-queue")).toHaveTextContent("Top of queue");
    expect(within(atRest).queryByRole("button", { name: "Close shortlist and clear selection" })).toBeNull();
    expect(screen.queryByLabelText("Referral placement")).toBeNull();
    expect(row).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-pressed", "true");
    const shortlist = screen.getByLabelText("Placement");
    expect(within(shortlist).queryByTestId("ward-placement-top-of-queue")).toBeNull();
    fireEvent.click(within(shortlist).getByRole("button", { name: "Close shortlist and clear selection" }));

    expect(within(screen.getByLabelText("Placement")).getByTestId("ward-placement-top-of-queue")).toBeInTheDocument();
    expect(row).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("ward-refinement-domain-state").textContent).toBe(before);
  });

  it("retains an explicitly selected referral as the shortlist subject across queue-tab switches", () => {
    renderCoordinator();
    const referralsTab = screen.getByRole("radio", { name: /Referrals/u });
    const patientsTab = screen.getByRole("radio", { name: /Patients/u });

    fireEvent.click(referralsTab);
    const referralRow = screen.getAllByTestId(/^ward-referral-row-/u)[0];
    expect(referralRow, "the real fixture must expose at least one queued referral").toBeDefined();
    const referralId = referralRow!.getAttribute("data-testid")!.replace("ward-referral-row-", "");
    fireEvent.click(referralRow!);

    expect(screen.getByTestId(`ward-referral-placement-${referralId}`)).toBeInTheDocument();
    fireEvent.click(patientsTab);
    expect(screen.getByTestId(`ward-referral-placement-${referralId}`)).toBeInTheDocument();
    fireEvent.click(referralsTab);
    expect(screen.getByTestId(`ward-referral-placement-${referralId}`)).toBeInTheDocument();
  });
});

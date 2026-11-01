import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { journeyStages } from "@/components/ward-management/movements/movements-derivations";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { showEveryoneWaiting } from "./helpers/ward-home-queue";

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

// Movements redesign (1 Nov 2026, Q102): the Tier 1 attention pills went; the jump links are now
// the "Where they wait" rows in Shape of the day, each revealing its stage's first movement.
function firstAttentionTarget(): { button: HTMLElement; movementId: string } {
  const open = seedWardFlowState().movements.filter(isOpen);
  const stage = journeyStages(open, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS).find(
    (candidate) => candidate.id !== "arrived" && candidate.movements.length > 0,
  );
  expect(stage, "the real fixture must have an open stage with a journey").toBeDefined();
  fireEvent.click(
    within(screen.getByRole("group", { name: "Movement side view" })).getByRole("button", { name: "Shape of the day" }),
  );
  const heat = screen.getByRole("tabpanel", { name: "Where they wait" });
  return { button: within(heat).getByRole("button", { name: stage!.label }), movementId: stage!.movements[0].id };
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

    const transportOrder = screen.getByRole("radio", { name: "Transport" });
    transportOrder.focus();
    fireEvent.click(transportOrder);
    expect(transportOrder).toHaveAttribute("aria-checked", "true");
    expect(transportOrder).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(button);
    expect(recordFor(movementId)).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("returns from Resolved today to Open and resolved and focuses the requested attention record", async () => {
    renderMovements();
    const { button, movementId } = firstAttentionTarget();
    const resolvedTab = screen.getByRole("tab", { name: /Resolved today/u });

    fireEvent.click(resolvedTab);
    // The tab lives in the address (usability review, 24 Oct 2026), announced a microtask later.
    await act(async () => {});
    expect(resolvedTab).toHaveAttribute("aria-selected", "true");
    expect(document.querySelector(`li[data-record-key='${movementId}']`)).toBeNull();

    fireEvent.click(button);
    await act(async () => {});
    expect(screen.getByRole("tab", { name: /Open and resolved/u })).toHaveAttribute("aria-selected", "true");
    expect(recordFor(movementId)).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("starts Command with the shortlist closed, opens it only on selection, and Close clears view state only", () => {
    renderCoordinator();
    showEveryoneWaiting();
    const queue = screen.getByRole("region", { name: "Priority queue" });
    const row = within(queue).getAllByTestId(/^ward-queue-row-/u)[0]!;
    const before = screen.getByTestId("ward-refinement-domain-state").textContent;

    // Home v7 (Josh, 22 Oct 2026): nobody is pre-selected. At rest Placement is a prompt with
    // nothing to act on, and no queue row is pressed until a coordinator picks one.
    expect(screen.getByTestId("home-placement-prompt")).toBeInTheDocument();
    expect(document.querySelector('aside[aria-label="Placement"]')).toBeNull();
    expect(screen.queryByLabelText("Referral placement")).toBeNull();
    expect(row).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("home-placement-prompt")).toBeNull();
    const shortlist = screen.getByRole("complementary", { name: "Placement" });
    fireEvent.click(within(shortlist).getByRole("button", { name: "Close shortlist and clear selection" }));

    expect(screen.getByTestId("home-placement-prompt")).toBeInTheDocument();
    expect(document.querySelector('aside[aria-label="Placement"]')).toBeNull();
    expect(row).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("ward-refinement-domain-state").textContent).toBe(before);
  });

  it("offers nothing to act on before a patient is chosen, on either list", () => {
    // Home v7 replaced the WP-06 preview (Audit 1, Josh 20 Oct): with no preview there is no
    // first tap to intercept, so neither list offers a Placement action at rest.
    renderCoordinator();
    const before = screen.getByTestId("ward-refinement-domain-state").textContent;
    expect(screen.getByRole("radio", { name: /^My List/u })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("button", { name: /^Offer /u })).toBeNull();
    expect(screen.queryByTestId("ward-placement-top-of-queue")).toBeNull();

    showEveryoneWaiting();
    expect(screen.queryByRole("button", { name: /^Offer /u })).toBeNull();
    expect(screen.queryByTestId("ward-placement-top-of-queue")).toBeNull();
    expect(screen.getByTestId("home-placement-prompt")).toBeInTheDocument();
    expect(screen.getByTestId("ward-refinement-domain-state").textContent).toBe(before);
  });

  it("clears the chosen patient when the coordinator switches lists", () => {
    // Home v7: Placement never shows someone the list on screen does not highlight.
    renderCoordinator();
    showEveryoneWaiting();
    const queue = screen.getByRole("region", { name: "Priority queue" });
    fireEvent.click(within(queue).getAllByTestId(/^ward-queue-row-/u)[0]!);
    expect(screen.getByRole("complementary", { name: "Placement" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /^My List/u }));
    expect(document.querySelector('aside[aria-label="Placement"]')).toBeNull();
    expect(screen.getByTestId("home-placement-prompt")).toBeInTheDocument();
  });

  it("highlights exactly as many queue rows as the hero's Overdue count says", () => {
    renderCoordinator();
    const hero = screen.getByRole("region", { name: /^\d+ open ED journeys, \d+ beds? ready$/u });
    const chip = within(hero).getByRole("button", { name: /Past target/u });
    const count = Number(chip.textContent!.match(/\d+/u)![0]);
    expect(count, "the seed has no overdue movement, so this test proves nothing").toBeGreaterThan(0);

    fireEvent.click(chip);

    expect(chip).toHaveAttribute("aria-pressed", "true");
    const queue = screen.getByRole("region", { name: "Priority queue" });
    const rows = within(queue).getAllByTestId(/^ward-queue-row-/u);
    expect(rows.filter((row) => row.getAttribute("data-dim") !== "true")).toHaveLength(count);
    expect(screen.getByTestId("ward-queue-highlight-foot")).toHaveTextContent(`${count} of ${rows.length}`);
  });

  it("retains an explicitly selected referral as the shortlist subject across queue-tab switches", () => {
    renderCoordinator();
    showEveryoneWaiting();
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

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { ToastProvider } from "@/components/wf";
import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { fitKind } from "@/components/ward-management/coordinator/home-fit";
import { isOpen, referralBlockedReason, shortlistCandidates } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { genderReviewNeeded } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * v10 Home (pass 3): Offer on a State bedflow row refers the selected patient to that ward with an
 * Undo window. Undo leaves nothing sent; letting the window close sends it. Overriding the
 * shortlist needs a reason and a second sign-off tick before Record override acts.
 */

/** A seed patient with a plain fit (bed ready, nothing for the engine to refuse), from the fixture. */
function plainOffer() {
  const state = seedWardFlowState();
  for (const movement of state.movements) {
    if (!isOpen(movement) || movement.acceptedUnitId || movement.referredUnitIds.length > 0) continue;
    if (referralBlockedReason(movement) !== undefined || genderReviewNeeded(movement.gender, movement.sex)) continue;
    const fit = shortlistCandidates(movement, state.units, NOW_ANCHOR).find(
      (candidate) => fitKind(candidate) === "bed",
    );
    if (fit) return { movementId: movement.id, unitId: fit.unit.id, unitName: fit.unit.name };
  }
  throw new Error("The fixture has no plain fit to offer");
}

const MOVEMENT_ID = "WF-030";

function renderHome(movementId = MOVEMENT_ID) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToastProvider>
        <CoordinatorScreen />
      </ToastProvider>
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByTestId(`ward-queue-row-${movementId}`));
  return screen.getByRole("region", { name: "State Bedflow" });
}

function firstOffer() {
  const { movementId, unitId, unitName } = plainOffer();
  const bedflow = renderHome(movementId);
  const button = within(bedflow).getByRole("button", { name: `Offer ${unitName}` });
  return { bedflow, button, unitId };
}

describe("Home Offer with Undo", () => {
  // v10 pass 3 (10 Oct 2026): Offer now refers at once and Undo takes it back through the engine
  // (`UNDO_REFER_TO_UNITS`), replacing the old "hold for 8 s then send", which lost the offer when
  // the page was left. The original two cases are kept, re-pinned to the new behaviour.
  it("marks the ward Offered at once and Undo leaves nothing sent", () => {
    const { bedflow, button, unitId } = firstOffer();
    fireEvent.click(button);

    expect(within(bedflow).getByTestId(`ward-bedflow-offered-${unitId}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(within(bedflow).queryByTestId(`ward-bedflow-offered-${unitId}`)).not.toBeInTheDocument();
    expect(screen.getByText(/^Offer withdrawn\./u)).toBeInTheDocument();
  });

  it("has sent the referral already, so closing the Undo window keeps it", () => {
    const { bedflow, button, unitId } = firstOffer();
    fireEvent.click(button);
    expect(screen.getByText(/^Offered .+ to UM\d{6}$/u)).toBeInTheDocument();
    // Recorded at once: the row reads Offered from the referral itself before the toast closes.
    expect(within(bedflow).getByTestId(`ward-bedflow-offered-${unitId}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Dismiss: Offered / }));

    expect(within(bedflow).getByTestId(`ward-bedflow-offered-${unitId}`)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });
});

describe("Placement override needs a second sign-off", () => {
  it("keeps Record override inert until a reason is chosen and the second sign-off is ticked", () => {
    renderHome();
    const shortlist = screen.getByLabelText("Placement");
    // L3 (12 Oct 2026): an accepted patient's card leads with the next step; the bed list and the
    // override sit behind "Find another bed".
    const another = within(shortlist).queryByTestId("ward-shortlist-find-another-bed");
    if (another) fireEvent.click(another);
    fireEvent.click(within(shortlist).getAllByTestId(/^ward-shortlist-candidate-/u)[0]!);
    fireEvent.click(within(shortlist).getByTestId("ward-shortlist-override-toggle"));

    const submit = within(shortlist).getByRole("button", { name: "Record override" });
    expect(submit).toHaveAttribute("aria-disabled", "true");

    const reason = shortlist.querySelector<HTMLSelectElement>("#ward-shortlist-override-reason")!;
    const firstReason = Array.from(reason.options).find((option) => option.value !== "")!;
    fireEvent.change(reason, { target: { value: firstReason.value } });
    expect(submit).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(within(shortlist).getByTestId("ward-shortlist-override-second-sign-off"));
    // v10 pass 3: who signed off is now recorded, so a typed name is required too.
    expect(submit).toHaveAttribute("aria-disabled", "true");
    fireEvent.change(within(shortlist).getByTestId("ward-shortlist-override-sign-off-name"), {
      target: { value: "J. Synthetic" },
    });
    expect(submit).not.toHaveAttribute("aria-disabled");
    expect(within(shortlist).getByTestId("ward-shortlist-override-second-sign-off-note")).toHaveTextContent(
      "Recorded with the override and its audit entry.",
    );
  });
});

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { ToastProvider } from "@/components/wf";
import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { fitKind } from "@/components/ward-management/coordinator/home-fit";
import { isOpen, referralBlockedReason, shortlistCandidates } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { genderReviewNeeded } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(cleanup);

/**
 * A1-14 and S-8 (audit 13 Oct 2026): after Offer on Home the queue row gave no sign of the offer,
 * and the coordinator's sheet only offered Withdraw. The row now says where it was offered and for
 * how long, and the coordinator can accept for that ward.
 *
 * Home v7 (Josh, 22 Oct 2026): State bedflow and its Offer left Home, and Placement's Refer opens
 * the referral sheet, so the offer is recorded through the engine (`REFER_TO_UNITS`, the event the
 * old Offer sent) and the suite checks what Home shows of it.
 */
// Simplification 26 Nov 2026 (area 2 item 1): Home's Flow list is gone, so a movement is chosen from an
// alert row ("Find a bed for <name>"). These seeded movements carry that alert.
const HOME_FIND_A_BED_IDS = ["WF-308", "WF-009"];

function plainOffer() {
  const state = seedWardFlowState();
  for (const movement of state.movements) {
    if (!isOpen(movement) || movement.acceptedUnitId || movement.referredUnitIds.length > 0) continue;
    if (!HOME_FIND_A_BED_IDS.includes(movement.id)) continue;
    if (referralBlockedReason(movement) !== undefined || genderReviewNeeded(movement.gender, movement.sex)) continue;
    const fit = shortlistCandidates(movement, state.units, NOW_ANCHOR).find(
      (candidate) => fitKind(candidate) === "bed" || fitKind(candidate) === "review",
    );
    if (fit) return { movementId: movement.id, unitId: fit.unit.id, unitName: fit.unit.name };
  }
  throw new Error("The fixture has no plain fit to offer");
}

const engine: { dispatch?: ReturnType<typeof useWardFlow>["dispatch"] } = {};

function AcceptedProbe({ movementId }: { movementId: string }) {
  const { movements, dispatch } = useWardFlow();
  useEffect(() => {
    engine.dispatch = dispatch;
  }, [dispatch]);
  return <p data-testid="accepted-unit">{movements.find((m) => m.id === movementId)?.acceptedUnitId ?? "none"}</p>;
}

function offerFromHome() {
  const offer = plainOffer();
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToastProvider>
        <CoordinatorScreen />
        <AcceptedProbe movementId={offer.movementId} />
      </ToastProvider>
    </WardFlowProvider>,
  );
  // Choose the movement from its alert row: the one whose click opens that movement's shortlist.
  for (const button of screen.getAllByRole("button", { name: /^Find a bed for/u })) {
    fireEvent.click(button);
    if (document.querySelector(`[data-testid="ward-shortlist-${offer.movementId}"]`)) break;
  }
  expect(screen.getByTestId(`ward-shortlist-${offer.movementId}`)).toBeInTheDocument();
  act(() => {
    engine.dispatch!({
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: offer.movementId,
      unitIds: [offer.unitId],
    });
  });
  return offer;
}

describe("an offer made from Home", () => {
  it("can be accepted for the ward by the coordinator, not only withdrawn", () => {
    const { unitId } = offerFromHome();
    const shortlist = screen.getByLabelText("Placement");
    const accept = within(shortlist).getByTestId(`ward-shortlist-accept-for-ward-${unitId}`);
    expect(accept).not.toHaveAttribute("aria-disabled");
    fireEvent.click(accept);
    expect(screen.getByTestId("accepted-unit")).toHaveTextContent(unitId);
  });
});

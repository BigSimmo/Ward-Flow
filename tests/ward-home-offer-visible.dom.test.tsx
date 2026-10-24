import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { ToastProvider } from "@/components/wf";
import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { fitKind } from "@/components/ward-management/coordinator/home-fit";
import { offeredToLabel } from "@/components/ward-management/coordinator/priority-queue";
import { isOpen, referralBlockedReason, shortlistCandidates } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { genderReviewNeeded } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { showWholeHomeQueue } from "./helpers/ward-home-queue";

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
  // Home placement redesign, Josh 19 Oct 2026: desktop Home shows the queue's top 10 behind
  // "Show all (N)"; this suite reads rows further down, so it opens the whole queue first.
  showWholeHomeQueue();
  fireEvent.click(screen.getByTestId(`ward-queue-row-${offer.movementId}`));
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
  it("shows on the queue row with the ward and how long it has waited", () => {
    const { movementId, unitId } = offerFromHome();
    const mark = screen.getByTestId(`ward-queue-offered-${movementId}`);
    expect(mark).toHaveTextContent(offeredToLabel([unitId], seedWardFlowState().units));
    expect(mark).toHaveTextContent(/waiting \d/u);
  });

  it("can be accepted for the ward by the coordinator, not only withdrawn", () => {
    const { unitId } = offerFromHome();
    const shortlist = screen.getByLabelText("Placement");
    const accept = within(shortlist).getByTestId(`ward-shortlist-accept-for-ward-${unitId}`);
    expect(accept).not.toHaveAttribute("aria-disabled");
    fireEvent.click(accept);
    expect(screen.getByTestId("accepted-unit")).toHaveTextContent(unitId);
  });
});

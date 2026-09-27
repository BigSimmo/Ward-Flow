import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn() }),
}));

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardPatientWorkspace } from "@/components/ward-management/ward-management-console";
import type { MovementId } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * `STEP_BACK_STAGE` deliberately touches nothing but the stage — the reducer says "TOUCH NOTHING
 * ELSE" and names every field it must not write: `acceptedUnitId`, `pullExpiresAt`, `admissionId`,
 * `transport`, `Unit.allocatable`. That is correct, is an owner decision, and is not what this file
 * is about.
 *
 * ⚠️ THE SCREEN ALREADY SAID THE RIGHT THING GENERICALLY, AND GENERIC WAS THE PROBLEM. The panel
 * reads "It does not release a bed, cancel transport or undo a ward's acceptance" on EVERY
 * movement — on the ones holding no bed, where it is noise, and on the ones holding a ward bed
 * right now, where it is the entire point and reads as the same boilerplate. A sentence that
 * renders identically whether or not a bed is held cannot tell a coordinator which case they are
 * in, which is the failure this repo has already recorded as "a control that renders the same
 * either way".
 *
 * So the assertion is not "a warning exists" — one did. It is that the warning DISCRIMINATES.
 *
 * ⚠️ AND THE FIXTURE CANNOT BE HAND-BUILT HERE. Measured 2026-09-18: NO seeded movement carries an
 * `admissionId` at rest — the only `admissionId:` before `MIDLAND_DEMONSTRATION_ROWS` in
 * `ward-movements.ts` is the type declaration. A bed is held only once the reducer's `PULL_PATIENT`
 * sets it. So the held-bed state is reached by driving the real reducer, never by asserting against
 * a movement literal that could carry a field nothing in the app ever writes.
 */
function WorkspaceTestControls({ movementId }: { movementId: MovementId }) {
  const { dispatch, now, movements } = useWardFlow();
  const acceptedUnitId = movements.find((candidate) => candidate.id === movementId)?.acceptedUnitId;
  return (
    <button
      type="button"
      data-testid="test-pull-patient"
      onClick={() => dispatch({ type: "PULL_PATIENT", role: "ward", now, movementId, unitId: acceptedUnitId ?? "" })}
    >
      pull
    </button>
  );
}

function renderWorkspace(movementId: MovementId) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardPatientWorkspace movementId={movementId} />
      <WorkspaceTestControls movementId={movementId} />
    </WardFlowProvider>,
  );
}

/** WF-003 is accepted by a ward and has no bed pulled yet, so it can cross the boundary under test. */
const MOVEMENT = "WF-003" as MovementId;
const NOTICE = "ward-console-step-back-still-holding";

function stepBackPanel() {
  return within(screen.getByTestId("ward-patient-step-back-stage"));
}

describe("correcting a stage on a movement that is holding a bed", () => {
  it("stays quiet before a bed is pulled", () => {
    renderWorkspace(MOVEMENT);
    expect(stepBackPanel().queryByTestId(NOTICE)).toBeNull();
  });

  it("names the bed as still held once one is, and points at the control that releases it", () => {
    renderWorkspace(MOVEMENT);
    // Crossing the boundary inside one test is the point: the same movement, the same panel, before
    // and after. Two separate fixtures could differ for some other reason.
    expect(stepBackPanel().queryByTestId(NOTICE)).toBeNull();

    fireEvent.click(screen.getByTestId("test-pull-patient"));

    const notice = stepBackPanel().getByTestId(NOTICE);
    expect(notice.textContent).toMatch(/still hold/i);
    expect(notice.textContent).toMatch(/Release the pulled bed/i);
  });

  it("does not claim the correction releases anything", () => {
    renderWorkspace(MOVEMENT);
    fireEvent.click(screen.getByTestId("test-pull-patient"));
    const notice = stepBackPanel().getByTestId(NOTICE).textContent ?? "";
    // The reducer unwinds nothing. A notice implying otherwise would be worse than none.
    expect(notice).not.toMatch(/will release|releases the bed|frees the bed/i);
  });
});

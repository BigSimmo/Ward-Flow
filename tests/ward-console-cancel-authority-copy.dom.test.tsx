// tests/ward-console-cancel-authority-copy.dom.test.tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  // The Ward Flow sidebar derives its role from the route (ward-nav-role-order.ts), so every
  // suite that renders a rail needs a pathname. A whole-module mock without one makes
  // `usePathname` undefined, which throws at render rather than returning a wrong answer.
  usePathname: () => "/mockups/ward-flow",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn() }),
}));

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardPatientWorkspace } from "@/components/ward-management/ward-management-console";
import type { MovementId } from "@/components/ward-management/ward-model";
import { movementById } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * ⚠️ WLQ-11 (owner, 2026-09-15): *"whoever booked transport may cancel it; the receiving ward
 * still may not."* `ward-flow-reducer.ts`'s `CANCEL_TRANSPORT` case already enforces this against
 * `transport.bookedBy` (see that case's own doc comment) — the reducer was fixed first. This file
 * is about the SCREEN, which before this fix still printed its pre-ruling sentence verbatim: "A
 * ward or community team that booked the job cannot cancel it themselves." That sentence was true
 * of every job as of 2026-09-06 and is now FALSE of any job a ward booked after the ruling — a
 * screen stating a rule the reducer no longer enforces is worse than a screen that says nothing,
 * by this same section's own argument about a button that exists and is refused. The copy must
 * depend on `transport.bookedBy`, the same field the reducer already checks.
 *
 * Every scenario below drives the real reducer through the real workspace — never a hand-built
 * movement — because the whole point is that the SCREEN's printed sentence must agree with what
 * `CANCEL_TRANSPORT` will actually do, and a hand-built fixture could assert that by construction.
 */

function renderWorkspace(movementId: MovementId) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardPatientWorkspace movementId={movementId} />
    </WardFlowProvider>,
  );
}

/**
 * Test-only scaffold, same shape as `tests/ward-console-controls.dom.test.tsx`'s — needed because
 * booking transport AS A WARD has no button anywhere on this page (booking is the sending team's
 * act; the coordinator screen only ever reads the result back off the record).
 */
function WorkspaceTestControls({ movementId }: { movementId: MovementId }) {
  const { dispatch, now, movements } = useWardFlow();
  const acceptedUnitId = movements.find((candidate) => candidate.id === movementId)?.acceptedUnitId;
  return (
    <>
      <button
        type="button"
        data-testid="test-pull-patient"
        onClick={() => dispatch({ type: "PULL_PATIENT", role: "ward", now, movementId, unitId: acceptedUnitId ?? "" })}
      >
        pull
      </button>
      {/* Booked by a DIFFERENT ward from the one receiving the patient — "fre-adult-open" is
          never WF-003's accepted unit ("rph-adult-secure"). Booker and receiver being the same
          ward would make the sentence under test self-contradictory to read, and the reducer
          does not require them to differ, so this keeps the fixture honest about which ward is
          which. */}
      <button
        type="button"
        data-testid="test-book-transport-as-ward"
        onClick={() =>
          dispatch({
            type: "BOOK_TRANSPORT",
            role: "ward",
            now,
            movementId,
            provider: "Patient transport service",
            escortRequired: true,
            cadNumber: "CAD-STUB-0001",
            transportLegalStatus: "voluntary",
            estimatedAt: 0,
            actingUnitId: "fre-adult-open",
          })
        }
      >
        book transport as ward
      </button>
      <button
        type="button"
        data-testid="test-step-back"
        onClick={() =>
          dispatch({
            type: "STEP_BACK_STAGE",
            role: "coordinator",
            now,
            movementId,
            to: "accepted_awaiting_bed",
            reason: "recorded_in_error",
          })
        }
      >
        step back
      </button>
    </>
  );
}

function renderWorkspaceWithControls(movementId: MovementId) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WorkspaceTestControls movementId={movementId} />
      <WardPatientWorkspace movementId={movementId} />
    </WardFlowProvider>,
  );
}

describe("the orphaned-transport panel's cancel-authority copy", () => {
  it("fixture assumption: WF-003 is accepted_awaiting_bed at Ward 2K, with no transport booked yet", () => {
    const wf003 = movementById("WF-003");
    expect(wf003?.stage).toBe("accepted_awaiting_bed");
    expect(wf003?.acceptedUnitId).toBe("rph-adult-secure");
    expect(wf003?.transport).toBeUndefined();
  });

  it("fixture assumption: WF-005 already carries a booked transport job with no recorded booker, because it predates WLQ-11", () => {
    const wf005 = movementById("WF-005");
    expect(wf005?.stage).toBe("handover_ready");
    expect(wf005?.transport).toBeDefined();
    expect(wf005?.transport?.bookedBy).toBeUndefined();
  });

  it("names the booking ward and says the receiving ward may not cancel, when the record proves a ward booked it", () => {
    renderWorkspaceWithControls("WF-003");
    fireEvent.click(screen.getByTestId("test-pull-patient"));
    fireEvent.click(screen.getByTestId("test-book-transport-as-ward"));
    fireEvent.click(screen.getByTestId("test-step-back"));

    const panel = screen.getByTestId("ward-patient-orphaned-transport");
    // The specific ward that booked it, named — not "a ward" or left for the reader to infer.
    // Matched as a string, not a regex: the real ward name contains parentheses, which a regex
    // literal would read as a capture group and silently stop matching.
    expect(
      within(panel).getByText((content) => content.includes("Maali (Ward 4.2) — open, which booked it")),
    ).toBeInTheDocument();
    // And the receiving ward — Ward 2K, distinct from the booking ward above — is told
    // it may not cancel this job itself: "No other ward — including the ward receiving this
    // patient — can cancel it themselves" already negates "can" with "No other ward".
    expect(
      within(panel).getByText(/no other ward.*the ward receiving this patient.*can cancel it themselves/i),
    ).toBeInTheDocument();
  });

  it("names only the coordinator and the referring ED for a job with no recorded booker", () => {
    renderWorkspace("WF-005");
    fireEvent.change(screen.getByTestId("ward-console-step-back-to"), { target: { value: "accepted_awaiting_bed" } });
    fireEvent.change(screen.getByTestId("ward-console-step-back-reason"), { target: { value: "recorded_in_error" } });
    fireEvent.click(screen.getByTestId("ward-console-step-back-stage"));

    const panel = screen.getByTestId("ward-patient-orphaned-transport");
    expect(
      within(panel).getByText(/cancelled by the flow coordinator or by the referring emergency department/i),
    ).toBeInTheDocument();
    // No ward is named as able to cancel — the "which booked it" clause only ever appears when
    // `transport.bookedBy` names a ward, which this seeded job does not carry.
    expect(within(panel).queryByText(/which booked it/i)).not.toBeInTheDocument();
  });

  it("never says a community team can cancel", () => {
    renderWorkspace("WF-005");
    fireEvent.change(screen.getByTestId("ward-console-step-back-to"), { target: { value: "accepted_awaiting_bed" } });
    fireEvent.change(screen.getByTestId("ward-console-step-back-reason"), { target: { value: "recorded_in_error" } });
    fireEvent.click(screen.getByTestId("ward-console-step-back-stage"));

    const panel = screen.getByTestId("ward-patient-orphaned-transport");
    const panelText = panel.textContent ?? "";
    // This seeded job has no community booker, so no community team is named. (Owner third ruling,
    // 2026-09-17, answer 9, lets the community team that BOOKED a job cancel it; the reducer checks
    // bookedBy.placeId, and the console names that team only when the record shows it booked.)
    expect(panelText).not.toMatch(/community team (may|can) cancel/i);
    expect(panelText).toMatch(/including a ward with no recorded booking, cannot cancel it themselves/i);
  });
});

import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow",
  useRouter: () => router,
}));

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardPatientWorkspace } from "@/components/ward-management/ward-management-console";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE } from "@/components/ward-management/ward-derivations";

/**
 * T8 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`): the movement console's own
 * copy of the revoked-while-bed-held flag `ward-ed-screen.dom.test.tsx` already proves for the ED
 * screen — same shared `EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE` sentence, same derivation
 * (`examinationRevokedWhileBedHeld`, `ward-derivations.ts`).
 *
 * No seeded fixture movement can stand in for the precondition: `Movement.admissionId` is
 * `undefined` on every hand-authored movement in `ward-movements.ts`, including ones already
 * authored at `pulled`/`handover_ready` — its own doc comment says the "pulled" and later stages
 * on seeded movements "were authored rather than reached by dispatching the event." So this
 * dispatches the real event sequence (`RAISE_REFERRAL` → `REFER_TO_UNITS` → `ACCEPT_IN_PRINCIPLE`
 * → `PULL_PATIENT` → `BOOK_TRANSPORT` → `HANDOVER_READY` → `RECORD_EXAMINATION`) through a harness
 * exposing the raw events the console page itself has no controls for, the same "expose the real
 * event, not a fixture" discipline `StaleBlockedReleaseSetup` (`ward-capacity-view.dom.test.tsx`)
 * already uses.
 */
function ConsoleFlagHarness() {
  const { dispatch, now, movements, units } = useWardFlow();
  const target = movements.at(-1);
  const unit = units.find((candidate) => candidate.allocatable.value >= 1);

  return (
    <div>
      <button
        type="button"
        data-testid="console-test-raise"
        onClick={() =>
          dispatch({
            type: "RAISE_REFERRAL",
            role: "ed",
            now,
            edId: allEmergencyDepartments()[0]!.id,
            draft: {
              cohort: "Adult",
              security: "Open",
              sex: "Female",
              gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
              specialling: false,
              highAcuity: false,
              legalStatus: "Detained awaiting examination",
              urgency: 2,
              legalFormCode: "1A",
            },
          })
        }
      >
        raise
      </button>
      {target && unit ? (
        <>
          <button
            type="button"
            data-testid="console-test-refer"
            onClick={() =>
              dispatch({ type: "REFER_TO_UNITS", role: "coordinator", now, movementId: target.id, unitIds: [unit.id] })
            }
          >
            refer
          </button>
          <button
            type="button"
            data-testid="console-test-accept"
            onClick={() =>
              dispatch({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", now, movementId: target.id, unitId: unit.id })
            }
          >
            accept
          </button>
          <button
            type="button"
            data-testid="console-test-pull"
            onClick={() =>
              dispatch({ type: "PULL_PATIENT", role: "ward", now, movementId: target.id, unitId: unit.id })
            }
          >
            pull
          </button>
          <button
            type="button"
            data-testid="console-test-book"
            onClick={() =>
              dispatch({
                type: "BOOK_TRANSPORT",
                role: "ed",
                now,
                movementId: target.id,
                provider: "Ambulance service",
                escortRequired: false,
                cadNumber: "CAD-STUB-0001",
                transportLegalStatus: "voluntary",
                estimatedAt: 0,
              })
            }
          >
            book
          </button>
          <button
            type="button"
            data-testid="console-test-handover"
            onClick={() => dispatch({ type: "HANDOVER_READY", role: "ed", now, movementId: target.id })}
          >
            handover
          </button>
          <button
            type="button"
            data-testid="console-test-revoke"
            onClick={() =>
              dispatch({ type: "RECORD_EXAMINATION", role: "ed", now, movementId: target.id, outcome: "revoked" })
            }
          >
            revoke
          </button>
          <WardPatientWorkspace movementId={target.id} />
        </>
      ) : null}
    </div>
  );
}

function renderHarness() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ConsoleFlagHarness />
    </WardFlowProvider>,
  );
}

describe("movement console — revoked-while-bed-held flag (T8)", () => {
  it("shows the flag once a handover_ready movement's examination is revoked, and not for a pulled-only movement", () => {
    renderHarness();
    fireEvent.click(screen.getByTestId("console-test-raise"));

    // Pulled only — no examination recorded at all yet. The anti-vacuity half: proves the flag
    // is not simply always on once a bed is held.
    fireEvent.click(screen.getByTestId("console-test-refer"));
    fireEvent.click(screen.getByTestId("console-test-accept"));
    fireEvent.click(screen.getByTestId("console-test-pull"));
    expect(screen.queryByTestId("ward-console-examination-revoked-flag")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("console-test-book"));
    fireEvent.click(screen.getByTestId("console-test-handover"));
    fireEvent.click(screen.getByTestId("console-test-revoke"));

    const flag = screen.getByTestId("ward-console-examination-revoked-flag");
    expect(flag).toHaveTextContent(EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE);
  });
});

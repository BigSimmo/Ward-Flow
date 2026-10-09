import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { TRANSPORT_PROVIDERS, type Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * Community transport booking and cancel on the admitted table — the control the engine already
 * permitted (`BOOK_TRANSPORT` / `CANCEL_TRANSPORT` with role `community` and `actingPlaceId`) but
 * the screen never offered.
 *
 * Owner decision 1 (22 Sep 2026): drawings own look only. The Actions column keeps book/cancel
 * (and Open Dossier when `patientId` is present) rather than stripping to the drawing's
 * "Open Dossier" alone.
 *
 * Event proof is outcome-based: the reducer only writes `bookedBy.placeId` from a community
 * caller's `actingPlaceId`, and only clears that job for a community cancel when `actingPlaceId`
 * matches the booker. A wrong role or place would leave rejections and leave the job untouched.
 */

const TEAM = COMMUNITY_TEAM_PAGES[0]!;

function admission(overrides: Partial<Admission>): Admission {
  return {
    id: "AD-TRANSPORT-01",
    unitId: "unit-under-test",
    specialling: false,
    highAcuity: false,
    referralId: null,
    movementId: null,
    patientId: null,
    sex: "Female",
    homeRegion: "Perth Metropolitan",
    tentativeDiagnosis: null,
    state: "pulled",
    pulledAt: NOW_ANCHOR,
    arrivedAt: null,
    awayAtEmergencyDepartmentSince: null,
    absentWithoutLeaveSince: null,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    dischargeConfirmedAt: null,
    dischargeConfirmedBy: null,
    blockReason: null,
    leavingDestination: null,
    leftAt: null,
    followUp: null,
    ...overrides,
  };
}

function referralNamingTeam(teamName: string): Referral {
  let state = seedWardFlowState();
  state = wardFlowReducer(state, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW_ANCHOR,
    ageBand: "Adult",
    destinations: [{ kind: "community_team", teamName }],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  });
  expect(state.rejections, "fixture referral must be accepted").toEqual([]);
  return state.referrals.at(-1)!;
}

/** A pulled seed movement that still has no transport job — the only shape the book control may open for. */
function pulledMovementWithoutTransport(): { movementId: string } {
  const movement = seedWardFlowState().movements.find(
    (candidate) => candidate.stage === "pulled" && candidate.transport === undefined,
  );
  expect(movement, "seed must hold a pulled movement with no transport").toBeDefined();
  return { movementId: movement!.id };
}

function TransportProbe({ movementId }: { movementId: string }) {
  const { movements, rejections, dispatch, now } = useWardFlow();
  const movement = movements.find((candidate) => candidate.id === movementId);
  return (
    <div data-testid="transport-probe">
      <span data-testid="transport-probe-booked-by">
        {movement?.transport?.bookedBy
          ? `${movement.transport.bookedBy.role}:${movement.transport.bookedBy.placeId ?? ""}`
          : "none"}
      </span>
      <span data-testid="transport-probe-has-job">{movement?.transport ? "yes" : "no"}</span>
      <span data-testid="transport-probe-rejections">{rejections.length}</span>
      <button
        type="button"
        data-testid="prebook-transport"
        onClick={() =>
          dispatch({
            type: "BOOK_TRANSPORT",
            role: "community",
            now,
            movementId,
            actingPlaceId: TEAM.id,
            provider: TRANSPORT_PROVIDERS[0]!,
            escortRequired: false,
            cadNumber: "CAD-PREBOOK",
            transportLegalStatus: "voluntary",
            estimatedAt: now + 30,
          })
        }
      >
        Prebook
      </button>
    </div>
  );
}

function renderTeamScreen(movementId: string | null, patientId: Admission["patientId"] = null) {
  const referral = referralNamingTeam(TEAM.name);
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      {typeof movementId === "string" ? <TransportProbe movementId={movementId} /> : null}
      <CommunityScreen
        teamId={TEAM.id}
        admissions={[
          admission({
            id: movementId === null ? "AD-NO-MOVEMENT" : "AD-TRANSPORT-01",
            referralId: referral.id,
            movementId: movementId as Admission["movementId"],
            patientId,
            state: "pulled",
          }),
        ]}
        referrals={[referral]}
      />
    </WardFlowProvider>,
  );
}

function fillAndConfirmBooking(movementId: string) {
  fireEvent.click(screen.getByTestId(`ward-community-book-transport-${movementId}`));
  const dialog = screen.getByTestId(`ward-community-book-transport-dialog-${movementId}`);
  fireEvent.change(within(dialog).getByTestId(`ward-community-transport-provider-${movementId}`), {
    target: { value: TRANSPORT_PROVIDERS[1]! },
  });
  fireEvent.click(within(dialog).getByTestId(`ward-community-transport-escort-yes-${movementId}`));
  fireEvent.change(within(dialog).getByTestId(`ward-community-transport-cad-${movementId}`), {
    target: { value: "CAD-7788" },
  });
  fireEvent.click(within(dialog).getByTestId(`ward-community-transport-legal-involuntary-${movementId}`));
  fireEvent.change(within(dialog).getByTestId(`ward-community-transport-estimated-time-${movementId}`), {
    target: { value: "14:30" },
  });
  const confirm = within(dialog).getByTestId(`ward-community-book-transport-confirm-${movementId}`);
  expect(confirm).not.toHaveAttribute("aria-disabled");
  fireEvent.click(confirm);
}

describe("community admitted table — transport booking and cancel", () => {
  it("shows the booking control for a pulled admission with a movementId and no transport", () => {
    const { movementId } = pulledMovementWithoutTransport();
    renderTeamScreen(movementId);

    expect(screen.getByTestId(`ward-community-book-transport-${movementId}`)).toBeTruthy();
    expect(screen.queryByTestId(`ward-community-cancel-transport-${movementId}`)).toBeNull();
  });

  it("submitting the required answers dispatches BOOK_TRANSPORT with role community and the team id", () => {
    const { movementId } = pulledMovementWithoutTransport();
    renderTeamScreen(movementId);

    fillAndConfirmBooking(movementId);

    expect(screen.getByTestId("transport-probe-rejections").textContent).toBe("0");
    expect(screen.getByTestId("transport-probe-has-job").textContent).toBe("yes");
    expect(screen.getByTestId("transport-probe-booked-by").textContent).toBe(`community:${TEAM.id}`);
    expect(screen.queryByTestId(`ward-community-book-transport-${movementId}`)).toBeNull();
    expect(screen.getByTestId(`ward-community-cancel-transport-${movementId}`)).toBeTruthy();
  });

  it("a booking made by this team shows cancel; submitting dispatches CANCEL_TRANSPORT with reason and actingPlaceId", () => {
    const { movementId } = pulledMovementWithoutTransport();
    renderTeamScreen(movementId);

    fireEvent.click(screen.getByTestId("prebook-transport"));
    expect(screen.getByTestId("transport-probe-booked-by").textContent).toBe(`community:${TEAM.id}`);
    expect(screen.getByTestId(`ward-community-cancel-transport-${movementId}`)).toBeTruthy();

    fireEvent.click(screen.getByTestId(`ward-community-cancel-transport-${movementId}`));
    const dialog = screen.getByTestId(`ward-community-cancel-transport-dialog-${movementId}`);
    fireEvent.change(within(dialog).getByTestId(`ward-community-cancel-transport-reason-${movementId}`), {
      target: { value: "provider_unavailable" },
    });
    const confirm = within(dialog).getByTestId(`ward-community-cancel-transport-confirm-${movementId}`);
    expect(confirm).not.toHaveAttribute("aria-disabled");
    fireEvent.click(confirm);

    expect(screen.getByTestId("transport-probe-rejections").textContent).toBe("0");
    expect(screen.getByTestId("transport-probe-has-job").textContent).toBe("no");
    expect(screen.getByTestId(`ward-community-book-transport-${movementId}`)).toBeTruthy();
  });

  it("an admission with movementId null shows no booking control", () => {
    renderTeamScreen(null);

    const cell = screen.getByTestId("ward-community-transport-cell-AD-NO-MOVEMENT");
    expect(
      within(cell).queryByRole("button", { name: /Log transport booking|Cancel this team's booking/i }),
    ).toBeNull();
    expect(screen.queryByTestId(/ward-community-book-transport-/)).toBeNull();
  });

  it("Actions keeps book beside Open Dossier when the admission has a patientId (owner decision 1)", () => {
    const { movementId } = pulledMovementWithoutTransport();
    // A real sample patient: the dossier now reads the record, not a typed table (25 Sept 2026).
    renderTeamScreen(movementId, "PT-010");

    const cell = screen.getByTestId("ward-community-transport-cell-AD-TRANSPORT-01");
    expect(within(cell).getByTestId("ward-community-open-dossier-AD-TRANSPORT-01")).toBeTruthy();
    expect(within(cell).getByTestId(`ward-community-book-transport-${movementId}`)).toBeTruthy();
    expect(within(cell).queryByTestId(`ward-community-cancel-transport-${movementId}`)).toBeNull();

    fireEvent.click(within(cell).getByTestId("ward-community-open-dossier-AD-TRANSPORT-01"));
    expect(screen.getByRole("dialog", { name: /Patient Dossier: Farah Davenporton · UM100010/i })).toBeTruthy();
  });

  it("Actions omits Open Dossier when patientId is null but still offers booking", () => {
    const { movementId } = pulledMovementWithoutTransport();
    renderTeamScreen(movementId, null);

    const cell = screen.getByTestId("ward-community-transport-cell-AD-TRANSPORT-01");
    expect(within(cell).queryByTestId("ward-community-open-dossier-AD-TRANSPORT-01")).toBeNull();
    expect(within(cell).getByTestId(`ward-community-book-transport-${movementId}`)).toBeTruthy();
  });
});

import "@testing-library/jest-dom/vitest";
import { createRef } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import type { CommunityScreenView } from "@/components/ward-management/community/community-screen";
import { CommunityScreenSentTab } from "@/components/ward-management/community/community-screen-sent-tab";
import { WardBedDossierDrawer } from "@/components/ward-management/ward/ward-bed-dossier-drawer";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import { dueSoonThresholdsOf } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { communitySentView } from "@/components/ward-management/ward-referral-visibility";
import { activeWardNetwork, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * D-80 (role access plan v2): the sending ward and the sending community team change their own
 * journey's urgency and legal status from their own screens, and nobody else's journey offers it.
 */
let pathname = "/ward-flow";
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>()),
  useWardFlow: () => context,
  useWardFlowSelect: () => context,
  useOptionalWardFlowSelect: () => context,
  useDueSoonThresholds: () => dueSoonThresholdsOf(context?.configuration),
  useWardNetwork: () => activeWardNetwork(),
  useWardFlowClock: () => NOW_ANCHOR,
}));

const seed = seedWardFlowState();
const unit = seed.units[0]!;
const stay = { ...seed.admissions[0]!, id: "ADM-D80-STAY", unitId: unit.id, patientId: "PT-D80" as const };
const team = COMMUNITY_TEAM_PAGES[0]!;
const open = seed.movements.find((movement) => !movement.closure)!;
const journey = (id: `WF-${string}`, fields: Partial<Movement>): Movement => ({
  ...open,
  id,
  urgency: 2,
  legalStatus: "Voluntary",
  closure: undefined,
  sourceAdmissionId: undefined,
  ...fields,
});
const teamSent = {
  ...seed.referrals[0]!,
  id: "REF-D80-TEAM",
  source: "community",
  sendingTeamName: team.name,
} as Referral;
const edSent = { ...seed.referrals[0]!, id: "REF-D80-ED", source: "ed_medical" } as Referral;

const context = {
  ...seed,
  dispatch: vi.fn(),
  resolvePatientIdentity: (subject: Parameters<typeof resolveSubjectPatient>[0]) =>
    resolveSubjectPatient(subject, context),
};

function setState(movements: Movement[]) {
  const state: WardFlowState = {
    ...seed,
    admissions: [stay, ...seed.admissions],
    referrals: [teamSent, edSent, ...seed.referrals],
    movements: [...movements, ...seed.movements],
  };
  Object.assign(context, state);
}

beforeEach(() => {
  context.dispatch.mockClear();
});

function renderDossier() {
  render(
    <WardBedDossierDrawer
      selectedBed={5}
      bedItem={{
        bedNumber: 5,
        bedLabel: "Bed 05",
        status: "occupied",
        statusText: "Inpatient",
        admissionId: stay.id,
        patientAlias: "Synthetic person",
      }}
      unit={unit}
      onClose={() => {}}
      drawerLeavingDestination={LEAVING_DESTINATIONS[0].id}
      setDrawerLeavingDestination={() => {}}
      onRecordLeft={() => {}}
      bedDrawerRef={createRef<HTMLElement>()}
      onKeyDown={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("tab", { name: "Plan to leave" }));
}

describe("the sending ward's own journey (D-80)", () => {
  beforeEach(() => {
    pathname = `/ward-flow/ward/${unit.id}`;
  });

  it("changes the urgency of the journey leaving its own stay, as the ward", () => {
    setState([journey("WF-D80-BACK", { sourceAdmissionId: stay.id, patientId: stay.patientId })]);
    renderDossier();
    const controls = screen.getByTestId("sent-journey-changes");
    expect(within(controls).getByTestId("sent-journey-now")).toHaveTextContent("Tier 2");
    fireEvent.click(within(controls).getByRole("button", { name: "Change urgency" }));
    fireEvent.change(within(controls).getByLabelText("Urgency tier for Synthetic person"), {
      target: { value: "1" },
    });
    // Finding 15 (27 Oct 2026): the reason is optional, so the change records without one.
    fireEvent.click(within(controls).getByRole("button", { name: "Record urgency change" }));
    expect(context.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "CHANGE_URGENCY", role: "ward", movementId: "WF-D80-BACK", urgency: 1 }),
    );
    expect(context.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ reason: expect.anything() }));
  });

  it("offers nothing on a journey an ED sent for the same person", () => {
    setState([journey("WF-D80-ED", { referralId: edSent.id, patientId: stay.patientId })]);
    renderDossier();
    expect(screen.queryByTestId("sent-journey-changes")).not.toBeInTheDocument();
    expect(screen.queryByText("Journey this ward sent")).not.toBeInTheDocument();
  });
});

function renderSentTab() {
  const view = {
    activeTab: "tab-sent",
    sentReferrals: communitySentView([teamSent]),
    team,
    units: seed.units,
    now: NOW_ANCHOR,
    identityOf: () => "Synthetic person",
  } as unknown as CommunityScreenView;
  render(<CommunityScreenSentTab view={view} />);
}

describe("the sending community team's own journey (D-80)", () => {
  beforeEach(() => {
    pathname = `/ward-flow/community/${team.id}`;
  });

  it("changes the legal status of the journey its referral started, as the team", () => {
    setState([journey("WF-D80-TEAM", { referralId: teamSent.id })]);
    renderSentTab();
    const row = screen.getByTestId(`ward-community-sent-journey-${teamSent.id}`);
    fireEvent.click(within(row).getByRole("button", { name: "Change legal status" }));
    // Nothing is chosen for the team: the status, then the reason.
    expect(within(row).getByLabelText("Legal status for Synthetic person")).toHaveValue("");
    fireEvent.change(within(row).getByLabelText("Legal status for Synthetic person"), {
      target: { value: "Involuntary inpatient" },
    });
    const reason = within(row).getByLabelText("Reason") as HTMLSelectElement;
    fireEvent.change(reason, { target: { value: reason.options[1]!.value } });
    fireEvent.click(within(row).getByRole("button", { name: "Record legal status change" }));
    expect(context.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CHANGE_LEGAL_STATUS",
        role: "community",
        movementId: "WF-D80-TEAM",
        legalStatus: "Involuntary inpatient",
      }),
    );
  });

  it("offers nothing once the journey has closed", () => {
    setState([
      journey("WF-D80-TEAM", {
        referralId: teamSent.id,
        closure: { at: NOW_ANCHOR, outcome: "did_not_proceed", reason: "Synthetic closure." },
      }),
    ]);
    renderSentTab();
    expect(screen.queryByTestId("sent-journey-changes")).not.toBeInTheDocument();
  });

  it("offers nothing to a ward desk, which did not send the team's referral", () => {
    pathname = `/ward-flow/ward/${unit.id}`;
    setState([journey("WF-D80-TEAM", { referralId: teamSent.id })]);
    renderSentTab();
    expect(screen.queryByTestId("sent-journey-changes")).not.toBeInTheDocument();
  });
});

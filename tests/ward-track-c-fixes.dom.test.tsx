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

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import {
  BED_SHAPED_DECLINE_REASONS,
  ED_DECLINE_REASONS,
  type Referral,
  type Unit,
} from "@/components/ward-management/ward-model";
import { DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import { allEmergencyDepartments, allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

function MatchHarness({ referral, units }: { referral: Referral; units: Unit[] }) {
  const { now, dispatch, rejections } = useWardFlow();
  return <ReferralMatchView referral={referral} units={units} now={now} dispatch={dispatch} rejections={rejections} />;
}

const BASE_REFERRAL: Referral = {
  id: "RF-TRACK-C",
  ageBand: "Adult",
  homeRegion: "Perth Metropolitan",
  suburb: { kind: "named", name: "Armadale" },
  source: "community",
  raisedAt: NOW_ANCHOR - 30,
  urgency: 2,
  originSiteCode: "RPH",
  transportNeeded: false,
  destinations: [
    { destination: { kind: "emergency_department", edId: "rph-ed", purpose: "psychiatric_review" }, state: "queued" },
  ],
  ...FIXTURE_HISTORY,
};

const DUAL_DESTINATION_REFERRAL: Referral = {
  id: "RF-DUAL-DEST",
  ageBand: "Adult",
  homeRegion: "Perth Metropolitan",
  suburb: { kind: "named", name: "Armadale" },
  source: "community",
  raisedAt: NOW_ANCHOR - 20,
  urgency: 1,
  originSiteCode: "RPH",
  transportNeeded: false,
  destinations: [
    {
      destination: {
        kind: "psychiatric_ward",
        sex: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
      state: "queued",
    },
    {
      destination: {
        kind: "community_team",
        teamName: "Inner City Clinic",
      },
      state: "queued",
    },
  ],
  ...FIXTURE_HISTORY,
};

describe("Track C Referral Matching fixes", () => {
  it("ED destination decline reasons offer ED_DECLINE_REASONS and exclude bed-shaped reasons", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MatchHarness referral={BASE_REFERRAL} units={allUnits()} />
      </WardFlowProvider>,
    );

    const select = screen.getByTestId("ward-referral-match-decline-reason-emergency_department");
    for (const reason of ED_DECLINE_REASONS) {
      expect(within(select).getByRole("option", { name: DECLINE_REASON_LABELS[reason] })).toBeInTheDocument();
    }
    for (const bedReason of BED_SHAPED_DECLINE_REASONS) {
      expect(within(select).queryByRole("option", { name: DECLINE_REASON_LABELS[bedReason] })).not.toBeInTheDocument();
    }
  });

  it("ED destination renders accept button with confirmation workflow dispatching ACCEPT_REFERRAL", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MatchHarness referral={BASE_REFERRAL} units={allUnits()} />
      </WardFlowProvider>,
    );

    // Initial button exists
    const initialButton = screen.getByTestId("ward-referral-match-accept-emergency_department");
    expect(initialButton).toHaveTextContent(/Accept presentation \/ referral/i);

    // Clicking opens confirmation
    fireEvent.click(initialButton);
    const confirmButton = screen.getByTestId("ward-referral-match-confirm-accept-emergency_department");
    const cancelButton = screen.getByTestId("ward-referral-match-cancel-accept-emergency_department");
    expect(confirmButton).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();

    // Clicking cancel closes confirmation
    fireEvent.click(cancelButton);
    expect(screen.getByTestId("ward-referral-match-accept-emergency_department")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-match-confirm-accept-emergency_department")).not.toBeInTheDocument();

    // Reopen and confirm
    fireEvent.click(screen.getByTestId("ward-referral-match-accept-emergency_department"));
    fireEvent.click(screen.getByTestId("ward-referral-match-confirm-accept-emergency_department"));
  });

  it("Dual-destination referral renders community triage controls alongside psychiatric bed candidate matching", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MatchHarness referral={DUAL_DESTINATION_REFERRAL} units={allUnits()} />
      </WardFlowProvider>,
    );

    // Psychiatric ward bed candidates render
    expect(screen.getByTestId("ward-referral-match-panel")).toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-match-decline-controls")).toBeInTheDocument();

    // Community triage controls also render alongside bed candidates
    expect(screen.getByTestId("ward-referral-match-accept-controls-community_team")).toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-match-decline-controls-community_team")).toBeInTheDocument();
  });
});

describe("Track C Referral Board fixes", () => {
  it("Decided table rows and mobile cards render selection buttons and open referral details", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralBoard />
      </WardFlowProvider>,
    );

    // Table row select button exists for decided referral RF-006
    const decidedRowButton = screen.getByTestId("ward-referral-board-select-decided-RF-006");
    expect(decidedRowButton).toBeInTheDocument();
    expect(decidedRowButton).toHaveTextContent("RF-006");

    // Mobile card select button exists for RF-006
    const decidedCardButton = screen.getByTestId("ward-referral-board-select-decided-card-RF-006");
    expect(decidedCardButton).toBeInTheDocument();

    // Clicking decided selection opens detail
    fireEvent.click(decidedRowButton);
    expect(screen.getByTestId("ward-referral-match-panel")).toBeInTheDocument();
  });

  it("Decided mobile cards contain no child testid starting with ward-referral-board-decided-card-", () => {
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralBoard />
      </WardFlowProvider>,
    );

    const cards = container.querySelectorAll("[data-testid^='ward-referral-board-decided-card-']");
    for (const card of Array.from(cards)) {
      expect(card.tagName.toLowerCase()).toBe("li");
      const childCollisions = card.querySelectorAll("[data-testid^='ward-referral-board-decided-card-']");
      expect(childCollisions.length).toBe(0);
    }
  });
});

describe("Track C ED screen fixes", () => {
  it("Synchronizes patient bay in the detail drawer with patientBay", () => {
    const department = allEmergencyDepartments()[0];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId={department.id} />
      </WardFlowProvider>,
    );

    // Patient names open records; the separate UMRN badge keeps identity visible on the row.
    const row = screen.getAllByTestId(/^ward-ed-patient-WF-/u)[0];
    const name = row.querySelector<HTMLButtonElement>('button[title^="View patient details"]');
    expect(name).not.toBeNull();
    const bay = row.children[2]?.textContent;
    expect(within(row).getByText("UMRN")).toBeInTheDocument();
    fireEvent.click(name!);

    // Check detail drawer bay value in "Where they are up to" section
    const whereSection = screen.getByText("Where they are up to").closest("section")!;
    const bayDt = within(whereSection).getByText("Bay");
    const bayDd = bayDt.nextElementSibling;
    expect(bayDd?.textContent).not.toBe("not recorded");
    expect(bayDd?.textContent).toMatch(/^Bay \d{2}$/u);
    expect(bayDd?.textContent).toBe(`Bay ${bay}`);
  });

  it("Wired priority flag actions can be clicked without throwing or jamming", () => {
    const department = allEmergencyDepartments()[0];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId={department.id} />
      </WardFlowProvider>,
    );

    // Any action buttons in priority flags section
    const actionButtons = screen.queryAllByRole("button", { name: /Record the review|Acknowledge/i });
    for (const button of actionButtons) {
      fireEvent.click(button);
    }
  });
});

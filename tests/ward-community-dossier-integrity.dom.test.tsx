import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { communityScopedReferrals } from "@/components/ward-management/ward-referral-visibility";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import {
  admissionBelongsToTeam,
  COMMUNITY_TEAM_PAGES,
  communityTeamSlug,
} from "@/components/ward-management/community/community-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Referral } from "@/components/ward-management/ward-model";
import { patientIdentityLine, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";

const TEAM_NAME = "Mead Centre (Armadale)";
const TEAM_ID = communityTeamSlug(TEAM_NAME);
const seed = seedWardFlowState();
const base = seed.referrals[0]!;
function fixture(overrides: Partial<Referral>): Referral {
  return {
    ...base,
    id: "dossier-test",
    history: undefined,
    medicalClearance: undefined,
    destinations: [{ destination: { kind: "community_team", teamName: TEAM_NAME }, state: "queued" }],
    ...overrides,
  } as Referral;
}
function openReferral(id: string) {
  act(() => (window as unknown as { openReferralDrawer(id: string): void }).openReferralDrawer(id));
}
function openPatient(id: string) {
  act(() => (window as unknown as { openPatientDrawer(id: string): void }).openPatientDrawer(id));
}
function Probe() {
  const { dispatch, now, referrals, admissions, dayZero } = useWardFlow();
  const referral = referrals.find((r) =>
    r.destinations.some((d) => d.destination.kind === "community_team" && d.destination.teamName === TEAM_NAME),
  );
  const date = new Date(dayZero.getTime() + now * 60_000);
  const at = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return (
    <>
      <button
        onClick={() =>
          dispatch({ type: "REFER_TO_COMMUNITY_TEAM", role: "ed", now, movementId: "WF-003", team: TEAM_NAME })
        }
      >
        Create referral
      </button>
      <button
        onClick={() =>
          referral && dispatch({ type: "RECORD_REFERRER_WITHDRAWAL", role: "ed", now, referralId: referral.id })
        }
      >
        Withdraw referral
      </button>
      <output data-testid="referral-id">{referral?.id}</output>
      <output data-testid="appointment-at">{at}</output>
      <output data-testid="recorded-appointments">{admissions.filter((a) => a.careJourney?.followUp).length}</output>
    </>
  );
}
function start(props: { referrals?: Referral[]; teamId?: string } = {}) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Probe />
      <CommunityScreen
        teamId={props.teamId ?? TEAM_ID}
        referrals={props.referrals && communityScopedReferrals(props.referrals)}
      />
    </WardFlowProvider>,
  );
}

describe("community dossiers preserve source facts and actual mutation outcomes", () => {
  it.each([undefined, { cleared: false, at: NOW_ANCHOR }, { cleared: true, at: NOW_ANCHOR }])(
    "shows only the recorded medical clearance %j",
    (medicalClearance) => {
      start({ referrals: [fixture({ medicalClearance })] });
      openReferral("dossier-test");
      // D-39: the dialog names the person by name and UMRN, never by the referral number.
      const dossier = screen.getByRole("dialog", {
        name: `Referral Triage: ${patientIdentityLine(resolveSubjectPatient(fixture({}), seed))}`,
      });
      expect(screen.queryByRole("dialog", { name: /dossier-test/ })).toBeNull();
      expect(dossier).toHaveTextContent("History not recorded");
      expect(dossier).toHaveTextContent(
        medicalClearance
          ? medicalClearance.cleared
            ? "Recorded as medically cleared"
            : "Recorded as not medically cleared"
          : "Medical clearance not recorded",
      );
      expect(dossier).not.toHaveTextContent(/Full blood count|No organic cause|persecutory delusions/);
      expect(within(dossier).queryByRole("combobox", { name: "Assign Key Clinician:" })).not.toBeInTheDocument();
      expect(dossier).toHaveTextContent("Clinician assignment: Not wired in this prototype.");
    },
  );

  it("does not fabricate a referral when an operational ID is missing", () => {
    start();
    openReferral("missing-operational-record");
    const dossier = screen.getByRole("dialog", { name: "Referral unavailable" });
    expect(dossier).toHaveTextContent("No patient or clinical information has been inferred");
    expect(within(dossier).getByRole("button", { name: "Accept referral" })).toBeDisabled();
    expect(dossier).not.toHaveTextContent(/PT-4409|RF-8824|clear pathology/);
  });

  it("does not open another community team's referral in this team's drawer", () => {
    start({
      referrals: [
        fixture({
          id: "other-team-referral",
          destinations: [{ destination: { kind: "community_team", teamName: "Bentley" }, state: "queued" }],
        }),
      ],
    });
    openReferral("other-team-referral");
    expect(screen.getByRole("dialog", { name: "Referral unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Referral Triage: other-team-referral" })).not.toBeInTheDocument();
  });

  it("still reads a broken referral link as a gap, not as an empty team", () => {
    // The page holds only community-scoped referrals (FD-23). A referral id that matches nothing in
    // the full record must still make the list not computable rather than measured empty.
    const admission = { ...seed.admissions[0]!, referralId: "no-such-referral" };
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CommunityScreen teamId={TEAM_ID} admissions={[admission]} referrals={[]} />
      </WardFlowProvider>,
    );
    expect(document.body).toHaveTextContent("A bed carries no link back to the referral that named this team");
  });

  it("keeps a withdrawn dossier current and does not report successful acceptance", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: "Create referral" }));
    openReferral(screen.getByTestId("referral-id").textContent!);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw referral" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Accept referral" }));
    expect(screen.getByTestId("community-acceptance-result")).toHaveTextContent("cannot be accepted");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("reports acceptance from the actual addressed record and never claims clinician allocation", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: "Create referral" }));
    openReferral(screen.getByTestId("referral-id").textContent!);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Accept referral" }));
    expect(screen.getByTestId("community-acceptance-result")).toHaveTextContent(`accepted for ${TEAM_NAME} follow-up`);
    expect(screen.getByTestId("community-acceptance-result")).toHaveTextContent("No clinician assignment was recorded");
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Accept referral" })).toBeDisabled();
  });

  it("opens the actual triage record for Review and accurately describes row contacts", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: "Create referral" }));
    fireEvent.click(screen.getByRole("button", { name: "Log team contact" }));
    expect(document.getElementById("actionToastMsg")).toHaveTextContent("does not record patient or referral contact");
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    const referralId = screen.getByTestId("referral-id").textContent!;
    expect(screen.getByRole("dialog", { name: /^Referral Triage: / })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: new RegExp(referralId) })).toBeNull();
  });

  it("offers no dossier editor while it is not connected, and discloses unavailable follow-up", () => {
    start();
    openPatient(seed.patients[0]!.id);
    expect(screen.queryByRole("button", { name: "Edit dossier" })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("digital audit signature");
    fireEvent.click(screen.getByRole("button", { name: "Arrange follow-up" }));
    expect(screen.getByTestId("community-patient-care")).toHaveTextContent("No matching admission is available");
  });

  it("records a real scoped appointment through the shared care editor", () => {
    const admission = seed.admissions.find(
      (a) =>
        a.patientId &&
        a.state === "occupied" &&
        COMMUNITY_TEAM_PAGES.some((t) => admissionBelongsToTeam(a, t, seed.referrals)),
    )!;
    expect(admission).toBeDefined();
    const team = COMMUNITY_TEAM_PAGES.find((t) => admissionBelongsToTeam(admission, t, seed.referrals))!;
    start({ teamId: team.id });
    openPatient(admission.patientId!);
    const before = Number(screen.getByTestId("recorded-appointments").textContent);
    fireEvent.click(screen.getByRole("button", { name: "Arrange follow-up" }));
    const care = screen.getByRole("region", { name: "Care journey" });
    fireEvent.change(within(care).getByRole("combobox", { name: "Responsible clinician" }), {
      target: { value: "demo-adult-clinician" },
    });
    fireEvent.change(within(care).getByLabelText("Appointment date and time"), {
      target: { value: screen.getByTestId("appointment-at").textContent },
    });
    fireEvent.change(within(care).getByRole("combobox", { name: "Appointment mode" }), {
      target: { value: "telephone" },
    });
    fireEvent.click(within(care).getByRole("button", { name: "Record appointment" }));
    expect(screen.getByTestId("recorded-appointments")).toHaveTextContent(String(before + 1));
    expect(care).toHaveTextContent("Dr Alex Taylor");
    expect(care).toHaveTextContent("Community service");
    fireEvent.change(within(care).getByRole("combobox", { name: "Contact outcome" }), {
      target: { value: "completed" },
    });
    fireEvent.change(within(care).getByLabelText("Contact date and time"), {
      target: { value: screen.getByTestId("appointment-at").textContent },
    });
    fireEvent.click(within(care).getByRole("button", { name: "Record contact outcome" }));
    expect(care).toHaveTextContent("completed · appointment 1");
    fireEvent.click(screen.getByRole("button", { name: "Close drawer" }));
    openPatient(admission.patientId!);
    expect(screen.getByRole("region", { name: "Care journey" })).toHaveTextContent("completed · appointment 1");
  });
});

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/ward-flow/people/PT-005",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ReplyBoardList } from "@/components/ward-management/alerts/global-alert-panels";
import type { BroadcastAlert } from "@/components/ward-management/alerts/ward-broadcast-model";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { EdAdmissionChecklist } from "@/components/ward-management/ed/ed-admission-checklist";
import { HandoverSignOffPanel } from "@/components/ward-management/handover/handover-panels";
import { ExtendSheet } from "@/components/ward-management/legal-forms/legal-forms-sheets";
import { OnCallScreen } from "@/components/ward-management/on-call/on-call-screen";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { StatisticsRange } from "@/components/ward-management/statistics/statistics-hero-tools";
import { showsUnwiredPreviews, UnwiredPreview } from "@/components/ward-management/unwired-previews";
import { WardDecisionsCockpit } from "@/components/ward-management/ward/ward-decisions-cockpit";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState, seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowClockContext, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import { communityScopedReferrals } from "@/components/ward-management/ward-referral-visibility";
import { WardAskForAccess } from "@/components/ward-management/ward-shared-role-gate";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";

/**
 * Overall review, 20 Oct 2026 (Josh accepted): "hide every not-wired button in the pilot build, so
 * nothing on screen pretends to work." A control or note that only says "Not wired in this
 * prototype." shows in a local development build and is absent from demo and production builds.
 *
 * Each case renders the same screen twice: once as a production build (`NEXT_PUBLIC_WARD_ENVIRONMENT`
 * set to production) and once as a local development build, so a passing "absent" is never the
 * screen failing to render the control at all.
 */

type Build = "production" | "demo" | "development";

function asBuild(build: Build) {
  vi.stubEnv("NEXT_PUBLIC_WARD_ENVIRONMENT", build);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

const writeText = vi.fn<(text: string) => Promise<void>>();
beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

describe("showsUnwiredPreviews", () => {
  it("is true only for a local development build", () => {
    expect(showsUnwiredPreviews("development")).toBe(true);
    expect(showsUnwiredPreviews("demo")).toBe(false);
    expect(showsUnwiredPreviews("production")).toBe(false);
  });

  it.each([
    ["production", false],
    ["demo", false],
    ["development", true],
  ] as const)("reads the build environment (%s)", (build, shown) => {
    asBuild(build);
    expect(showsUnwiredPreviews()).toBe(shown);
    render(<UnwiredPreview>Preview control</UnwiredPreview>);
    expect(screen.queryByText("Preview control") !== null).toBe(shown);
  });

  it("hides them from a deployed build that names no environment", () => {
    vi.stubEnv("NEXT_PUBLIC_WARD_ENVIRONMENT", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(showsUnwiredPreviews()).toBe(false);
  });
});

const BUILDS = [
  ["production", false],
  ["development", true],
] as const;

describe.each(BUILDS)("a %s build", (build, shown) => {
  beforeEach(() => asBuild(build));

  it(`${shown ? "shows" : "hides"} On-call's copy-only Call button and its not-wired footnote`, () => {
    render(
      <WardFlowClockContext.Provider value={NOW_ANCHOR}>
        <OnCallScreen />
      </WardFlowClockContext.Provider>,
    );
    const panel = within(screen.getByTestId("ward-on-call-role-panel"));
    expect(panel.queryAllByRole("button", { name: /^Call 08 0000/u }).length > 0).toBe(shown);
    // The number can still be copied.
    expect(panel.getAllByRole("button", { name: /^Copy .*number$/u }).length).toBeGreaterThan(0);
    expect(screen.getByTestId("ward-on-call-governance").textContent?.includes("Calling and email are not wired")).toBe(
      shown,
    );
  });

  it(`${shown ? "shows" : "hides"} the Tasks drawer's copy-only Call buttons`, () => {
    const seed = seedWardFlowState();
    const items = buildActionInbox(seed.movements.filter(isOpen), NOW_ANCHOR, seed.units);
    render(
      <WardTasksDrawer
        alertsScreenOpen={false}
        items={items}
        acknowledgements={{}}
        completions={{}}
        role="coordinator"
        now={NOW_ANCHOR}
        dispatch={vi.fn()}
        onClose={vi.fn()}
        onSelectMovement={vi.fn()}
        records={seed}
      />,
    );
    const drawer = screen.getByRole("complementary", { name: "Tasks" });
    const item = items.find((entry) => entry.title === "Multiple destinations declined")!;
    const card = within(within(drawer).getByTestId(`ward-task-${item.id}`).closest("li")!);
    fireEvent.click(card.getByRole("button", { name: "Contact" }));
    const contacts = within(card.getByTestId(`ward-task-contacts-${item.id}`));
    expect(contacts.getAllByText(/^08 0000 \d{4}$/u).length).toBeGreaterThan(0);
    expect(contacts.queryAllByRole("button", { name: /^Call .*, 08 0000 \d{4}$/u }).length > 0).toBe(shown);
  });

  it(`${shown ? "shows" : "hides"} the alert reply board's Chase button`, () => {
    const units = allUnits().slice(0, 3);
    const alert: BroadcastAlert = {
      id: "BC-TEST-1",
      kind: "bed_call",
      title: "Bed call test",
      message: "Need one acute bed",
      severity: "warning",
      category: "capacity_gridlock",
      targetScope: "all",
      targetScopeLabel: "All units",
      dispatchedAt: NOW_ANCHOR - 10,
      expiresAt: NOW_ANCHOR + 50,
      durationMinutes: 60,
      status: "active",
      dispatchedByRole: "coordinator",
      dispatchedByName: "State Flow Coordinator",
      acknowledgedUnits: [],
      replies: [{ unitId: units[0]!.id, answer: "can_take", at: NOW_ANCHOR - 5, role: "ward" }],
    };
    render(<ReplyBoardList alert={alert} units={units} now={NOW_ANCHOR} />);
    expect(screen.getByRole("region", { name: "Replies" })).toHaveTextContent("1 of 3 answered");
    expect(screen.queryByRole("button", { name: /Chase/u }) !== null).toBe(shown);
  });

  it(`${shown ? "shows" : "hides"} the handover sign-off's Handing to preview`, () => {
    render(
      <HandoverSignOffPanel
        title="Sign off this shift"
        subtitle="Flow coordinator"
        checks={[{ id: "one", done: true, text: "Every move has a next step" }]}
        signedAt={null}
        now={NOW_ANCHOR}
        canSignOff
        onSignOff={vi.fn()}
        onUndoSignOff={vi.fn()}
      />,
    );
    const panel = screen.getByTestId("ward-handover-sign-off");
    expect(panel).toHaveTextContent("Handed over by");
    expect(within(panel).queryByText(/^Handing to/u) !== null).toBe(shown);
    expect(panel.textContent?.includes("Not wired in this prototype.")).toBe(shown);
  });

  it(`${shown ? "shows" : "hides"} the statistics history range (only Now is real)`, () => {
    render(<StatisticsRange />);
    expect(screen.queryByTestId("ward-statistics-range") !== null).toBe(shown);
  });

  it(`${shown ? "shows" : "hides"} the ED arrival checklist's not-wired checks`, () => {
    const base = seedWardFlowState().movements[0]!;
    const movement: Movement = {
      ...base,
      legalStatus: "Voluntary",
      contrabandSearchDone: undefined,
      medicationChartDone: undefined,
    };
    render(<EdAdmissionChecklist movement={movement} referrals={[]} />);
    const card = screen.getByTestId("ward-ed-admission-checklist");
    expect(card).toHaveTextContent("Medical clearance");
    expect(within(card).queryByText("Contraband search") !== null).toBe(shown);
    expect(within(card).queryByText("Medication chart") !== null).toBe(shown);
    expect(within(card).queryAllByText("Not wired").length > 0).toBe(shown);
    expect(within(card).getByRole("heading")).toHaveTextContent(/Arrival checklist, \d of 3 recorded/u);
  });

  it(`${shown ? "says" : "does not say"} "Not wired" where the server takes no access requests`, () => {
    render(<WardAskForAccess canRequest={false} api={null} onRetry={vi.fn()} onSignOut={vi.fn()} />);
    expect(screen.getByText(/Ask your access admin directly\.$/u)).toBeInTheDocument();
    expect(screen.queryByText(/Not wired in this prototype/u) !== null).toBe(shown);
  });

  it(`${shown ? "shows" : "hides"} the decisions cockpit's not-wired lines and illustrative fallback`, () => {
    const unit = { id: "rph-adult-secure", name: "Ward 2K (Adult Acute)", beds: 24 } as unknown as Unit;
    const { unmount } = render(<WardDecisionsCockpit unit={unit} demonstration rollupOverdue />);
    expect(screen.getByTestId("ward-morning-rollup-overdue-banner")).toBeInTheDocument();
    expect(screen.queryAllByText("Not wired in this prototype.").length > 0).toBe(shown);
    unmount();
    render(<WardDecisionsCockpit unit={unit} />);
    expect(screen.queryByText(/This illustrative cockpit does not record/u) !== null).toBe(shown);
  });

  it(`${shown ? "shows" : "hides"} the patient record's Family and carers preview`, () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen patientId="PT-005" />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("tab", { name: /^Community/u }));
    const community = within(document.getElementById("pnpane-community")!);
    expect(community.getByRole("heading", { name: "Care team" })).toBeVisible();
    expect(community.queryByRole("heading", { name: "Family and carers" }) !== null).toBe(shown);
  });

  it(`${shown ? "shows" : "hides"} community clinician assignment, and always offers Assign to the team's desk`, () => {
    const teamName = "Mead Centre (Armadale)";
    const seed = seedWardFlowState();
    const referral = {
      ...seed.referrals[0]!,
      id: "unwired-test",
      history: undefined,
      destinations: [{ destination: { kind: "community_team", teamName }, state: "queued" }],
    } as unknown as Referral;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CommunityScreen teamId={communityTeamSlug(teamName)} referrals={communityScopedReferrals([referral])} />
      </WardFlowProvider>,
    );
    // Fix plan item 4 (21 Oct 2026): Assign is wired (the team takes the referral for its desk), so
    // it shows in every build. Assigning a clinician is still not built.
    expect(screen.queryAllByRole("button", { name: "Assign" }).length).toBeGreaterThan(0);
    act(() => (window as unknown as { openReferralDrawer(id: string): void }).openReferralDrawer("unwired-test"));
    const dossier = screen.getByRole("dialog", { name: /^Referral Triage: / });
    expect(dossier).toHaveTextContent("It does not assign a clinician or confirm an appointment.");
    expect(dossier.textContent?.includes("Clinician assignment: Not wired in this prototype.")).toBe(shown);
  });

  it(`${shown ? "shows" : "hides"} the discharge transport paging buttons`, () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard />
      </WardFlowProvider>,
    );
    const worklist = screen.getByRole("region", { name: "Discharge worklist" });
    fireEvent.click(within(worklist).getAllByRole("button")[0]!);
    expect(screen.getByRole("tablist", { name: "Discharge inspection sections" })).toBeInTheDocument();
    const paging = screen.queryAllByText(/^(Page transport|Page dispatch desk|Dispatch transport|Expedite)$/u);
    expect(paging.length > 0).toBe(shown);
  });

  it(`${shown ? "says" : "does not say"} owner notification is not wired when extending a legal form`, () => {
    const target = seedWardFlowStateAt(0).movements.find((m) => !m.closure && m.legalForm?.dueAt !== undefined)!;
    render(
      <WardFlowProvider initialNow={1242}>
        <ExtendSheet target={target} label="Synthetic record" now={1242} onClose={vi.fn()} onExtendForm={() => true} />
      </WardFlowProvider>,
    );
    const sheet = screen.getByTestId("ward-legal-extend");
    expect(sheet).toHaveTextContent(`Tell ${target.owner} separately.`);
    expect(sheet.textContent?.includes("not wired in this prototype")).toBe(shown);
  });
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/mockups/ward-flow",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { HospitalCapacityMatrix } from "@/components/ward-management/statistics/hospital-capacity-matrix";
import { StatisticsCompareScreen } from "@/components/ward-management/statistics/statistics-compare-screen";
import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { StatisticsServiceScreen } from "@/components/ward-management/statistics/statistics-service-screen";
import { StatisticsCommunityScreen } from "@/components/ward-management/statistics/statistics-community-screen";
import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { OnCallScreen } from "@/components/ward-management/on-call/on-call-screen";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { communityStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import {
  WardFlowContext,
  WardFlowProvider,
  useWardFlow,
  type WardFlowContextValue,
} from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Unit } from "@/components/ward-management/ward-model";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { selectDischargeRecords } from "@/components/ward-management/ward-discharge-records";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { referralCandidates } from "@/components/ward-management/ward-referrals";
import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";

function Override({ children, value }: { children: ReactNode; value: Partial<WardFlowContextValue> }) {
  const flow = useWardFlow();
  return <WardFlowContext.Provider value={{ ...flow, ...value }}>{children}</WardFlowContext.Provider>;
}
function renderFlow(children: ReactNode, value: Partial<WardFlowContextValue> = {}) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Override value={value}>{children}</Override>
    </WardFlowProvider>,
  );
}
const baseUnit = allUnits()[0];
const seed = seedWardFlowStateAt(NOW_ANCHOR);
function admission(id: string, state: Admission["state"], arrivedAt: number | null): Admission {
  return {
    ...seed.admissions[0],
    id,
    unitId: baseUnit.id,
    state,
    arrivedAt,
    expectedDischargeAt: null,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    blockReason: null,
  };
}

beforeEach(() => {
  push.mockClear();
  localStorage.clear();
});

describe("PR15 recorded facts and unavailable data", () => {
  it("never advertises intake for held-only or zero-bed wards and retains capacity arithmetic", () => {
    const units: Unit[] = [
      {
        ...baseUnit,
        id: "held",
        name: "Held-only ward with a longer recorded name",
        beds: 13,
        empty: { ...baseUnit.empty, value: 3 },
        allocatable: { ...baseUnit.allocatable, value: 0 },
      },
      {
        ...baseUnit,
        id: "zero",
        name: "Zero-bed ward",
        beds: 0,
        empty: { ...baseUnit.empty, value: 0 },
        allocatable: { ...baseUnit.allocatable, value: 0 },
      },
      {
        ...baseUnit,
        id: "ready",
        name: "Available ward",
        beds: 10,
        empty: { ...baseUnit.empty, value: 4 },
        allocatable: { ...baseUnit.allocatable, value: 2 },
      },
    ];
    render(<HospitalCapacityMatrix units={units} bedReleases={[]} />);
    const held = screen.getByText(units[0].name).closest("tr")!;
    expect(within(held).getByText("No ready beds")).toBeTruthy();
    expect(
      within(held)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toContain("3");
    expect(within(screen.getByText("Zero-bed ward").closest("tr")!).getByText("No ready beds")).toBeTruthy();
    expect(within(screen.getByText("Available ward").closest("tr")!).getByText("Ready beds recorded")).toBeTruthy();
    expect(screen.queryByText("Open Intake")).toBeNull();
  });

  it("keeps bed and movement counts separate without assuming compatible placement", () => {
    const available = {
      ...baseUnit,
      cohort: "Adult" as const,
      empty: { ...baseUnit.empty, value: 4 },
      allocatable: { ...baseUnit.allocatable, value: 4 },
    };
    const movement = {
      ...seed.movements[0],
      cohort: "Youth" as const,
      stage: "moving" as const,
      acceptedUnitId: baseUnit.id,
      closure: undefined,
    };
    const { container } = renderFlow(
      <StatisticsCompareScreen units={[available]} emergencyDepartments={[]} admissions={[]} />,
      { movements: [movement] },
    );
    // Presentation contract: operational bed and waiting panels stay visible; the retired
    // explanatory "separate counts" prose does not return.
    expect(container.textContent).not.toMatch(/Ready beds and people waiting are separate counts/);
    expect(container.textContent).not.toMatch(/This page does not match which bed suits which person/);
    expect(container.textContent).not.toMatch(/net bed buffer|Net Capacity|Demand Ratio|ED Patients/);
    expect(screen.getAllByText("Waiting for a bed")).toHaveLength(1);
    expect(container.textContent).toContain(`${available.beds} beds`);
  });

  it("renders actual admission states and minute-based stays without inventing beds", () => {
    const records = [
      admission("AD-WAIT", "waitlisted", null),
      admission("AD-PULL", "pulled", null),
      admission("AD-HOUR", "occupied", NOW_ANCHOR - 60),
      admission("AD-DAYS", "occupied", NOW_ANCHOR - 2880),
      admission("AD-GONE", "departed", NOW_ANCHOR - 60),
    ];
    const { container } = renderFlow(
      <StatisticsWardScreen unitId={baseUnit.id} units={[baseUnit]} admissions={records} />,
    );
    const roster = screen
      .getByText("Recorded admission roster; numbered bed assignments are not recorded")
      .closest("table")!;
    const row = (id: string) => within(roster).getByText(new RegExp(id)).closest("tr")!;
    expect(within(row("AD-WAIT")).getByText("Waitlisted")).toBeTruthy();
    expect(within(row("AD-PULL")).getByText("Pulled")).toBeTruthy();
    expect(within(row("AD-WAIT")).getByText("Not arrived yet")).toBeTruthy();
    expect(within(row("AD-HOUR")).getByText("0 d")).toBeTruthy();
    expect(within(row("AD-DAYS")).getByText("2 d")).toBeTruthy();
    expect(within(roster).queryByText(/AD-GONE/)).toBeNull();
    expect(roster.textContent).not.toMatch(/Bed \d+|Out of Service/);
    expect(within(roster).queryByRole("button")).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter recorded admission roster" }), {
      target: { value: "AD-PULL" },
    });
    expect(within(roster).queryByText(/AD-WAIT/)).toBeNull();
    expect(within(roster).getByText(/AD-PULL/)).toBeTruthy();
    expect(container.textContent).toContain("No discharge date set");
  });

  it("explicitly reports an empty admission roster", () => {
    renderFlow(<StatisticsWardScreen unitId={baseUnit.id} units={[baseUnit]} admissions={[]} />);
    expect(screen.getByText("No current admissions recorded")).toBeTruthy();
  });

  it("retains the service history disclosure without generating demonstration trends", () => {
    renderFlow(<StatisticsServiceScreen serviceId="North Metro" />);
    // Presentation contract: absent history stays absent — no empty history panel and no drawn series.
    expect(screen.queryByTestId("ward-statistics-service-flow")).toBeNull();
    expect(screen.queryByRole("region", { name: "Sent and taken in, over the last 30 days" })).toBeNull();
    expect(screen.queryByTestId("ward-statistics-service-sent-chart")).toBeNull();
    expect(screen.queryByTestId("ward-statistics-service-taken-in-chart")).toBeNull();
    expect(screen.queryByText("Demonstration data")).toBeNull();
  });

  it("changes community team using the internal router", () => {
    renderFlow(<StatisticsCommunityScreen teamId={COMMUNITY_TEAM_PAGES[0].id} />);
    const next = COMMUNITY_TEAM_PAGES[1].id;
    fireEvent.change(screen.getByLabelText("Community Team:"), { target: { value: next } });
    expect(push).toHaveBeenCalledExactlyOnceWith(communityStatisticsHref(next));
  });

  it("names the synthetic directory without asserting live network coverage", () => {
    renderFlow(<OnCallScreen />);
    const hud = screen.getByTestId("ward-on-call-hud-island");
    expect(
      within(hud).getByRole("status", {
        name: "Synthetic status: Synthetic role directory; live coverage not verified",
      }),
    ).toBeTruthy();
    expect(hud.textContent).not.toMatch(/networks active|On Standby|EDs active/);
  });
});

function EventControls() {
  const { dispatch, configuration } = useWardFlow();
  return (
    <>
      <button
        onClick={() =>
          dispatch({ type: "SET_CONFIGURATION", role: "coordinator", now: NOW_ANCHOR, payload: configuration })
        }
      >
        Accepted event
      </button>
      <button
        onClick={() => dispatch({ type: "SET_CONFIGURATION", role: "coordinator", now: NOW_ANCHOR, payload: {} })}
      >
        Rejected event
      </button>
      <button onClick={() => dispatch({ type: "RESET_SCENARIO", role: "demo", now: NOW_ANCHOR })}>Reset session</button>
    </>
  );
}
it("counts accepted and rejected session events rather than rejections alone", () => {
  renderFlow(
    <>
      <SettingsScreen />
      <EventControls />
    </>,
  );
  const count = () =>
    screen.getByText("Events recorded this session").parentElement!.querySelector("strong")!.textContent;
  expect(count()).toBe("0");
  fireEvent.click(screen.getByRole("button", { name: "Accepted event" }));
  expect(count()).toBe("1");
  fireEvent.click(screen.getByRole("button", { name: "Rejected event" }));
  expect(count()).toBe("2");
  fireEvent.click(screen.getByRole("button", { name: "Reset session" }));
  expect(count()).toBe("1");
});

describe("PR15 discharge and referral provenance", () => {
  it("does not infer clinical completion or carrier booking from an expected discharge date", () => {
    const read = selectDischargeRecords(seed, { role: "coordinator" });
    if (read.status !== "allowed" || read.value.length === 0) throw new Error("No seeded discharge record");
    const record = {
      ...read.value[0],
      expectedDischargeAt: NOW_ANCHOR + 60,
      dischargeDateSetAt: NOW_ANCHOR,
      dischargeDateSetBy: "Ward manager" as const,
      dischargeConfirmedAt: null,
      dischargeConfirmedBy: null,
      leftAt: null,
      blockReason: null,
    };
    renderFlow(<DischargeBoard />, {
      bedReleases: [],
      readDischargeRecords: () => ({ status: "allowed", value: [record] }),
      readDischargeRecord: () => ({ status: "allowed", value: record }),
    });
    fireEvent.click(screen.getByRole("button", { name: /^Admission records/ }));
    const worklist = screen.getByRole("region", { name: "Discharge worklist" });
    fireEvent.click(
      within(worklist)
        .getAllByRole("row")
        .flatMap((row) => within(row).queryAllByRole("button"))[0],
    );
    const detail = screen.getByRole("region", { name: "Selected discharge details" });
    expect(detail.textContent).toContain("Recorded discharge milestones");
    expect(detail.textContent).toContain("Expected discharge date");
    expect(detail.textContent).toContain("Discharge confirmation");
    expect(detail.textContent).toContain("No discharge blocker recorded");
    expect(detail.textContent).not.toMatch(
      /Medical Summary Signed|TTO Dispensed|Clinical Pharmacist|Dr\. C\. Vance|Carrier Booked|Dispatch ready|Environmental Services Turnover/,
    );
    fireEvent.click(within(detail).getByRole("tab", { name: "Transport" }));
    expect(detail.textContent).not.toMatch(/TRN-2026|St John|Route Planned|Community Discharge/);
    expect(detail.textContent).toContain("Not recorded");
  });

  it("uses the release stage rather than required report timestamps as completed clinical milestones", () => {
    const release = {
      ...seed.bedReleases[0],
      state: "expected" as const,
      blocker: null,
      expectedAt: NOW_ANCHOR + 60,
      confirmedAt: NOW_ANCHOR,
      preparing: true,
      preparationNote: null,
    };
    renderFlow(<DischargeBoard />, {
      bedReleases: [release],
      readDischargeRecords: () => ({ status: "allowed", value: [] }),
    });
    const worklist = screen.getByRole("region", { name: "Discharge worklist" });
    fireEvent.click(
      within(worklist)
        .getAllByRole("row")
        .flatMap((row) => within(row).queryAllByRole("button"))[0],
    );
    const detail = screen.getByRole("region", { name: "Selected discharge details" });
    expect(detail.textContent).toContain("Release stage recorded");
    expect(detail.textContent).toContain("expected");
    expect(detail.textContent).toContain("Preparation recorded: Reason not recorded");
    expect(detail.textContent).toContain("does not establish completion");
    expect(detail.textContent).not.toMatch(
      /Clinical summary document signed|Pack ready|Bed released|Medical Summary Signed|Standard Egress|Standby/,
    );
  });

  it("shows failed capacity gates and prevents unsupported turnaround and clinical override actions", () => {
    const pair = seed.referrals.flatMap((referral) => {
      const ward = referral.destinations.find((destination) => destination.destination.kind === "psychiatric_ward");
      if (!ward || ward.destination.kind !== "psychiatric_ward" || ward.state !== "queued") return [];
      return referralCandidates(referral, ward.destination, seed.units, NOW_ANCHOR)
        .filter((candidate) => candidate.verdict.eligible)
        .map((candidate) => ({ referral, unit: candidate.unit }));
    })[0];
    expect(pair, "The synthetic network must include an eligible ward candidate").toBeDefined();
    // A stale observation changes only the capacity-freshness gate. Clearing allocatable
    // capacity would also fail the security gate, which belongs in the exclusion tier.
    const unresolvedCapacity = {
      ...pair.unit,
      empty: { ...pair.unit.empty, confirmedAt: NOW_ANCHOR - 10000 },
      allocatable: { ...pair.unit.allocatable, confirmedAt: NOW_ANCHOR - 10000 },
    };
    const excluded = {
      ...unresolvedCapacity,
      id: "test-excluded-cohort",
      cohort: pair.unit.cohort === "Youth" ? ("Adult" as const) : ("Youth" as const),
    };
    const dispatch = vi.fn();
    render(
      <ReferralMatchView
        referral={pair.referral}
        units={[unresolvedCapacity, excluded]}
        now={NOW_ANCHOR}
        dispatch={dispatch}
        rejections={[]}
      />,
    );
    expect(screen.getByText("TIER 2: CAPACITY CHECKS OUTSTANDING")).toBeTruthy();
    expect(screen.getByText("Capacity unresolved")).toBeTruthy();
    expect(screen.getByText(/Recorded capacity checks:/).textContent).toContain("Capacity freshness");
    expect(document.body.textContent).not.toMatch(
      /Planned discharge today|Sanitisation buffer|NUM Bed Coordination|Units Full|Staffed Ensuite|Ext 4192/,
    );
    for (const name of ["Flag Turnaround Priority", "Clinical Override"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveAttribute("aria-disabled", "true");
      const reason = document.getElementById(button.getAttribute("aria-describedby")!)!;
      expect(reason.textContent).toContain("unavailable");
      expect(button).toHaveAttribute("title");
      fireEvent.click(button);
    }
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("keeps absent referring practitioner and service contact details explicit", () => {
    const referral = seed.referrals.find((item) =>
      item.destinations.some((destination) => destination.state === "queued"),
    )!;
    renderFlow(<ReferralBoard />, { referrals: [referral] });
    fireEvent.click(screen.getByTestId(`ward-referral-board-select-${referral.id}`));
    fireEvent.click(screen.getByRole("tab", { name: "Clinical Dossier & Referrer Letter" }));
    const detail = screen.getByRole("region", { name: "Selected referral detail" });
    expect(detail.textContent).toContain("Direct contact: Not recorded");
    expect(detail.textContent).toContain("Referral raised:");
    expect(detail.textContent).not.toMatch(/Dr\. M\. Lawson|9956 2200|Electronic Triage Receipt/);
  });

  it("labels entered form due times without asserting a verified statutory limit", () => {
    const movement = seed.movements.find((item) => item.legalForm?.dueAt !== undefined && !item.closure)!;
    expect(movement).toBeDefined();
    renderFlow(<LegalFormsScreen />, {
      movements: [{ ...movement, legalForm: { ...movement.legalForm!, dueAt: NOW_ANCHOR - 1 } }],
    });
    const hud = screen.getByTestId("ward-legal-hud-island");
    expect(within(hud).getByRole("status", { name: "Synthetic status: 1 recorded due times passed" })).toBeTruthy();
    expect(hud.textContent).toContain("Recorded legal form due times");
    expect(hud.textContent).not.toContain("statutory deadline");
  });
});

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import type { WardFlowKey } from "@/components/ward-management/ward-flow-provider";
import { afterEach, describe, expect, it, vi } from "vitest";

const guard = vi.hoisted(() => ({ forbid: true, push: vi.fn() }));
vi.mock("@/components/ward-management/ward-flow-provider", async (original) => {
  const actual = await original<typeof import("@/components/ward-management/ward-flow-provider")>();
  return {
    ...actual,
    useWardFlow: (...args: Parameters<typeof actual.useWardFlow>) => {
      if (guard.forbid) throw new Error("Executive ED read operational rows");
      return actual.useWardFlow(...args);
    },
    useWardFlowClock: (...args: Parameters<typeof actual.useWardFlowClock>) => {
      if (guard.forbid) throw new Error("Executive ED read operational clock");
      return actual.useWardFlowClock(...args);
    },
    useWardFlowSelect: (...args: readonly WardFlowKey[]) => {
      if (guard.forbid) throw new Error("Executive ED selected operational rows");
      return actual.useWardFlowSelect(...args);
    },
  };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: guard.push }),
  usePathname: () => "/ward-flow/statistics/ed",
}));
vi.mock("@/components/ward-management/statistics/statistics-csv", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/statistics/statistics-csv")>()),
  downloadCsv: vi.fn(),
}));
vi.mock("@/components/ward-management/statistics/statistics-ed-swarm", () => ({
  StatisticsEdSwarm: () => {
    if (guard.forbid) throw new Error("Executive ED drew individual marks");
    return null;
  },
}));
vi.mock("@/components/ward-management/shell/ward-access-context", async (original) => {
  const actual = await original<typeof import("@/components/ward-management/shell/ward-access-context")>();
  return {
    ...actual,
    useUnscopedWardFlow: () => {
      if (guard.forbid) throw new Error("Executive ED read unscoped rows");
      return actual.useUnscopedWardFlow();
    },
  };
});

import { StatisticsEdScreen } from "@/components/ward-management/statistics/statistics-ed-screen";
import { ExecutiveStatisticsProvider } from "@/components/ward-management/statistics/executive-statistics-context";
import { projectExecutiveReportingFoundation } from "@/components/ward-management/statistics/executive-statistics-projector";
import type { ExecutiveReportingFoundation } from "@/components/ward-management/statistics/executive-statistics-contract";
import { downloadCsv } from "@/components/ward-management/statistics/statistics-csv";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { STATEWIDE_COORDINATOR } from "@/components/ward-management/ward-role-access";
import { setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { edStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { installMatchMediaStub } from "./setup/jsdom.setup";

const state = seedWardFlowState();
const report = projectExecutiveReportingFoundation(
  state,
  { role: "executive", scope: { kind: "statewide" } },
  {
    now: NOW_ANCHOR,
    dayZero: "2026-10-24T00:00:00.000Z",
    startedAt: "2026-10-24T00:00:00.000Z",
    places: wardPlaceLookup(state.units),
  },
);
const department = report.emergencyDepartments[0]!;
const binding = { actorId: "synthetic-ed-report", accessContext: "b".repeat(64), epoch: 0, revision: 8 };
const pause = vi.fn();
function wrap(children: ReactNode, data: ExecutiveReportingFoundation | null = report, now = 150) {
  return (
    <ExecutiveStatisticsProvider
      binding={binding}
      snapshot={data ? { binding, receivedAt: 100, expiresAt: 200, data } : null}
      now={now}
      controls={{ executive: true, paused: false, togglePause: pause }}
    >
      {children}
    </ExecutiveStatisticsProvider>
  );
}
/** Already released presentation fixtures; transport and integer disclosure proof have separate tests. */
function protectedReport() {
  const data = structuredClone(report);
  const current = data.emergencyDepartments[0]!;
  current.onTheList = { kind: "exact", value: 10 };
  current.stillInEd = { kind: "withheld" };
  current.inTransit = { kind: "small" };
  current.urgent = { kind: "small" };
  current.unplaced = { kind: "withheld" };
  current.over24h = { kind: "small" };
  current.longestWaitMinutes = 1500;
  current.medianWaitMinutes = null;
  current.declines.noFreeBed = { kind: "small" };
  current.declines.notSuitable = null;
  current.bands.forEach((band, index) => {
    band.count = index === 0 ? { kind: "small" } : { kind: "withheld" };
  });
  return data;
}
afterEach(() => {
  cleanup();
  guard.forbid = true;
  setWardAccess(STATEWIDE_COORDINATOR);
  setWardFeatureFlagOnDevice("role-access", null);
  vi.clearAllMocks();
});

describe("ED detail consumes released executive figures", () => {
  it("fails closed for missing, expired and actual executive-without-provider data before row hooks", () => {
    const view = render(wrap(<StatisticsEdScreen edId={department.id} />, null));
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
    view.rerender(wrap(<StatisticsEdScreen edId={department.id} />, report, 201));
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "executive", scope: { kind: "statewide" } });
    view.rerender(<StatisticsEdScreen edId={department.id} movements={state.movements} />);
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
  });

  it("gives unknown and known outside-scope EDs the same generic unavailable response", () => {
    const data = structuredClone(report);
    data.openableEmergencyDepartmentIds = data.openableEmergencyDepartmentIds.filter((id) => id !== department.id);
    const view = render(wrap(<StatisticsEdScreen edId={department.id} />, data));
    const outside = screen.getByTestId("ward-statistics-unavailable").textContent;
    expect(screen.queryByTestId("ward-stat-ed-on-the-list")).not.toBeInTheDocument();
    view.rerender(wrap(<StatisticsEdScreen edId="unknown-synthetic-ed" />, data));
    expect(screen.getByTestId("ward-statistics-unavailable")).toHaveTextContent(outside!);
    expect(screen.queryByText(department.name)).not.toBeInTheDocument();
  });

  it("retains public detail, pause, export, comparison and neutral bands without individual rows", () => {
    installMatchMediaStub(false);
    const data = protectedReport();
    render(wrap(<StatisticsEdScreen edId={department.id} movements={state.movements} />, data));
    expect(screen.getByRole("heading", { name: department.name })).toBeInTheDocument();
    expect(screen.getByTestId("ward-statistics-ed-population")).toHaveTextContent(
      "not shown still in ED · fewer than 5 in transit",
    );
    expect(screen.getByTestId("ward-statistics-ed-wait-not-listed")).toBeInTheDocument();
    expect(screen.getByTestId("ward-statistics-ed-next-not-listed")).toBeInTheDocument();
    expect(screen.getByTestId("ward-statistics-ed-everyone-not-listed")).toBeInTheDocument();
    expect(screen.getByTestId("ward-stat-ed-declined-not-suitable-unavailable")).toHaveTextContent("unknown");
    expect(screen.getByTestId("ward-statistics-ed-declines")).toHaveTextContent("Declined, otherunknown");
    expect(screen.queryByTestId("ward-stat-ed-declined-not-suitable")).not.toBeInTheDocument();
    const bands = screen.getByTestId("ward-statistics-ed-bands");
    expect(bands).toHaveTextContent("fewer than 5");
    expect(bands).toHaveTextContent("not shown");
    expect(bands.querySelectorAll('[style*="height: 0px"]')).toHaveLength(data.emergencyDepartments[0]!.bands.length);
    expect(screen.getByTestId("ward-stat-ed-comparison")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /pause demo updates/i }));
    expect(pause).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId("ward-statistics-export"));
    const lines = vi.mocked(downloadCsv).mock.calls.at(-1)![1];
    expect(lines).toContainEqual(["Open ED journeys", 10]);
    expect(lines).toContainEqual(["Still in ED", "not shown"]);
    expect(lines).toContainEqual(["In transit or recorded departure", "fewer than 5"]);
    expect(lines).toContainEqual(["Longest wait", "1d 1h"]);
    expect(lines).toContainEqual(["Median wait", "none"]);
    expect(document.querySelector('a[href*="/movements/"]')).toBeNull();
    expect(screen.getByTestId("ward-statistics-ed-invented")).toBeInTheDocument();
  });

  it("keeps foreign origin groups as plain comparison text and out of the chooser and stepper", () => {
    installMatchMediaStub(false);
    const data = structuredClone(report);
    data.openableEmergencyDepartmentIds = data.emergencyDepartments
      .filter((item) => item.service === department.service)
      .map((item) => item.id);
    const foreign = data.emergencyDepartments.find((item) => item.service !== department.service)!;
    expect(foreign).toBeDefined();
    render(wrap(<StatisticsEdScreen edId={department.id} />, data));
    const row = screen.getByTestId(`ward-stat-ed-comparison-row-${foreign.id}`);
    expect(row).toHaveTextContent(foreign.name);
    expect(within(row).queryByRole("link")).not.toBeInTheDocument();
    expect(document.querySelector(`a[href="${edStatisticsHref(foreign.id)}"]`)).toBeNull();
    if (data.openableEmergencyDepartmentIds.length > 1) {
      fireEvent.click(screen.getByRole("button", { name: "Change ED" }));
      expect(screen.queryByRole("menuitem", { name: foreign.name })).not.toBeInTheDocument();
    } else {
      expect(screen.queryByRole("button", { name: "Change ED" })).not.toBeInTheDocument();
    }
  });

  it("retains the ED chooser and wrapping stepper over the currently openable departments", () => {
    installMatchMediaStub(false);
    render(wrap(<StatisticsEdScreen edId={department.id} />));
    const next = report.emergencyDepartments[1]!;
    const previous = report.emergencyDepartments.at(-1)!;
    expect(screen.getByRole("link", { name: `Previous ED: ${previous.name}` })).toHaveAttribute(
      "href",
      edStatisticsHref(previous.id),
    );
    expect(screen.getByRole("link", { name: `Next ED: ${next.name}` })).toHaveAttribute(
      "href",
      edStatisticsHref(next.id),
    );
    expect(screen.getByTestId("ward-statistics-ed-all-eds")).toHaveTextContent("All EDs");
    expect(screen.getByTestId("ward-statistics-ed-compare")).toHaveTextContent("Compare");
    fireEvent.click(screen.getByRole("button", { name: "Change ED" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: new RegExp(department.name) })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    fireEvent.click(within(menu).getByRole("menuitem", { name: new RegExp(next.name) }));
    expect(guard.push).toHaveBeenCalledExactlyOnceWith(edStatisticsHref(next.id));
  });

  it("retains the phone counts-only note and hero using only aggregate inputs", () => {
    installMatchMediaStub(true);
    render(wrap(<StatisticsEdScreen edId={department.id} />, protectedReport()));
    expect(screen.getByTestId("ward-statistics-ed-phone-not-listed")).toBeInTheDocument();
    expect(screen.getByTestId("ward-stat-ed-on-the-list")).toHaveTextContent("10");
    expect(screen.queryByTestId("ward-statistics-ed-everyone")).not.toBeInTheDocument();
  });

  it("keeps an incoherent ordinary decline subtotal unknown, without clamping it to zero", () => {
    installMatchMediaStub(false);
    guard.forbid = false;
    const template = structuredClone(state.movements[0]!);
    const movement = {
      ...template,
      originEdId: department.id,
      waitlistedUnitIds: [state.units[0]!.id],
      referralAnswerHistory: [{ unitId: state.units[0]!.id, at: NOW_ANCHOR - 1, answer: "waitlisted" as const }],
      declines: [{ unitId: state.units[0]!.id, at: NOW_ANCHOR - 1, reason: "no_suitable_bed" as const }],
    };
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsEdScreen edId={department.id} movements={[movement]} />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-stat-ed-declined-not-suitable-unavailable")).toHaveTextContent("unknown");
    expect(screen.queryByTestId("ward-stat-ed-declined-not-suitable")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-stat-ed-declined-no-free-bed")).toHaveTextContent("1");
  });
});

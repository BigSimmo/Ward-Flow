import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const guard = vi.hoisted(() => ({
  forbid: true,
  seed: vi.fn(),
  read: vi.fn(),
  poll: vi.fn(),
  path: "/ward-flow/statistics",
}));
vi.mock("next/navigation", () => ({
  usePathname: () => guard.path,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("../src/components/ward-management/ward-flow-reducer", async (original) => {
  const actual = await original<typeof import("../src/components/ward-management/ward-flow-reducer")>();
  return {
    ...actual,
    seedWardFlowStateAt: (...args: Parameters<typeof actual.seedWardFlowStateAt>) => {
      guard.seed();
      if (guard.forbid) throw new Error("Authenticated host seeded an operational world");
      return actual.seedWardFlowStateAt(...args);
    },
  };
});
vi.mock("../src/components/ward-management/ward-flow-provider", async (original) => {
  const actual = await original<typeof import("../src/components/ward-management/ward-flow-provider")>();
  return {
    ...actual,
    useWardFlow: () => {
      guard.read();
      if (guard.forbid) throw new Error("Executive host read operational context");
      return actual.useWardFlow();
    },
  };
});
vi.mock("../src/components/ward-management/ward-shared-access", async (original) => ({
  ...(await original<typeof import("../src/components/ward-management/ward-shared-access")>()),
  useWardShared: (enabled: boolean) => guard.poll(enabled),
}));
import type { WardSharedConnection } from "../src/components/ward-management/ward-shared-access";
import type { ExecutiveAggregateSnapshot } from "../src/components/ward-management/ward-shared-client";
import { WardAuthorisedExecutivePreview } from "../src/components/ward-management/shell/ward-chrome-frame";
import * as projector from "../src/components/ward-management/statistics/executive-statistics-projector";
import { WardWorkspaceHost } from "../src/components/ward-management/shell/ward-workspace-host";
import {
  useEffectiveWardAccess,
  resetWardAccessStoreForTests,
} from "../src/components/ward-management/shell/ward-access-store";
import {
  WardAccessGate,
  WardPrintAttribution,
  useCanOpenHref,
} from "../src/components/ward-management/shell/ward-access";
import { useWardFlow } from "../src/components/ward-management/ward-flow-provider";
import {
  useExecutiveStatistics,
  useExecutiveStatisticsControl,
} from "../src/components/ward-management/statistics/executive-statistics-context";
import { projectExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-projector";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
const deviceNow = Date.parse("2026-10-27T08:00:00Z");
const source = seedWardFlowState();
let aggregate: ExecutiveAggregateSnapshot;
beforeAll(() => {
  aggregate = {
    kind: "executive-aggregate",
    dataMode: "prototype",
    actorId: "synthetic-host-actor",
    revision: 1,
    accessContext: "a".repeat(64),
    accessUntil: deviceNow + 60_000,
    now: NOW_ANCHOR,
    demoControls: false,
    report: projectExecutiveReportingFoundation(
      source,
      { role: "executive", scope: { kind: "statewide" } },
      {
        now: NOW_ANCHOR,
        dayZero: "2026-10-26T16:00:00.000Z",
        startedAt: "2026-10-27T02:42:00.000Z",
        places: wardPlaceLookup(source.units),
      },
    ),
  };
}, 20_000);
function connection(overrides: Partial<WardSharedConnection> = {}): WardSharedConnection {
  return {
    enabled: true,
    signedIn: true,
    status: "ready",
    error: null,
    snapshot: null,
    executiveSnapshot: structuredClone(aggregate),
    viewEpoch: 1,
    receivedAt: deviceNow - 100,
    access: { role: "executive", scope: { kind: "statewide" } },
    actorId: aggregate.actorId,
    workingAs: "synthetic-executive-role",
    accessUntil: aggregate.accessUntil,
    sessionEndsAt: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    retry: vi.fn(),
    dispatch: vi.fn(),
    switchRole: vi.fn(),
    pushApi: {
      pushKey: async () => ({ enabled: false }),
      pushStatus: async () => false,
      pushSubscribe: async () => "role",
      pushUnsubscribe: async () => false,
    },
    ...overrides,
  };
}
function ReportProbe() {
  const report = useExecutiveStatistics(),
    controls = useExecutiveStatisticsControl(),
    access = useEffectiveWardAccess(),
    canOpen = useCanOpenHref();
  return (
    <>
      <span data-testid="report">{report?.network.asAt.now ?? "none"}</span>
      <span data-testid="role">{access.role}</span>
      <span data-testid="permission">{String(canOpen("/ward-flow/movements"))}</span>
      <WardPrintAttribution />
      {controls.togglePause ? (
        <button onClick={controls.togglePause}>{controls.paused ? "Resume" : "Pause"}</button>
      ) : null}
    </>
  );
}
function WorldProbe() {
  const value = useWardFlow();
  return <span data-testid="world">{value.patients.map((person) => person.id).join(",")}</span>;
}
function host(value: WardSharedConnection, body = <ReportProbe />) {
  return (
    <WardWorkspaceHost connection={value} executiveChildren={body}>
      <WorldProbe />
    </WardWorkspaceHost>
  );
}
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(deviceNow);
  guard.forbid = true;
  guard.path = "/ward-flow/statistics";
  guard.seed.mockClear();
  guard.read.mockClear();
  guard.poll.mockReset();
  resetWardAccessStoreForTests();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe("workspace host actual authority before operational construction", () => {
  it("uses only the aggregate for an actual executive even when the local feature flag is off", () => {
    render(host(connection()));
    expect(screen.getByTestId("report")).toHaveTextContent(String(NOW_ANCHOR));
    expect(screen.getByTestId("role")).toHaveTextContent("executive");
    expect(screen.getByTestId("permission")).toHaveTextContent("false");
    expect(screen.getByTestId("ward-print-attribution")).toHaveTextContent("Printed by Executive, Statewide");
    expect(guard.seed).not.toHaveBeenCalled();
    expect(guard.read).not.toHaveBeenCalled();
    expect(guard.poll).not.toHaveBeenCalled();
  });
  it("acquires only one shared connection above the world branch", () => {
    guard.poll.mockReturnValue(connection());
    render(
      <WardWorkspaceHost executiveChildren={<ReportProbe />}>
        <WorldProbe />
      </WardWorkspaceHost>,
    );
    expect(guard.poll).toHaveBeenCalledTimes(1);
    expect(guard.seed).not.toHaveBeenCalled();
  });
  it("does not use an operational payload as an executive report", () => {
    const value = connection({
      executiveSnapshot: null,
      snapshot: {
        dataMode: "prototype",
        revision: 1,
        now: NOW_ANCHOR,
        payload: { version: 1, state: source, dayZero: "2026-10-26T16:00:00Z", startedAt: "2026-10-27T02:42:00Z" },
      },
    });
    render(host(value));
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
    expect(guard.seed).not.toHaveBeenCalled();
    expect(guard.read).not.toHaveBeenCalled();
  });
  it("shows the existing opening gate while shared access is loading, without seeding", () => {
    render(host(connection({ status: "loading", access: undefined, executiveSnapshot: null, snapshot: null })));
    expect(screen.getByTestId("ward-shared-connecting")).toBeInTheDocument();
    expect(guard.seed).not.toHaveBeenCalled();
  });
  it("initialises an ordinary authenticated world from the scoped snapshot synchronously", () => {
    guard.forbid = false;
    const scoped = { ...source, patients: source.patients.slice(0, 1) };
    const value = connection({
      access: { role: "coordinator", scope: { kind: "statewide" } },
      executiveSnapshot: null,
      snapshot: {
        dataMode: "prototype",
        revision: 3,
        accessContext: "b".repeat(64),
        accessUntil: aggregate.accessUntil,
        now: NOW_ANCHOR,
        payload: { version: 1, state: scoped, dayZero: "2026-10-26T16:00:00Z", startedAt: "2026-10-27T02:42:00Z" },
      },
    });
    render(host(value));
    expect(screen.getByTestId("world")).toHaveTextContent(scoped.patients[0]!.id);
    expect(screen.getByTestId("world").textContent).not.toContain(source.patients[1]!.id);
    expect(guard.seed).not.toHaveBeenCalled();
  });
  it("retains explicit unconfigured local demonstration seeding", () => {
    guard.forbid = false;
    render(
      host(connection({ enabled: false, signedIn: false, access: undefined, snapshot: null, executiveSnapshot: null })),
    );
    expect(screen.getByTestId("world")).toBeInTheDocument();
    expect(guard.seed).toHaveBeenCalled();
  });
  it("holds only a genuine report revision while paused and clears it on actor replacement", () => {
    const value = connection();
    const view = render(host(value));
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    const next = connection();
    next.executiveSnapshot!.revision = 2;
    next.executiveSnapshot!.now++;
    next.executiveSnapshot!.report.network.asAt.now++;
    view.rerender(host(next));
    expect(screen.getByTestId("report")).toHaveTextContent(String(NOW_ANCHOR));
    view.rerender(host({ ...next, actorId: "synthetic-other-actor", viewEpoch: 2 }));
    expect(screen.queryByTestId("report")).toBeNull();
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
    expect(guard.seed).not.toHaveBeenCalled();
    expect(guard.read).not.toHaveBeenCalled();
  });
  it("expires without waiting for another poll", async () => {
    const value = connection({ accessUntil: deviceNow + 1000 });
    value.executiveSnapshot!.accessUntil = deviceNow + 1000;
    render(host(value));
    expect(screen.getByTestId("report")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(screen.queryByTestId("report")).toBeNull();
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
  });
  it("hides expired reports on a rerender before a delayed expiry timer runs", () => {
    const value = connection({ accessUntil: deviceNow + 1000 });
    value.executiveSnapshot!.accessUntil = deviceNow + 1000;
    const view = render(host(value));
    expect(screen.getByTestId("report")).toBeInTheDocument();
    vi.setSystemTime(deviceNow + 1100);
    view.rerender(host(value));
    expect(screen.queryByTestId("report")).toBeNull();
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
  });
  it("accepts later poll receipts without remounting the report or retaining an older clock sample", () => {
    const view = render(host(connection()));
    const reportNode = screen.getByTestId("report");
    for (const step of [1, 2]) {
      const elapsed = step * 5000;
      vi.setSystemTime(deviceNow + elapsed);
      const next = connection({ receivedAt: deviceNow + elapsed - 10 });
      next.executiveSnapshot!.revision += step;
      next.executiveSnapshot!.now += step;
      next.executiveSnapshot!.report.network.asAt.now += step;
      view.rerender(host(next));
      expect(screen.getByTestId("report")).toBe(reportNode);
      expect(reportNode).toHaveTextContent(String(NOW_ANCHOR + step));
      expect(screen.queryByTestId("ward-statistics-unavailable")).toBeNull();
    }
  });
  it("does not mount a private route behind the aggregate host's role gate", () => {
    guard.path = "/ward-flow/movements";
    render(
      host(
        connection(),
        <WardAccessGate>
          <WorldProbe />
        </WardAccessGate>,
      ),
    );
    expect(screen.getByTestId("ward-access-closed")).toBeInTheDocument();
    expect(guard.read).not.toHaveBeenCalled();
  });
  it.each(["actor", "epoch", "lifetime", "scope"] as const)("fails closed for an invalid %s binding", (field) => {
    const value = connection();
    if (field === "actor") value.actorId = "synthetic-mismatched";
    if (field === "epoch") value.viewEpoch = undefined;
    if (field === "lifetime") value.accessUntil = Number.POSITIVE_INFINITY;
    if (field === "scope") value.access = { role: "executive", scope: { kind: "service", service: "North Metro" } };
    render(host(value));
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
    expect(guard.seed).not.toHaveBeenCalled();
    expect(guard.read).not.toHaveBeenCalled();
  });
});

describe("controlled authorised preview host", () => {
  it("never shows an old source's report and never invents a transport binding", async () => {
    // Each report carries its source's time, so an old one would show the old time.
    const project = vi
      .spyOn(projector, "projectExecutiveReportingFoundation")
      .mockImplementation((_state, _access, options) => ({
        ...aggregate.report,
        network: { ...aggregate.report.network, asAt: { ...aggregate.report.network.asAt, now: options.now } },
      }));
    const input = {
      state: source,
      access: { role: "executive", scope: { kind: "statewide" } } as const,
      now: NOW_ANCHOR,
      dayZero: "2026-10-26T16:00:00.000Z",
      startedAt: "2026-10-27T02:42:00.000Z",
      events: [],
    };
    const child = <ReportProbe />;
    const view = render(<WardAuthorisedExecutivePreview source={input}>{child}</WardAuthorisedExecutivePreview>);
    expect(screen.getByTestId("report")).toHaveTextContent("none");
    await act(async () => {
      await vi.dynamicImportSettled();
    });
    expect(screen.getByTestId("report")).toHaveTextContent(String(NOW_ANCHOR));
    const changed = { ...input, now: NOW_ANCHOR + 1 };
    view.rerender(<WardAuthorisedExecutivePreview source={changed}>{child}</WardAuthorisedExecutivePreview>);
    // The new source's report in the same render: never the old one, and no empty frame that would
    // swap the executive shell for "unavailable" and close an open tour or sheet.
    expect(screen.getByTestId("report")).toHaveTextContent(String(NOW_ANCHOR + 1));
    expect(project).toHaveBeenLastCalledWith(source, input.access, expect.objectContaining({ now: NOW_ANCHOR + 1 }));
    project.mockRestore();
  });
  it("holds a completed preview only within its current authority mount", async () => {
    const project = vi.spyOn(projector, "projectExecutiveReportingFoundation").mockReturnValue(aggregate.report);
    const input = {
      state: source,
      access: { role: "executive", scope: { kind: "statewide" } } as const,
      now: NOW_ANCHOR,
      dayZero: "2026-10-26T16:00:00.000Z",
      startedAt: "2026-10-27T02:42:00.000Z",
      events: [],
    };
    const view = render(
      <WardAuthorisedExecutivePreview key="actor-a" source={input}>
        <ReportProbe />
      </WardAuthorisedExecutivePreview>,
    );
    await act(async () => {
      await vi.dynamicImportSettled();
    });
    fireEvent.click(screen.getByText("Pause"));
    view.rerender(
      <WardAuthorisedExecutivePreview key="actor-a" source={{ ...input, now: NOW_ANCHOR + 1 }}>
        <ReportProbe />
      </WardAuthorisedExecutivePreview>,
    );
    expect(screen.getByTestId("report")).toHaveTextContent(String(NOW_ANCHOR));
    expect(screen.getByText("Resume")).toBeInTheDocument();
    view.rerender(
      <WardAuthorisedExecutivePreview key="actor-b" source={input}>
        <ReportProbe />
      </WardAuthorisedExecutivePreview>,
    );
    expect(screen.getByTestId("report")).toHaveTextContent("none");
    expect(screen.queryByText("Resume")).not.toBeInTheDocument();
    await act(async () => {
      await vi.dynamicImportSettled();
    });
    project.mockRestore();
  });
});

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => <a {...props}>{children}</a>,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/statistics",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { StatisticsSummaryPhone } from "@/components/ward-management/statistics/statistics-summary-phone";
import { StatisticsCommunityScreen } from "@/components/ward-management/statistics/statistics-community-screen";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { siteGaps } from "@/components/ward-management/governance-site-gaps";
import { TvLockControl, lockTv, TV_LOCK_STORAGE_KEY } from "@/components/ward-management/bed-meeting/tv-lock";
import { BedMeetingTvScreen } from "@/components/ward-management/bed-meeting/bed-meeting-tv";
import { WARD_FEATURE_FLAGS_STORAGE_KEY } from "@/components/ward-management/shell/ward-feature-flag-store";
import { StepUpReauthContext } from "@/components/ward-management/shell/ward-step-up-context";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.removeItem(TV_LOCK_STORAGE_KEY);
  window.localStorage.removeItem(WARD_FEATURE_FLAGS_STORAGE_KEY);
});

const figures = {
  blocked: { total: 0, admissions: 0, tallies: [] },
  declines: { total: 0, tallies: [] },
  arrivals: { measured: 0, average: null, shortest: null, longest: null },
};
function summary(waiting: number) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsSummaryPhone
        ready={1}
        beingMadeReady={0}
        occupied={9}
        occupiedPct={90}
        waitingInEd={waiting}
        endedToday={0}
        wards={[]}
        eds={[{ id: "rph-ed", name: "Synthetic ED", site: "RPH", waiting, longest: 60 }]}
        referrals={{ raised: 0, accepted: 0, declined: 0, open: 0 }}
        moreFigures={figures}
        wardCount={0}
        paused={false}
        now={NOW_ANCHOR}
      />
    </WardFlowProvider>
  );
}

function RecordWhilePaused() {
  const { movements, eventLog, dispatch } = useWardFlow();
  const movement = movements.find(
    (each) => each.stage === "destination_review" && each.referredUnitIds.length > 0 && !each.closure,
  )!;
  return (
    <>
      <button
        onClick={() =>
          dispatch({
            type: "REFER_TO_UNITS",
            role: "coordinator",
            now: NOW_ANCHOR,
            movementId: movement.id,
            unitIds: [movement.referredUnitIds[0]!],
          })
        }
      >
        Record while paused
      </button>
      <output data-testid="paused-event-accepted">{String(eventLog?.at(-1)?.accepted ?? false)}</output>
    </>
  );
}

function CommunityGapProbe() {
  const flow = useWardFlow();
  const original = flow.movements.find((each) => each.legalForm && !each.closure)!;
  const gaps = siteGaps(
    {
      ...flow,
      admissions: [],
      movements: [
        {
          ...original,
          originEdId: undefined,
          originCommunity: { siteCode: "AUD-COMMUNITY", teamName: "Synthetic team" },
        },
      ],
    },
    NOW_ANCHOR,
  );
  return <output data-testid="community-gap-kind">{gaps[0]?.kind}</output>;
}

describe("audit remediation: live phone statistics sheets", () => {
  it("identifies community form gaps as community instead of emergency department", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CommunityGapProbe />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("community-gap-kind")).toHaveTextContent("community");
  });

  it("holds the session-trends log with the other figures while paused", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsScreen />
        <RecordWhilePaused />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /pause demo updates/ }));
    const before = screen.getByTestId("ward-statistics-session-trends").textContent;
    fireEvent.click(screen.getByRole("button", { name: "Record while paused" }));
    expect(screen.getByTestId("paused-event-accepted")).toHaveTextContent("true");
    expect(screen.getByTestId("ward-statistics-session-trends").textContent).toBe(before);
  });

  it("updates the open ED sheet when its parent's figures change", () => {
    const view = render(summary(1));
    fireEvent.click(screen.getByRole("button", { name: /^Open ED movements/ }));
    expect(within(screen.getByRole("dialog")).getByText("1")).toBeInTheDocument();
    view.rerender(summary(2));
    expect(within(screen.getByRole("dialog")).getByText("2")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).queryByText("1")).toBeNull();
  });

  it("applies the offered team sort to Data rows without dropping unavailable teams", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsCommunityScreen teamId="midland" />
      </WardFlowProvider>,
    );
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Team comparison view" })).getByRole("radio", { name: "Data" }),
    );
    const highest = within(screen.getByTestId("ward-statistics-community-comparison-table"))
      .getAllByRole("row")
      .slice(1)
      .map((row) => Number(row.querySelectorAll("td")[0]?.textContent))
      .filter(Number.isFinite);
    expect(new Set(highest).size).toBeGreaterThan(1);
    expect(highest).toEqual([...highest].sort((a, b) => b - a));
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Sort teams" })).getByRole("radio", { name: "A to Z" }),
    );
    const table = screen.getByTestId("ward-statistics-community-comparison-table");
    const names = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.querySelector("th,td")!.textContent!);
    expect(names.length).toBeGreaterThan(1);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe("audit remediation: TV lock outcomes", () => {
  it("keeps authenticated recovery available when TV views are switched off while locked", () => {
    window.localStorage.setItem(WARD_FEATURE_FLAGS_STORAGE_KEY, JSON.stringify({ "bed-meeting-tv": false }));
    window.dispatchEvent(new StorageEvent("storage", { key: WARD_FEATURE_FLAGS_STORAGE_KEY }));
    lockTv("/ward-flow/bed-meeting");
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BedMeetingTvScreen ward="no-such-ward" />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("bed-meeting-tv-off")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlock" })).toBeInTheDocument();
  });

  it("does not unlock after the password attempt was cancelled", async () => {
    lockTv("/ward-flow/bed-meeting");
    let finish!: () => void;
    const reauthenticate = () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      });
    render(
      <StepUpReauthContext.Provider value={reauthenticate}>
        <TvLockControl href="/ward-flow/bed-meeting" className="" shared />
      </StepUpReauthContext.Provider>,
    );
    fireEvent.click(screen.getByTestId("tv-unlock"));
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in and unlock" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => finish());
    expect(window.localStorage.getItem(TV_LOCK_STORAGE_KEY)).toBe("/ward-flow/bed-meeting");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("explains a refused browser-storage lock instead of silently doing nothing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage refused");
    });
    render(<TvLockControl href="/ward-flow/bed-meeting" className="" shared={false} />);
    fireEvent.click(screen.getByTestId("tv-lock"));
    expect(screen.getByRole("status")).toHaveTextContent(/could not.*lock|lock.*could not/i);
    expect(screen.getByTestId("tv-lock")).toBeInTheDocument();
  });
});

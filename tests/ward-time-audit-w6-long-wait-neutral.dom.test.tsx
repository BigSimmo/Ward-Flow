import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { BedMeetingTvScreen } from "@/components/ward-management/bed-meeting/bed-meeting-tv";
import { edTvSheet } from "@/components/ward-management/bed-meeting/tv-derivations";
import { rowTone, waitTone, type BoardRow } from "@/components/ward-management/delays/delays-board-model";
import { WAIT_BANDS } from "@/components/ward-management/delays/wait-bands";
import { ShapeOfTheDay } from "@/components/ward-management/movements/movements-shape-of-day";
import { MovementPeopleSheet } from "@/components/ward-management/movements/movement-people-sheet";
import { StatisticsMapView } from "@/components/ward-management/statistics/statistics-map-view";
import type { JourneyStage } from "@/components/ward-management/movements/movements-derivations";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { LONG_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Time audit T5 (D-194, Josh 13 Nov 2026, restoring D-24): a wait past 24 hours is shown in a neutral
 * colour on the TV and the Delays board, with no act-now glyph or red: Josh's own default, never a limit.
 * Synthetic seed data only.
 */

beforeAll(() => {
  // The map's ED wait field measures its card; jsdom has neither of these.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  if (typeof window.requestAnimationFrame !== "function") {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame;
  }
});

describe("waits past 24 hours read neutral (T5)", () => {
  it("leaves the Delays board's Past 24 hours group neutral", () => {
    const over24 = WAIT_BANDS.find((band) => band.id === "over24");
    expect(over24?.tone).toBeUndefined();
  });

  it("shows the TV's longest wait and long-wait rows without act-now colour or glyph", () => {
    const state = seedWardFlowStateAt(0);
    const inputs = {
      units: state.units,
      movements: state.movements,
      bedReleases: state.bedReleases,
      admissions: state.admissions,
      leaveBeds: state.leaveBeds,
      now: NOW_ANCHOR,
      nameOf: () => "",
    };
    const accessTargetMinutes = state.configuration.edAccessTargetMinutes;
    const ed = allEmergencyDepartments().find((each) => {
      const sheet = edTvSheet({
        ...inputs,
        edId: each.id,
        accessTargetMinutes,
        thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
      });
      return (sheet?.summary.longestWaitMinutes ?? 0) >= LONG_WAIT_MINUTES;
    });
    if (!ed) throw new Error("the seed has no ED with a wait past 24 hours");
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BedMeetingTvScreen ed={ed.id} />
      </WardFlowProvider>,
    );
    const tile = screen.getByTestId("ed-tv-longest");
    expect(tile).toHaveAttribute("data-tone", "neutral");
    expect(tile).not.toHaveTextContent("Act now");
    const long = screen.getByTestId("bed-meeting-tv").querySelectorAll("li[data-long]");
    expect(long.length).toBeGreaterThan(0);
    for (const row of long) {
      expect(row.querySelector("svg")).toBeNull();
      // The time still says it in words: past 24 hours it reads in days.
      expect(row).toHaveTextContent(/\d+d/u);
    }
  });

  it("gives a Delays row and spread dot past 24 hours no act-now tone; 8 to 24 hours stays amber", () => {
    const HOUR = 60;
    expect(waitTone(25 * HOUR)).toBeUndefined();
    expect(waitTone(24 * HOUR)).toBeUndefined();
    expect(waitTone(10 * HOUR)).toBe("warning");
    expect(waitTone(2 * HOUR)).toBeUndefined();
    const row = (waited: number, dueIn?: number) => ({ waited, dueIn }) as BoardRow;
    expect(rowTone(row(25 * HOUR), DEFAULT_DUE_SOON_THRESHOLDS)).toBe("neutral");
    expect(rowTone(row(10 * HOUR), DEFAULT_DUE_SOON_THRESHOLDS)).toBe("warning");
    // A typed legal time still carries its own tone, whatever the wait.
    expect(rowTone(row(25 * HOUR, 30), DEFAULT_DUE_SOON_THRESHOLDS)).toBe("danger");
    expect(rowTone(row(25 * HOUR, 2 * HOUR), DEFAULT_DUE_SOON_THRESHOLDS)).toBe("warning");
  });

  it("shows Movements' shape of the day past 24 hours without red", () => {
    const state = seedWardFlowStateAt(0);
    const base = state.movements[0]!;
    const waited = (hours: number, id: string) => ({ ...base, id, openedAt: NOW_ANCHOR - hours * 60 });
    const stages = [
      { id: base.stage, label: "Synthetic stage", blurb: "", movements: [waited(30, "SYN-30"), waited(15, "SYN-15")] },
    ] as JourneyStage[];
    const onShowPeople = vi.fn();
    const noop = () => {};
    render(
      <ShapeOfTheDay
        arrivedMovements={[]}
        closedToday={[]}
        didNotProceedMovements={[]}
        isInServiceScope={null}
        jumpToMovement={noop}
        legs={[]}
        noTransportRecord={[]}
        now={NOW_ANCHOR}
        onShowPeople={onShowPeople}
        openDetail={noop}
        openMovements={stages[0]!.movements}
        openStages={stages}
        patients={state.patients}
        referrals={state.referrals}
        setShapeTab={noop}
        shapeTab="stage"
        unacceptedTransport={[]}
        units={state.units}
        waitingMovements={[]}
      />,
    );
    const act = screen.getByRole("region", { name: "Longest waits to act on" });
    expect(act.querySelector('[data-tone="danger"]')).toBeNull();
    expect(act.querySelector('[data-tone="warning"]')).not.toBeNull();
    expect(screen.getByText(/Amber is 12 to 24h, grey over 24h\./u)).toBeInTheDocument();
    fireEvent.click(act.querySelector('button[data-band="3"]')!);
    expect(onShowPeople).toHaveBeenCalledWith(expect.objectContaining({ tone: undefined }));
  });

  it("opens a Movements people list past 24 hours with no act-now tone", () => {
    const state = seedWardFlowStateAt(0);
    const base = state.movements[0]!;
    const movements = [{ ...base, openedAt: NOW_ANCHOR - 30 * 60 }];
    render(
      <MovementPeopleSheet
        list={{ title: "Synthetic list", caption: "Synthetic", movements }}
        now={NOW_ANCHOR}
        units={state.units}
        patients={state.patients}
        referrals={state.referrals}
        onClose={() => {}}
        onOpenMovement={() => {}}
      />,
    );
    const summary = screen.getByRole("group", { name: "Summary and filters" });
    expect(summary.querySelector('[data-tone="danger"]')).toBeNull();
    expect(within(summary).getByText("Over 24h")).toBeInTheDocument();
  });

  it("names no amber past-24h mark on the Statistics map's ED lens; 48 hours keeps its triangle", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsMapView />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("radio", { name: /^Open ED movements/ }));
    const key = screen.getByText(/^Ring: longest time since opening/u);
    expect(key).not.toHaveTextContent(/past 24h/u);
    expect(key).toHaveTextContent("Triangle: over 48h.");
    const headline = screen.getByTestId("ward-statistics-map-headline");
    const past24 = within(headline).getByText("Over 24h");
    expect(past24.querySelector("svg")).toBeNull();
  });
});

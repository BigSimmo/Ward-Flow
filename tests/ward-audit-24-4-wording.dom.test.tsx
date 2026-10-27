import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { isOver24hInEd, isOver8hInEd, type BoardRow } from "@/components/ward-management/delays/delays-board-model";
import {
  ED_ACCEPTED_NO_BED_STAGES,
  ED_BED_PULLED_STAGES,
  ED_HELD_STAGES,
  ED_SPLIT_HELD_LABELS,
} from "@/components/ward-management/ed/ed-home-derivations";
import { journeyStages } from "@/components/ward-management/statistics/statistics-journey-view";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { readyBedsNow } from "@/components/ward-management/ward-bed-states";
import { dueSoonThresholdsOf } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { RELEASES_HELD_UP_LABEL, wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { WARD_SCENARIOS, scenarioWardNetwork } from "@/components/ward-management/ward-scenarios";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

/** Audit 24-4 (Josh, 24 Oct 2026, "fix all the issues you recommend"): the approved wording. */
const scenario = WARD_SCENARIOS[0]!;
const state = seedWardFlowState(scenario);

describe("audit 24-4 wording", () => {
  it("NA2-02: the menu figure is releases held up, today and tomorrow", () => {
    const nav = wardNavCounts({
      movements: state.movements,
      units: state.units,
      sites: scenarioWardNetwork(scenario).sites,
      referrals: state.referrals,
      bedReleases: state.bedReleases,
      leaveBeds: state.leaveBeds,
      admissions: state.admissions,
      now: NOW_ANCHOR,
      thresholds: dueSoonThresholdsOf(state.configuration),
    });
    expect(RELEASES_HELD_UP_LABEL).toBe("Releases held up, today and tomorrow");
    expect(nav.discharges?.noun).toBe("releases held up, today and tomorrow");
  });

  it("NA2-04: ED 'Bed held' splits into Accepted, no bed yet and Bed pulled", () => {
    expect(ED_ACCEPTED_NO_BED_STAGES).toEqual(["accepted_awaiting_bed"]);
    expect(ED_BED_PULLED_STAGES).toEqual(["pulled"]);
    expect([...ED_HELD_STAGES].sort()).toEqual([...ED_ACCEPTED_NO_BED_STAGES, ...ED_BED_PULLED_STAGES].sort());
    expect(ED_SPLIT_HELD_LABELS).toEqual({ acceptedNoBed: "Accepted, no bed yet", bedPulled: "Bed pulled" });
  });

  it("NA2-05: the Journey stage is 'No ward has answered yet', never 'Waiting in ED'", () => {
    const stages = journeyStages({ ...state, now: NOW_ANCHOR });
    expect(stages.map((stage) => stage.label)).not.toContain("Waiting in ED");
    expect(stages.find((stage) => stage.id === "waiting")?.label).toBe("No ward has answered yet");
  });

  it("NA2-10: Over 8h and Over 24h both leave out people already in transit", () => {
    const moving = state.movements.find((movement) => movement.stage === "moving");
    expect(moving, "the seed has someone in transit").toBeDefined();
    const row = { movement: moving!, waited: 48 * 60 } as BoardRow;
    expect(isOver8hInEd(row)).toBe(false);
    expect(isOver24hInEd(row)).toBe(false);
  });

  it("NA2-09: the Bed board prints the ward's ready figure with the still-being-made-ready note", () => {
    let seen: ReturnType<typeof useWardFlow> | undefined;
    function Probe() {
      seen = useWardFlow();
      return null;
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Probe />
          <WardScreen unitId="scgh-adult-open" />
        </ToastProvider>
      </WardFlowProvider>,
    );
    act(() => fireEvent.click(screen.getByTestId("ward-open-bed-board")));
    const unit = seen!.units.find((candidate) => candidate.id === "scgh-adult-open")!;
    const ready = readyBedsNow(unit, seen!.admissions, seen!.bedReleases);
    const preparing = bedsPendingPreparation(unit.id, seen!.bedReleases);
    const head = screen.getAllByText(
      (_, element) => element?.tagName === "SPAN" && /^\d+ ready of \d+/u.test(element.textContent ?? ""),
    )[0]!;
    expect(head.textContent).toMatch(new RegExp(`^${ready} ready of \\d+`, "u"));
    expect(head.textContent?.includes("still being made ready")).toBe(preparing > 0);
  });
});

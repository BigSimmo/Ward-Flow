import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, replace, ...rest }: { children: ReactNode; href: string; replace?: boolean }) => (
    <a href={href} data-replace={replace ? "true" : undefined} {...rest}>
      {children}
    </a>
  ),
}));

import { BedMeetingTvScreen } from "@/components/ward-management/bed-meeting/bed-meeting-tv";
import { tvBoardOf } from "@/components/ward-management/bed-meeting/tv-board-switch";
import { edClinicalRows, wardClinicalRows } from "@/components/ward-management/bed-meeting/tv-clinical-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { WARD_BED_MEETING_TV_HREF, bedMeetingTvHref } from "@/components/ward-management/ward-nav";
import { NOW_ANCHOR, allEmergencyDepartments } from "@/components/ward-management/ward-sites";

/** The clinical and handover TV boards (Josh, 4 Nov 2026). Synthetic seed only. */

function seed() {
  const state = seedWardFlowStateAt(0);
  const records = {
    movements: state.movements,
    referrals: state.referrals,
    patients: state.patients,
    plannedAdmissions: state.plannedAdmissions,
  };
  return { state, records };
}

function wardWithLeave() {
  const { state } = seed();
  const unit = state.units.find((candidate) => state.leaveBeds.some((leave) => leave.unitId === candidate.id));
  if (!unit) throw new Error("the seed has no ward with leave");
  return unit;
}

function renderTv(props: Parameters<typeof BedMeetingTvScreen>[0]) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <BedMeetingTvScreen {...props} />
    </WardFlowProvider>,
  );
}

describe("TV board links", () => {
  it("keeps a ward or ED board in the link and leaves bed flow links as they were", () => {
    expect(bedMeetingTvHref({ ward: "w1" })).toBe(`${WARD_BED_MEETING_TV_HREF}?ward=w1`);
    expect(bedMeetingTvHref({ ward: "w1", board: "flow" })).toBe(`${WARD_BED_MEETING_TV_HREF}?ward=w1`);
    expect(bedMeetingTvHref({ ward: "w1", board: "handover" })).toBe(
      `${WARD_BED_MEETING_TV_HREF}?ward=w1&board=handover`,
    );
    expect(bedMeetingTvHref({ ed: "e1", board: "clinical" })).toBe(`${WARD_BED_MEETING_TV_HREF}?ed=e1&board=clinical`);
  });

  it("reads only the boards each screen has", () => {
    expect(tvBoardOf("clinical", "ward")).toBe("clinical");
    expect(tvBoardOf("handover", "ward")).toBe("handover");
    expect(tvBoardOf("handover", "ed")).toBe("flow");
    expect(tvBoardOf("clinical", "meeting")).toBe("flow");
    expect(tvBoardOf("anything", "ward")).toBe("flow");
    expect(tvBoardOf(undefined, "ed")).toBe("flow");
  });
});

describe("ward clinical rows", () => {
  it("lists every stay this ward holds a bed for, by bed number, with leave in words", () => {
    const { state, records } = seed();
    const unit = wardWithLeave();
    const rows = wardClinicalRows({
      ...records,
      unit,
      admissions: state.admissions,
      leaveBeds: state.leaveBeds,
      bedReleases: state.bedReleases,
      now: NOW_ANCHOR,
      nameOf: (subject) => subject.id,
    });
    const stays = state.admissions.filter(
      (admission) => admission.unitId === unit.id && (admission.state === "occupied" || admission.state === "pulled"),
    );
    expect(rows.map((row) => row.key).sort()).toEqual(stays.map((stay) => stay.id).sort());
    const numbers = rows.map((row) => row.bedNumber);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    const onLeave = rows.filter((row) => row.where === "leave");
    expect(onLeave.length).toBeGreaterThan(0);
    for (const row of onLeave) expect(row.whereabouts?.text).toMatch(/due back \d\d:\d\d$/u);
  });

  it("puts a person absent without leave first in the handover and never calls it leave", () => {
    const { state, records } = seed();
    const unit = wardWithLeave();
    const leave = state.leaveBeds.find((record) => record.unitId === unit.id);
    if (!leave) throw new Error("expected a leave record");
    const missing = { ...leave, absentWithoutLeave: { since: NOW_ANCHOR - 30, steps: [] } };
    const rows = wardClinicalRows({
      ...records,
      unit,
      admissions: state.admissions,
      leaveBeds: state.leaveBeds.map((record) => (record === leave ? missing : record)),
      bedReleases: state.bedReleases,
      now: NOW_ANCHOR,
      nameOf: (subject) => subject.id,
    });
    const row = rows.find((candidate) => candidate.key === leave.admissionId);
    expect(row?.where).toBe("awol");
    expect(row?.whereabouts).toEqual({ text: expect.stringMatching(/^Absent without leave since/u), tone: "danger" });
    expect(row?.attention[0]?.group).toBe("missing");
  });
});

describe("ED clinical rows", () => {
  it("shows the department's open journeys longest first, with legal times only as typed", () => {
    const { state, records } = seed();
    const accessTargetMinutes = state.configuration.edAccessTargetMinutes;
    const rowsFor = (edId: string) =>
      edClinicalRows({
        ...records,
        edId,
        units: state.units,
        now: NOW_ANCHOR,
        accessTargetMinutes,
        nameOf: (m) => m.id,
      }) ?? [];
    const ed = [...allEmergencyDepartments()].sort((a, b) => rowsFor(b.id).length - rowsFor(a.id).length)[0];
    const rows = rowsFor(ed.id);
    expect(rows.length).toBeGreaterThan(1);
    const waits = rows.map((row) => row.waitMinutes);
    expect(waits).toEqual([...waits].sort((a, b) => b - a));
    for (const row of rows) {
      if (row.legal?.text.includes("Ends") || row.legal?.text.includes("Ended"))
        expect(row.legal.text).toMatch(/as typed/u);
      expect(row.band).toBe(
        row.waitMinutes >= accessTargetMinutes ? "over" : row.waitMinutes >= 480 ? "eight" : "under",
      );
    }
  });
});

describe("clinical TV screens", () => {
  it("shows the ward clinical board with its board switch and live cue", () => {
    const unit = wardWithLeave();
    renderTv({ ward: unit.id, board: "clinical" });
    const tv = screen.getByTestId("bed-meeting-tv");
    expect(tv).toHaveAttribute("data-view", "ward-clinical");
    expect(tv).toHaveAttribute("data-board", "clinical");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(unit.name);
    expect(screen.getAllByTestId("ward-clinical-row").length).toBeGreaterThan(0);
    const switcher = screen.getByTestId("tv-board-switch");
    expect(within(switcher).getByRole("link", { name: "Clinical" })).toHaveAttribute("aria-current", "page");
    expect(within(switcher).getByRole("link", { name: "Bed flow" })).toHaveAttribute(
      "href",
      bedMeetingTvHref({ ward: unit.id }),
    );
    expect(screen.getByTestId("tv-live")).toHaveTextContent("Live");
  });

  it("shows the handover board's attention list and every bed", () => {
    const unit = wardWithLeave();
    renderTv({ ward: unit.id, board: "handover" });
    expect(screen.getByTestId("bed-meeting-tv")).toHaveAttribute("data-board", "handover");
    expect(within(screen.getByTestId("ward-handover-attention")).getByText("Leave due back")).toBeInTheDocument();
    expect(within(screen.getByTestId("ward-handover-beds")).getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("shows the ED clinical board, and keeps bed flow when the link names no board", () => {
    const { state, records } = seed();
    const accessTargetMinutes = state.configuration.edAccessTargetMinutes;
    const ed = allEmergencyDepartments().find(
      (candidate) =>
        (edClinicalRows({
          ...records,
          edId: candidate.id,
          units: state.units,
          now: NOW_ANCHOR,
          accessTargetMinutes,
          nameOf: (m) => m.id,
        })?.length ?? 0) > 0,
    );
    if (!ed) throw new Error("expected an ED with people waiting");
    const { unmount } = renderTv({ ed: ed.id, board: "clinical" });
    expect(screen.getByTestId("bed-meeting-tv")).toHaveAttribute("data-view", "ed-clinical");
    expect(screen.getAllByTestId("ed-clinical-row").length).toBeGreaterThan(0);
    expect(within(screen.getByTestId("tv-board-switch")).queryByRole("link", { name: "Handover" })).toBeNull();
    unmount();
    renderTv({ ed: ed.id });
    expect(screen.getByTestId("bed-meeting-tv")).toHaveAttribute("data-view", "ed");
  });
});

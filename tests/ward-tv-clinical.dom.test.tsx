import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
import {
  edClinicalRows,
  wardClinicalRows,
  type WardClinicalRow,
} from "@/components/ward-management/bed-meeting/tv-clinical-derivations";
import { WardClinicalTvView } from "@/components/ward-management/bed-meeting/tv-clinical-views";
import { WardTodayTvView } from "@/components/ward-management/bed-meeting/tv-function-views";
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
    for (const board of ["obs", "legal", "today"] as const) {
      expect(tvBoardOf(board, "ward")).toBe(board);
      expect(tvBoardOf(board, "ed")).toBe("flow");
    }
    expect(tvBoardOf("beds", "ed")).toBe("beds");
    expect(tvBoardOf("beds", "ward")).toBe("flow");
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

describe("the Today lane's held up window (D-197 item 6, D-191 item 5)", () => {
  it("counts a held-up discharge due by tomorrow, and leaves one due later on its row only", () => {
    const { state, records } = seed();
    const DAY = 24 * 60;
    const release = state.bedReleases.find(
      (candidate) =>
        candidate.state !== "discharged" &&
        state.admissions.some((stay) => stay.id === candidate.admissionId && stay.state === "occupied"),
    );
    if (!release) throw new Error("expected an open release for an occupied bed");
    const unit = state.units.find((candidate) => candidate.id === release.unitId)!;
    // The ward's own date is three days away, so the person is neither going today nor overdue.
    const admissions = state.admissions.map((stay) =>
      stay.id === release.admissionId ? { ...stay, expectedDischargeAt: NOW_ANCHOR + 3 * DAY } : stay,
    );
    const rowWith = (expectedAt: number) =>
      wardClinicalRows({
        ...records,
        unit,
        admissions,
        leaveBeds: state.leaveBeds,
        bedReleases: state.bedReleases.map((candidate) =>
          candidate.id === release.id ? { ...release, blocker: "Awaiting pharmacy", expectedAt } : candidate,
        ),
        now: NOW_ANCHOR,
        nameOf: (subject) => subject.id,
      }).find((row) => row.key === release.admissionId)!;

    const tomorrow = rowWith(NOW_ANCHOR + DAY);
    const later = rowWith(NOW_ANCHOR + 3 * DAY);
    expect(tomorrow.stuck).toBe(true);
    expect(tomorrow.attention.some((item) => item.group === "stuck")).toBe(true);
    // Held up after tomorrow: the row still says so, but it is not in the held-up lane or count.
    expect(later.plan?.text).toBe("Held up: Awaiting pharmacy");
    expect(later.stuck).toBe(false);
    expect(later.attention.some((item) => item.group === "stuck")).toBe(false);

    for (const [row, listed] of [
      [tomorrow, true],
      [later, false],
    ] as const) {
      const { container, unmount } = render(<WardTodayTvView rows={[row]} footer={null} />);
      // The Today board names the by-tomorrow window, and counts only the person held up by then.
      expect(container.querySelector('[data-lane="stuck"] h2')).toHaveTextContent(
        `Held up · by tomorrow, or overdue ${listed ? 1 : 0}`,
      );
      unmount();
    }
  });
});

describe("TV leave lateness (time audit T9)", () => {
  it("calls leave late only once the return time has passed, as the patient pages do", () => {
    const { state, records } = seed();
    const unit = wardWithLeave();
    const leave = state.leaveBeds.find((record) => record.unitId === unit.id && !record.absentWithoutLeave);
    if (!leave) throw new Error("expected a leave record");
    const rowAt = (expectedReturn: number) =>
      wardClinicalRows({
        ...records,
        unit,
        admissions: state.admissions,
        leaveBeds: state.leaveBeds.map((record) => (record === leave ? { ...leave, expectedReturn } : record)),
        bedReleases: state.bedReleases,
        now: NOW_ANCHOR,
        nameOf: (subject) => subject.id,
      }).find((candidate) => candidate.key === leave.admissionId);
    const onTime = rowAt(NOW_ANCHOR);
    expect(onTime?.whereabouts?.text).toMatch(/, due back /u);
    expect(onTime?.whereabouts?.tone).toBeUndefined();
    const late = rowAt(NOW_ANCHOR - 1);
    expect(late?.whereabouts?.text).toMatch(/was due back /u);
    expect(late?.whereabouts?.tone).toBe("danger");
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

  it("adds the task boards beside the others and keeps every bed on one of their lanes", () => {
    const unit = wardWithLeave();
    for (const [board, testId] of [
      ["obs", "ward-obs-board"],
      ["legal", "ward-legal-board"],
      ["today", "ward-today-board"],
    ] as const) {
      const { unmount } = renderTv({ ward: unit.id, board });
      expect(screen.getByTestId("bed-meeting-tv")).toHaveAttribute("data-board", board);
      expect(screen.getByTestId(testId)).toBeInTheDocument();
      expect(screen.getAllByTestId("tv-lane")).toHaveLength(4);
      const switcher = screen.getByTestId("tv-board-switch");
      for (const name of ["Clinical", "Handover", "Obs and leave", "Legal", "Today", "Bed flow"])
        expect(within(switcher).getByRole("link", { name })).toBeInTheDocument();
      unmount();
    }
    // Obs and leave and Legal place every person this ward holds a bed for exactly once.
    renderTv({ ward: unit.id, board: "obs" });
    const { state, records } = seed();
    const rows = wardClinicalRows({
      ...records,
      unit,
      admissions: state.admissions,
      leaveBeds: state.leaveBeds,
      bedReleases: state.bedReleases,
      now: NOW_ANCHOR,
      nameOf: (subject) => subject.id,
    });
    expect(screen.getByTestId("ward-obs-board").querySelectorAll("h2 span")).toHaveLength(4);
    const counted = [...screen.getByTestId("ward-obs-board").querySelectorAll("h2 span")].reduce(
      (sum, badge) => sum + Number(badge.textContent),
      0,
    );
    expect(counted).toBe(rows.length);
  });

  it("shows the ED bed search board with each person in one step", () => {
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
    renderTv({ ed: ed.id, board: "beds" });
    expect(screen.getByTestId("bed-meeting-tv")).toHaveAttribute("data-board", "beds");
    const board = screen.getByTestId("ed-beds-board");
    const counted = [...board.querySelectorAll("h2 span")].reduce((sum, badge) => sum + Number(badge.textContent), 0);
    expect(counted).toBe(rowsFor(ed.id).length);
    expect(within(screen.getByTestId("tv-board-switch")).getByRole("link", { name: "Bed search" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("clinical TV paging can be stopped (WCAG 2.2.2)", () => {
  function syntheticRows(count: number): WardClinicalRow[] {
    return Array.from({ length: count }, (_, index) => ({
      key: `synthetic-${index}`,
      bed: String(index + 1).padStart(2, "0"),
      bedNumber: index + 1,
      name: `Synthetic ${index + 1}`,
      dayNumber: 2,
      where: "ward" as const,
      obs: { text: "General obs" },
      constantObs: false,
      risks: [],
      legal: null,
      whereabouts: null,
      plan: null,
      arrivedToday: false,
      goingToday: false,
      stuck: false,
      attention: [],
    }));
  }
  const pageText = () => screen.getByTestId("tv-clinical-page").textContent ?? "";

  it("turns on its own, holds while paused or focused, and pages by hand", () => {
    vi.useFakeTimers();
    try {
      render(<WardClinicalTvView rows={syntheticRows(30)} footer={null} />);
      expect(pageText()).toContain("Page 1 of 3");
      act(() => vi.advanceTimersByTime(20_000));
      expect(pageText()).toContain("Page 2 of 3");

      fireEvent.click(screen.getByRole("button", { name: "Pause" }));
      expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(60_000));
      expect(pageText()).toContain("Page 2 of 3");
      fireEvent.click(screen.getByRole("button", { name: "Next page" }));
      expect(pageText()).toContain("Page 3 of 3");
      fireEvent.click(screen.getByRole("button", { name: "Resume" }));

      // Focus inside the board holds the page too.
      fireEvent.focusIn(screen.getByRole("button", { name: "Next page" }));
      act(() => vi.advanceTimersByTime(40_000));
      expect(pageText()).toContain("Page 3 of 3");
    } finally {
      vi.useRealTimers();
    }
  });

  it("never turns on its own under the Ward reduced-motion setting", () => {
    vi.useFakeTimers();
    document.documentElement.setAttribute("data-reduced-motion", "");
    try {
      render(<WardClinicalTvView rows={syntheticRows(30)} footer={null} />);
      expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
      act(() => vi.advanceTimersByTime(60_000));
      expect(pageText()).toContain("Page 1 of 3");
      fireEvent.click(screen.getByRole("button", { name: "Next page" }));
      expect(pageText()).toContain("Page 2 of 3");
    } finally {
      document.documentElement.removeAttribute("data-reduced-motion");
      vi.useRealTimers();
    }
  });
});

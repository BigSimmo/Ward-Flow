import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { WardHomeTab } from "@/components/ward-management/ward/ward-home-tab";
import { formatInstant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

let selected: WardFlowState;
vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>()),
  useWardFlowSelect: () => selected,
}));

const REPORTED_AT = NOW_ANCHOR;
const EDITED_AT = NOW_ANCHOR + 120;
const NEW_DATE = NOW_ANCHOR + 600;

function fixture(count = 1) {
  const seed = seedWardFlowState();
  const unit = seed.units[0];
  const admissions = seed.admissions.slice(0, count).map((stay, index) => ({
    ...stay,
    id: `AD-SHIFT-DATE-${index}`,
    unitId: unit.id,
    state: "occupied" as const,
    expectedDischargeAt: NOW_ANCHOR + 360 + index * 60,
    dischargeDateSetAt: NOW_ANCHOR - 60,
  }));
  let state = { ...seed, admissions, bedReleases: [] } as WardFlowState;
  for (const stay of admissions) {
    const next = wardFlowReducer(state, {
      type: "FLAG_BED_RELEASE",
      role: "ward",
      now: REPORTED_AT,
      actingUnitId: unit.id,
      unitId: unit.id,
      admissionId: stay.id,
      expectedAt: stay.expectedDischargeAt,
      waitingOn: "Nothing outstanding",
    });
    expect(next.rejections).toEqual(state.rejections);
    state = next;
  }
  return { state, unit };
}

function edit(state: WardFlowState, role: "ward" | "coordinator" = "ward") {
  const stay = state.admissions[0];
  const next = wardFlowReducer(state, {
    type: "UPDATE_EXPECTED_DISCHARGE",
    role,
    now: EDITED_AT,
    actingUnitId: stay.unitId,
    admissionId: stay.id,
    expectedDischargeAt: NEW_DATE,
  });
  expect(next.rejections).toEqual(state.rejections);
  return next;
}

function show(state: WardFlowState, now = EDITED_AT) {
  selected = state;
  const unit = state.units[0];
  const props: ComponentProps<typeof WardHomeTab> = {
    unit,
    units: state.units,
    capacity: { available: 0, occupied: state.admissions.length },
    accepted: [],
    incoming: [],
    withdrawn: [],
    overridesHere: [],
    now,
    presentation: "overview",
    activeAnswerIndex: 0,
    setAnswerIndex: vi.fn(),
    visibleIncoming: [],
    declineOpenFor: null,
    toggleDecline: vi.fn(),
    declineReason: undefined,
    setDeclineReason: vi.fn(),
    submitDecline: vi.fn(),
    priorRejectionCountRef: { current: 0 },
    rejections: [],
    dispatch: vi.fn(),
    setCheckToken: vi.fn(),
    recentAnswers: [],
    breakdown: { confirmedToday: 0, expectedToday: 0, onLeave: 0 },
    pendingBedReleasesCount: state.bedReleases.length,
    unitLeaveBedsCount: 0,
    resolvePatientIdentity: vi.fn(),
    lastActionRejection: null,
    overrideReasonForm: vi.fn(),
    liveFormAlerts: [],
    shiftView: "log",
  };
  render(<WardHomeTab {...props} />);
  return screen.getByRole("heading", { name: "Shift log" }).parentElement!;
}

describe("shift log separates a release report from a later discharge plan", () => {
  it("keeps grouped wording neutral when another release was reported after the plan edit", () => {
    const changed = edit(fixture(2).state);
    const other = changed.bedReleases.find((release) => release.admissionId === changed.admissions[1].id)!;
    const reportedLaterAt = EDITED_AT + 60;
    const later = wardFlowReducer(changed, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: reportedLaterAt,
      releaseId: other.id,
      actingUnitId: other.unitId,
    });
    expect(later.rejections).toEqual(changed.rejections);
    const log = show(later, reportedLaterAt);
    const group = within(log).getByText("2 beds expected out").closest("li")!;
    expect(group).toHaveTextContent(formatInstantWithDay(reportedLaterAt, reportedLaterAt));
    expect(group).toHaveTextContent("Current departure plan shown separately");
    expect(group).not.toHaveTextContent("updated later");
    const update = within(log).getByText("Expected departure updated").closest("li")!;
    expect(update).toHaveTextContent(formatInstantWithDay(EDITED_AT, reportedLaterAt));
    expect(update).toHaveTextContent(`Departure ${formatInstant(NEW_DATE)}`);
  });
  it.each([1, 2])("shows the date edit at its own time for %s pending releases", (count) => {
    const { state } = fixture(count);
    const changed = edit(state);
    const log = show(changed);
    const report = within(log)
      .getByText(count === 1 ? "Bed expected out" : "2 beds expected out")
      .closest("li")!;
    expect(report).toHaveTextContent(formatInstantWithDay(REPORTED_AT, EDITED_AT));
    expect(report).not.toHaveTextContent(formatInstant(NEW_DATE));
    expect(report).toHaveTextContent("Current departure plan shown separately");
    const update = within(log).getByText("Expected departure updated").closest("li")!;
    expect(update).toHaveTextContent(formatInstantWithDay(EDITED_AT, EDITED_AT));
    expect(update).toHaveTextContent(`Departure ${formatInstant(NEW_DATE)}`);
    expect(update).toHaveTextContent("Ward manager");
    expect(changed.bedReleases[0].confirmedAt).toBe(state.bedReleases[0].confirmedAt);
    expect(changed.bedReleases[0].confirmedBy).toBe(state.bedReleases[0].confirmedBy);
  });

  it("does not assign a ward manager to a coordinator's update with no recorded author label", () => {
    const log = show(edit(fixture().state, "coordinator"));
    const update = within(log).getByText("Expected departure updated").closest("li")!;
    expect(update).toHaveTextContent(`Departure ${formatInstant(NEW_DATE)}`);
    expect(update).not.toHaveTextContent("Ward manager");
  });

  it.each([1, 2])("preserves the existing report when %s releases have no later edit", (count) => {
    const { state } = fixture(count);
    const log = show(state);
    expect(within(log).queryByText("Expected departure updated")).not.toBeInTheDocument();
    expect(log).toHaveTextContent(
      count === 1 ? `Departure ${formatInstant(state.bedReleases[0].expectedAt)}` : "Next at",
    );
  });

  it.each(["mismatched plan", "missing time", "earlier time", "historical release"])(
    "does not attach unrelated plan metadata to a %s",
    (kind) => {
      const state = edit(fixture().state);
      if (kind === "mismatched plan") state.admissions[0].expectedDischargeAt = NEW_DATE + 60;
      if (kind === "missing time") state.admissions[0].dischargeDateSetAt = null;
      if (kind === "earlier time") state.admissions[0].dischargeDateSetAt = REPORTED_AT - 1;
      if (kind === "historical release") state.bedReleases[0].state = "discharged";
      const log = show(state);
      expect(within(log).queryByText("Expected departure updated")).not.toBeInTheDocument();
    },
  );
});

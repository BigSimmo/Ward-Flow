import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { PriorityQueue } from "@/components/ward-management/coordinator/priority-queue";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { Referral } from "@/components/ward-management/ward-model";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";

const flag = vi.hoisted(() => ({ cld: true }));
vi.mock("@/components/ward-management/shell/ward-feature-flag-store", () => ({
  useWardFeatureFlag: () => flag.cld,
}));

const now = NOW_ANCHOR;
const cldBadge = "Turnaround Candidate: Bed clearing via Criteria-Led Discharge";
const departureBadge = "Turnaround Candidate: Bed clearing via confirmed departure";

function fixture() {
  const state = seedWardFlowState();
  const unit = allUnits().find((u) => u.id === "rph-adult-secure")!;
  state.units = [{ ...unit, allocatable: { ...unit.allocatable, value: 0 }, allocatableLocked: 0 }];
  const admission = state.admissions.find((a) => a.state === "occupied" && a.patientId !== null)!;
  state.admissions = [
    {
      ...admission,
      unitId: unit.id,
      dischargeCriteria: {
        setAt: now,
        items: [{ criterion: "Synthetic accommodation confirmed", metAt: now, patientSpecific: true }],
      },
    },
  ];
  state.patients = state.patients.map((p) => (p.id === admission.patientId ? { ...p, legalStatus: "Voluntary" } : p));
  state.movements = state.movements.filter(
    (m) => m.admissionId !== admission.id && m.patientId !== admission.patientId,
  );
  state.bedReleases = [];
  const base = state.referrals.find(
    (r) => r.destinations.some((d) => d.state === "queued") && !state.movements.some((m) => m.referralId === r.id),
  )!;
  const referral: Referral = {
    ...base,
    ageBand: "Adult" as const,
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward" as const,
          sex: "Female" as const,
          gender: "Female" as const,
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "queued" as const,
      },
    ],
  };
  state.referrals = [referral];
  const movement = state.movements.find((m) => !m.closure && m.stage !== "arrived" && !m.acceptedUnitId)!;
  return { state, referral, movement, unitId: unit.id, admission: state.admissions[0]! };
}

function renderFixture(
  f: ReturnType<typeof fixture>,
  options: { queue?: boolean; reject?: boolean; phone?: boolean } = {},
) {
  const events = vi.fn<(event: WardFlowEvent) => void>();
  function Harness() {
    const context = useWardFlow();
    const [state, setState] = useState(f.state);
    const dispatch = (event: WardFlowEvent) => {
      events(event);
      setState((previous) =>
        options.reject
          ? {
              ...previous,
              rejections: [
                ...previous.rejections,
                {
                  id: "synthetic-refusal",
                  movementId:
                    event.type === "FLAG_REFERRAL_TURNAROUND_PRIORITY"
                      ? event.referralId
                      : event.type === "FLAG_MOVEMENT_TURNAROUND_PRIORITY"
                        ? event.movementId
                        : "none",
                  at: now,
                  attempted: event.type,
                  reason: "Synthetic readiness changed; review the unit.",
                },
              ],
            }
          : wardFlowReducer(previous, event),
      );
    };
    return (
      <WardFlowOverride value={{ ...context, ...state, now: now + state.clockOffsetMinutes, dispatch }}>
        {options.queue ? (
          <PriorityQueue
            movements={state.movements}
            referralQueue={state.referrals}
            units={state.units}
            now={now + state.clockOffsetMinutes}
            selectedId={undefined}
            onSelect={() => {}}
            filterEdId={undefined}
            onClearFilter={() => {}}
          />
        ) : (
          <ReferralMatchView
            referral={state.referrals[0]!}
            units={state.units}
            now={now + state.clockOffsetMinutes}
            dispatch={dispatch}
            rejections={state.rejections}
            phone={options.phone ? <span>Phone referral details</span> : undefined}
          />
        )}
      </WardFlowOverride>
    );
  }
  render(
    <WardFlowProvider initialNow={now}>
      <Harness />
    </WardFlowProvider>,
  );
  // Audit 1, Josh 20 Oct (WP-05): the decision list starts with no ward picked; the coordinator taps one.
  // D-77: desktop uses the same list as the phone.
  const candidate = screen.queryByTestId(`ward-referral-match-phone-cand-${f.unitId}`);
  if (candidate) fireEvent.click(candidate);
  return events;
}

afterEach(() => {
  flag.cld = true;
});

describe("human turnaround preference control", () => {
  it("records only one referral preference on explicit click, then explains the duplicate", () => {
    const f = fixture();
    const events = renderFixture(f);
    const button = screen.getByRole("button", { name: "Flag Turnaround Priority" });
    expect(button).not.toHaveAttribute("aria-disabled", "true");
    expect(events).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(events.mock.calls.map(([event]) => event)).toEqual([
      {
        type: "FLAG_REFERRAL_TURNAROUND_PRIORITY",
        role: "coordinator",
        now,
        referralId: f.referral.id,
        unitId: f.unitId,
        source: "cld",
      },
    ]);
    const recorded = screen.getByRole("button", { name: "Flag Turnaround Priority" });
    expect(recorded).toHaveAttribute("aria-disabled", "true");
    expect(recorded).toHaveAccessibleDescription("Turnaround preference already recorded for this unit.");
    fireEvent.click(recorded);
    expect(events).toHaveBeenCalledTimes(1);
  });

  it("offers the same explicit turnaround preference on the phone sheet", () => {
    const f = fixture();
    const events = renderFixture(f, { phone: true });
    expect(screen.getByTestId("ward-referral-match-panel")).toHaveAttribute("data-phone", "true");
    const button = screen.getByRole("button", { name: "Flag Turnaround Priority" });
    expect(button).not.toHaveAttribute("aria-disabled", "true");
    expect(events).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(events).toHaveBeenCalledExactlyOnceWith({
      type: "FLAG_REFERRAL_TURNAROUND_PRIORITY",
      role: "coordinator",
      now,
      referralId: f.referral.id,
      unitId: f.unitId,
      source: "cld",
    });
    expect(screen.getByRole("button", { name: "Flag Turnaround Priority" })).toHaveAccessibleDescription(
      "Turnaround preference already recorded for this unit.",
    );
    expect(screen.getByText(/Turnaround preference recorded for Criteria-Led Discharge/)).toBeVisible();
  });

  it("shows turnaround refusals on the phone sheet without claiming success", () => {
    const f = fixture();
    renderFixture(f, { phone: true, reject: true });
    fireEvent.click(screen.getByRole("button", { name: "Flag Turnaround Priority" }));
    expect(screen.getByTestId("ward-turnaround-rejection")).toHaveTextContent(
      "Synthetic readiness changed; review the unit.",
    );
    expect(screen.queryByText(/Turnaround preference recorded/)).not.toBeInTheDocument();
  });

  it("uses the linked waiting movement and never dispatches a referral fallback", () => {
    const f = fixture();
    f.movement.referralId = f.referral.id;
    const events = renderFixture(f);
    fireEvent.click(screen.getByRole("button", { name: "Flag Turnaround Priority" }));
    expect(events.mock.calls.map(([event]) => event)).toEqual([
      {
        type: "FLAG_MOVEMENT_TURNAROUND_PRIORITY",
        role: "coordinator",
        now,
        movementId: f.movement.id,
        unitId: f.unitId,
        source: "cld",
      },
    ]);
  });

  it.each([false, true])("preserves linked movement clinical gates (phone=%s)", (phone) => {
    const f = fixture();
    f.movement.referralId = f.referral.id;
    // The intake says Adult; the linked movement's recorded cohort still controls receiving gates.
    f.movement.cohort = "Youth";
    const events = renderFixture(f, { phone });
    const button = screen.getByRole("button", { name: "Flag Turnaround Priority" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription(/cohort|adult|youth/i);
    fireEvent.click(button);
    expect(events).not.toHaveBeenCalled();
  });

  it.each([false, true])("requires an open request for the receiving unit (phone=%s)", (phone) => {
    const f = fixture();
    f.movement.referralId = f.referral.id;
    const arm = f.referral.destinations[0]!;
    if (arm.destination.kind !== "psychiatric_ward") throw new Error("Expected synthetic ward fixture");
    Object.assign(arm, { withdrawnAt: now });
    const events = renderFixture(f, { phone });
    const button = screen.getByRole("button", { name: "Flag Turnaround Priority" });
    expect(button).toHaveAccessibleDescription(
      "Turnaround preference requires an open request for this receiving unit.",
    );
    fireEvent.click(button);
    expect(events).not.toHaveBeenCalled();
  });

  it.each([
    { phone: false, closed: "declined" },
    { phone: true, closed: "declined" },
    { phone: false, closed: "withdrawn" },
    { phone: true, closed: "withdrawn" },
  ] as const)("referral-only staging refuses a $closed ward arm (phone=$phone)", ({ phone, closed }) => {
    const f = fixture();
    const wardArm = f.referral.destinations[0]!;
    if (closed === "declined") wardArm.state = "declined";
    else wardArm.withdrawnAt = now;
    f.referral.destinations.push({
      destination: { kind: "emergency_department", edId: "rph-ed", purpose: "medical_assessment" },
      state: "queued",
    });
    const events = renderFixture(f, { phone });
    const button = screen.queryByRole("button", { name: "Flag Turnaround Priority" });
    if (closed === "declined") {
      // A decided ward arm leaves only the ED presentation review, which has no bed-staging action.
      expect(button).not.toBeInTheDocument();
    } else {
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAccessibleDescription(
        "Turnaround preference requires an open request for this receiving unit.",
      );
      fireEvent.click(button!);
    }
    expect(events).not.toHaveBeenCalled();
  });

  it.each([false, true])("keeps generic queued ward requests eligible for staging (phone=%s)", (phone) => {
    const f = fixture();
    expect(f.referral.destinations[0]!.destination).not.toHaveProperty("unitId");
    const events = renderFixture(f, { phone });
    fireEvent.click(screen.getByRole("button", { name: "Flag Turnaround Priority" }));
    expect(events).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        type: "FLAG_REFERRAL_TURNAROUND_PRIORITY",
        referralId: f.referral.id,
        unitId: f.unitId,
      }),
    );
    expect(screen.getByRole("button", { name: "Flag Turnaround Priority" })).toHaveAccessibleDescription(
      "Turnaround preference already recorded for this unit.",
    );
  });

  it("names a security-only phone capacity constraint without claiming the count is stale", () => {
    const f = fixture();
    const unit = f.state.units[0]!;
    unit.allocatable.value = 1;
    unit.empty.value = 1;
    const arm = f.referral.destinations[0]!;
    if (arm.destination.kind !== "psychiatric_ward") throw new Error("Expected synthetic ward fixture");
    arm.destination.secureBedNeeded = true;
    renderFixture(f, { phone: true });
    const candidate = screen.getByTestId(`ward-referral-match-phone-cand-${f.unitId}`);
    expect(candidate).toHaveAttribute("data-kind", "nobed");
    expect(within(candidate).getByText("No locked bed free now")).toBeVisible();
    expect(within(candidate).queryByText("Count not current")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Flag Turnaround Priority" })).not.toHaveAttribute("aria-disabled");
  });

  it("allows a confirmed, unblocked occupied-bed departure with CLD disabled", () => {
    flag.cld = false;
    const f = fixture();
    f.state.bedReleases = [
      {
        ...seedWardFlowState().bedReleases[0]!,
        unitId: f.unitId,
        admissionId: f.admission.id,
        state: "confirmed",
        blocker: null,
      },
    ];
    const events = renderFixture(f);
    const button = screen.getByRole("button", { name: "Flag Turnaround Priority" });
    expect(button).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(events).toHaveBeenCalledTimes(1);
    expect(events.mock.calls[0]![0]).toMatchObject({ source: "departure" });
    expect(
      screen.getByText("Turnaround preference recorded for confirmed departure; placement still needs confirmation."),
    ).toBeVisible();
  });

  it("offers staging for a CLD-ready secure unit without a free locked bed, without enabling placement", () => {
    const f = fixture();
    const arm = f.referral.destinations[0]!;
    if (arm.destination.kind !== "psychiatric_ward") throw new Error("Expected synthetic ward fixture");
    arm.destination.secureBedNeeded = true;
    const events = renderFixture(f);
    const button = screen.getByRole("button", { name: "Flag Turnaround Priority" });
    expect(button).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("button", { name: /^Accept for/ })).toBeNull();
    fireEvent.click(button);
    expect(events).toHaveBeenCalledTimes(1);
    expect(events.mock.calls[0]![0].type).toBe("FLAG_REFERRAL_TURNAROUND_PRIORITY");
  });

  it.each(["no locked beds", "unauthorised receiving unit"])("does not offer staging for %s", (reason) => {
    const f = fixture();
    const arm = f.referral.destinations[0]!;
    if (arm.destination.kind !== "psychiatric_ward") throw new Error("Expected synthetic ward fixture");
    arm.destination.secureBedNeeded = true;
    if (reason === "no locked beds") f.state.units[0]!.lockedBeds = 0;
    else {
      arm.destination.involuntaryBedNeeded = true;
      f.state.units[0]!.authorised = false;
    }
    renderFixture(f);
    expect(screen.queryByRole("button", { name: "Flag Turnaround Priority" })).toBeNull();
  });

  it.each(["no criteria", "expired criteria", "CLD disabled", "placed movement"])(
    "explains unavailable %s without dispatching",
    (reason) => {
      const f = fixture();
      if (reason === "no criteria") f.admission.dischargeCriteria = null;
      if (reason === "expired criteria")
        f.admission.dischargeCriteria!.setAt = now - CLINICAL_VALUES.dischargeCriteriaValidity.value;
      if (reason === "CLD disabled") flag.cld = false;
      if (reason === "placed movement") {
        f.movement.referralId = f.referral.id;
        f.movement.acceptedUnitId = f.unitId;
      }
      const events = renderFixture(f);
      const button = screen.getByRole("button", { name: "Flag Turnaround Priority" });
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAccessibleDescription(
        reason === "placed movement"
          ? "Turnaround preference requires a waiting, unplaced movement."
          : "No current CLD-ready admission or unblocked confirmed departure on this unit.",
      );
      fireEvent.click(button);
      expect(events).not.toHaveBeenCalled();
    },
  );

  it("shows reducer refusal without claiming a recorded preference", () => {
    const f = fixture();
    f.state.rejections = [
      {
        id: "prior-synthetic-refusal",
        movementId: f.referral.id,
        at: now,
        attempted: "FLAG_REFERRAL_TURNAROUND_PRIORITY",
        reason: "Old synthetic rejection",
      },
    ];
    renderFixture(f, { reject: true });
    fireEvent.click(screen.getByRole("button", { name: "Flag Turnaround Priority" }));
    expect(screen.getByTestId("ward-turnaround-rejection")).toHaveTextContent(
      "Synthetic readiness changed; review the unit.",
    );
    expect(screen.queryByText(/Turnaround preference recorded/)).not.toBeInTheDocument();
  });
});

describe("live turnaround queue badges", () => {
  it("shows the CLD source for both movement and unlinked-referral queue rows", () => {
    const f = fixture();
    const preference = { unitId: f.unitId, source: "cld" as const, flaggedAt: now };
    f.movement.turnaroundPriority = preference;
    f.referral.turnaroundPriority = preference;
    renderFixture(f, { queue: true });
    expect(within(screen.getByTestId(`ward-queue-row-${f.movement.id}`)).getByText(cldBadge)).toBeVisible();
    fireEvent.click(screen.getByRole("radio", { name: /Referrals/ }));
    expect(within(screen.getByTestId(`ward-referral-row-${f.referral.id}`)).getByText(cldBadge)).toBeVisible();
  });

  it("labels a confirmed departure truthfully", () => {
    const f = fixture();
    f.admission.dischargeCriteria = null;
    f.state.bedReleases = [
      {
        ...seedWardFlowState().bedReleases[0]!,
        unitId: f.unitId,
        admissionId: f.admission.id,
        state: "confirmed",
        blocker: null,
      },
    ];
    f.movement.turnaroundPriority = { unitId: f.unitId, source: "departure", flaggedAt: now };
    renderFixture(f, { queue: true });
    expect(screen.getByText(departureBadge)).toBeVisible();
    expect(screen.queryByText(cldBadge)).not.toBeInTheDocument();
  });

  it.each(["expired", "disabled", "placed"])("hides %s CLD movement preferences", (reason) => {
    const f = fixture();
    f.movement.turnaroundPriority = { unitId: f.unitId, source: "cld", flaggedAt: now };
    if (reason === "expired") f.state.clockOffsetMinutes += CLINICAL_VALUES.dischargeCriteriaValidity.value;
    if (reason === "disabled") flag.cld = false;
    if (reason === "placed") f.movement.acceptedUnitId = f.unitId;
    renderFixture(f, { queue: true });
    expect(screen.queryByText(cldBadge)).not.toBeInTheDocument();
  });

  it("hides superseded referral preferences once a linked movement exists", () => {
    const f = fixture();
    f.referral.turnaroundPriority = { unitId: f.unitId, source: "cld", flaggedAt: now };
    f.movement.referralId = f.referral.id;
    renderFixture(f, { queue: true });
    fireEvent.click(screen.getByRole("radio", { name: /Referrals/ }));
    expect(screen.queryByText(cldBadge)).not.toBeInTheDocument();
  });
});

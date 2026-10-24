import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlannedAdmissionsPanel } from "@/components/ward-management/capacity/planned-admissions-panel";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { patientDisplayName } from "@/components/ward-management/ward-patients";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const selected = vi.hoisted(() => ({
  value: undefined as unknown as ReturnType<typeof seedWardFlowStateAt> & {
    dayZero: Date;
    dispatch: () => void;
    shared: { enabled: boolean };
  },
}));

vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>()),
  useWardFlowSelect: () => selected.value,
  useOptionalWardFlowSelect: () => selected.value,
}));

describe("planned admission chooser work", () => {
  it("keeps choices current when alternating record snapshots with the same patient registry", () => {
    const seed = seedWardFlowStateAt(0);
    const base = {
      ...seed,
      dayZero: new Date("2026-10-24T00:00:00+08:00"),
      dispatch: vi.fn(),
      shared: { enabled: false },
    };
    selected.value = base;
    const view = render(<PlannedAdmissionsPanel now={NOW_ANCHOR} />);
    fireEvent.click(screen.getByTestId("ward-planned-book"));
    const choices = () =>
      within(screen.getByTestId("ward-planned-patient"))
        .getAllByRole("option")
        .map((option) => (option as HTMLOptionElement).value);
    const original = choices();
    const chosen = original[0];
    expect(original.length).toBeGreaterThan(1);
    const openMovement = seed.movements.find(isOpen)!;
    expect(openMovement).toBeDefined();
    const booked = seed.plannedAdmissions.find((booking) => booking.state === "booked")!;
    expect(booked).toBeDefined();
    const blockedSnapshots = [
      {
        ...base,
        admissions: [
          ...seed.admissions,
          {
            ...seed.admissions[0],
            patientId: chosen as (typeof seed.patients)[number]["id"],
            state: "occupied" as const,
          },
        ],
      },
      {
        ...base,
        movements: [...seed.movements, { ...openMovement, patientId: chosen as (typeof seed.patients)[number]["id"] }],
      },
      {
        ...base,
        plannedAdmissions: [
          ...seed.plannedAdmissions,
          { ...booked, patientId: chosen as (typeof seed.patients)[number]["id"] },
        ],
      },
    ];
    const probe = vi.spyOn(base.patients, "filter");
    for (const blocked of blockedSnapshots) {
      selected.value = blocked;
      view.rerender(<PlannedAdmissionsPanel now={NOW_ANCHOR} />);
      expect(choices()).toEqual(original.slice(1));
      selected.value = base;
      view.rerender(<PlannedAdmissionsPanel now={NOW_ANCHOR} />);
      expect(choices()).toEqual(original);
    }
    // Each changed combination recomputes once; returning to another world cannot reuse its exclusions.
    expect(probe).toHaveBeenCalledTimes(6);
  });

  it("retains the initials-only default when no existing patient can be booked", () => {
    selected.value = {
      ...seedWardFlowStateAt(0),
      patients: [],
      dayZero: new Date("2026-10-24T00:00:00+08:00"),
      dispatch: vi.fn(),
      shared: { enabled: false },
    };
    const probe = vi.spyOn(selected.value.patients, "filter");
    render(<PlannedAdmissionsPanel now={NOW_ANCHOR} />);
    expect(probe).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("ward-planned-book"));
    expect(screen.getByTestId("ward-planned-who")).toHaveValue("initials");
    expect(screen.queryByTestId("ward-planned-patient")).toBeNull();
    expect(
      within(screen.getByTestId("ward-planned-who")).getByRole("option", { name: "Existing patient" }),
    ).toBeDisabled();
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("derives current choices only when booking, retaining the same defaults, options and draft", () => {
    const seed = seedWardFlowStateAt(0);
    selected.value = {
      ...seed,
      dayZero: new Date("2026-10-24T00:00:00+08:00"),
      dispatch: vi.fn(),
      shared: { enabled: false },
    };
    // Count the chooser's patient-array filter, rather than renders or unrelated identity labels.
    const probes = [vi.spyOn(selected.value.patients, "filter")];
    const passes = () => probes.reduce((sum, probe) => sum + probe.mock.calls.length, 0);
    const counts: Record<string, number> = {};
    const view = render(<PlannedAdmissionsPanel now={NOW_ANCHOR} />);
    const panel = screen.getByTestId("ward-capacity-planned-admissions");
    counts.closedMount = passes();
    view.rerender(<PlannedAdmissionsPanel now={NOW_ANCHOR + 1} />);
    counts.clockOnly = passes() - counts.closedMount;

    for (const field of ["admissions", "movements", "plannedAdmissions"] as const) {
      selected.value = { ...selected.value, [field]: [...selected.value[field]] };
      view.rerender(<PlannedAdmissionsPanel now={NOW_ANCHOR + 1} />);
    }
    selected.value = { ...selected.value, patients: [...selected.value.patients] };
    probes.push(vi.spyOn(selected.value.patients, "filter"));
    view.rerender(<PlannedAdmissionsPanel now={NOW_ANCHOR + 1} />);
    counts.closedDependencyUpdates = passes() - counts.closedMount - counts.clockOnly;
    expect(screen.getByTestId("ward-capacity-planned-admissions")).toBe(panel);

    const beforeChange = passes();
    fireEvent.click(within(screen.getByTestId("ward-planned-PA-SEED-03")).getByRole("button", { name: "Change" }));
    selected.value = { ...selected.value, admissions: [...selected.value.admissions] };
    view.rerender(<PlannedAdmissionsPanel now={NOW_ANCHOR + 1} />);
    counts.changeForm = passes() - beforeChange;
    fireEvent.click(within(screen.getByTestId("ward-planned-form")).getAllByRole("button", { name: "Close" })[0]);

    const beforeCancel = passes();
    fireEvent.click(within(screen.getByTestId("ward-planned-PA-SEED-03")).getByRole("button", { name: "Cancel" }));
    selected.value = { ...selected.value, movements: [...selected.value.movements] };
    view.rerender(<PlannedAdmissionsPanel now={NOW_ANCHOR + 1} />);
    counts.cancelForm = passes() - beforeCancel;
    fireEvent.click(within(screen.getByTestId("ward-planned-cancel")).getAllByRole("button", { name: "Close" })[0]);

    // Independent expected list: preserve existing admission, movement and booking exclusions and order.
    const busy = new Set([
      ...selected.value.admissions
        .filter((stay) => stay.state === "pulled" || stay.state === "occupied")
        .map((stay) => stay.patientId),
      ...selected.value.movements.filter(isOpen).map((movement) => movement.patientId),
      ...selected.value.plannedAdmissions
        .filter((booking) => booking.state === "booked")
        .map((booking) => booking.patientId),
    ]);
    const expected = [...selected.value.patients]
      .filter((patient) => !busy.has(patient.id))
      .sort((a, b) => patientDisplayName(a).localeCompare(patientDisplayName(b)));
    expect(expected.length).toBeGreaterThan(1);
    const beforeBook = passes();
    fireEvent.click(screen.getByTestId("ward-planned-book"));
    const chooser = screen.getByTestId("ward-planned-patient");
    expect(screen.getByTestId("ward-planned-who")).toHaveValue("patient");
    expect(chooser).toHaveValue(expected[0].id);
    expect(
      within(chooser)
        .getAllByRole("option")
        .map((option) => (option as HTMLOptionElement).value),
    ).toEqual(expected.map((patient) => patient.id));
    counts.openBook = passes() - beforeBook;
    fireEvent.change(screen.getByTestId("ward-planned-stay"), { target: { value: "9" } });
    counts.draftEdit = passes() - beforeBook - counts.openBook;
    const chosen = expected[0].id;
    const beforeLiveUpdate = passes();
    selected.value = {
      ...selected.value,
      patients: selected.value.patients.filter((patient) => patient.id !== chosen),
    };
    // Exclude the fixture setup's own filter from the measured component delta.
    const fixturePasses = passes() - beforeLiveUpdate;
    probes.push(vi.spyOn(selected.value.patients, "filter"));
    view.rerender(<PlannedAdmissionsPanel now={NOW_ANCHOR + 1} />);
    counts.openDependencyUpdate = passes() - beforeLiveUpdate - fixturePasses;
    expect(
      within(screen.getByTestId("ward-planned-patient"))
        .getAllByRole("option")
        .map((option) => (option as HTMLOptionElement).value),
    ).toEqual(expected.slice(1).map((patient) => patient.id));
    expect(screen.getByTestId("ward-planned-stay")).toHaveValue(9);
    expect(screen.getByTestId("ward-capacity-planned-admissions")).toBe(panel);
    // Numeric evidence only; this is uncompiled component work, not production timing or INP.
    console.info("planned-chooser-filter-passes", JSON.stringify({ patients: seed.patients.length, ...counts }));
    expect(counts).toEqual({
      closedMount: 0,
      clockOnly: 0,
      closedDependencyUpdates: 0,
      changeForm: 0,
      cancelForm: 0,
      openBook: 1,
      draftEdit: 0,
      openDependencyUpdate: 1,
    });
  });
});

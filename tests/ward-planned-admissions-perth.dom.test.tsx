import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlannedAdmissionsPanel } from "@/components/ward-management/capacity/planned-admissions-panel";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { perthMidnight } from "@/components/ward-management/ward-clock";

afterEach(() => vi.unstubAllEnvs());

describe.each(["Australia/Sydney", "America/New_York"])("planned booking form on a %s browser", (zone) => {
  it.each([
    ["2001-10-17", 0, "21:30", "Youth"],
    ["1961-10-17", 1, "00:00", "Older adult"],
  ] as const)("sends the Perth calendar and cohort for DOB %s", (dob, offset, time, ageBand) => {
    vi.stubEnv("TZ", zone);
    const dispatch = vi.fn();
    function Panel() {
      const world = useWardFlow();
      const patient = { ...world.patients.find((p) => p.id === "PT-002")!, dateOfBirth: dob };
      return (
        <WardFlowOverride
          value={{
            ...world,
            patients: [patient],
            admissions: [],
            movements: [],
            plannedAdmissions: [],
            dayZero: perthMidnight(2026, 9, 16),
            dispatch,
          }}
        >
          <PlannedAdmissionsPanel now={1275} />
        </WardFlowOverride>
      );
    }
    render(
      <WardFlowProvider initialNow={1275}>
        <Panel />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-planned-book"));
    // WT-13: the patient, reason, ward and legal status open blank and are chosen.
    for (const id of ["ward-planned-patient", "ward-planned-reason", "ward-planned-unit", "ward-planned-legal"]) {
      const select = screen.getByTestId(id) as HTMLSelectElement;
      const first = Array.from(select.options).find((option) => option.value !== "" && !option.disabled)!;
      fireEvent.change(select, { target: { value: first.value } });
    }
    fireEvent.change(screen.getByTestId("ward-planned-day"), { target: { value: String(offset) } });
    fireEvent.change(screen.getByTestId("ward-planned-time"), { target: { value: time } });
    fireEvent.click(screen.getByTestId("ward-planned-submit"));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "BOOK_PLANNED_ADMISSION", calendarDate: "2026-10-16", ageBand }),
    );
  });
});

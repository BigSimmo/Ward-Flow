import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { CRITERIA_VOLUNTARY_ONLY } from "@/components/ward-management/ward-discharge-criteria";
import { WardDischargeCriteriaCard } from "@/components/ward-management/ward/ward-discharge-criteria-card";

// Top 25 item 9 (D-60): the criteria card on the bed panel's Plan to leave tab.

import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

const NOW = 10_000;
const RECORD = {
  setAt: NOW - 60,
  items: [
    { criterion: "Accommodation confirmed" as const, metAt: NOW - 30 },
    { criterion: "Transport home arranged" as const, metAt: null },
  ],
};

afterEach(cleanup);

describe("criteria led discharge card", () => {
  it("sets criteria only once the treating psychiatrist is confirmed", () => {
    const onChange = vi.fn().mockReturnValue({ commandId: "criteria", status: "accepted" });
    render(<WardDischargeCriteriaCard record={null} eligibility="voluntary" now={NOW} onChange={onChange} />);
    expect(screen.getByTestId("ward-drawer-criteria-status")).toHaveTextContent(
      "No criteria set by the treating psychiatrist.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Set criteria" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Accommodation confirmed" }));
    const save = screen.getByRole("button", { name: "Save criteria" });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Set by the treating psychiatrist" }));
    // D-64: the patient must also have been told (WACHS CLD guideline s 2.2).
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Patient told they are on criteria led discharge" }));
    fireEvent.click(save);
    expect(onChange).toHaveBeenCalledWith({
      criteria: ["Accommodation confirmed"],
      met: [],
      setByTreatingPsychiatrist: true,
    });
  });

  it("ticks a criterion met and says when all are met", () => {
    const onChange = vi.fn().mockReturnValue({ commandId: "criteria", status: "accepted" });
    const { rerender } = render(
      <WardDischargeCriteriaCard record={RECORD} eligibility="voluntary" now={NOW} onChange={onChange} />,
    );
    expect(screen.getByTestId("ward-drawer-criteria-status")).toHaveTextContent(/^1 of 2 met\. Review needed after/);
    // D-64: when each tick was made, and what to do if a criterion cannot be met.
    expect(screen.getAllByText(/^Ticked /)).toHaveLength(1);
    expect(screen.getByText(`Ticked ${formatInstantWithDay(NOW - 30, NOW)}`)).toBeInTheDocument();
    expect(screen.getByTestId("ward-drawer-criteria-escalate")).toHaveTextContent(/ask for a medical review/);
    fireEvent.click(screen.getByRole("checkbox", { name: "Transport home arranged" }));
    expect(onChange).toHaveBeenCalledWith({
      criteria: ["Accommodation confirmed", "Transport home arranged"],
      met: ["Accommodation confirmed", "Transport home arranged"],
      setByTreatingPsychiatrist: false,
      tick: { criterion: "Transport home arranged", met: true },
    });
    const allMet = { ...RECORD, items: RECORD.items.map((item) => ({ ...item, metAt: NOW - 10 })) };
    rerender(<WardDischargeCriteriaCard record={allMet} eligibility="voluntary" now={NOW} onChange={onChange} />);
    expect(screen.getByTestId("ward-drawer-criteria-status")).toHaveTextContent(
      "All criteria met. The ward can confirm the discharge without waiting for the next review.",
    );
  });

  it("asks for a review once the criteria lapse, and offers no ticks", () => {
    const later = RECORD.setAt + CLINICAL_VALUES.dischargeCriteriaValidity.value;
    render(<WardDischargeCriteriaCard record={RECORD} eligibility="voluntary" now={later} onChange={vi.fn()} />);
    expect(screen.getByTestId("ward-drawer-criteria-status")).toHaveTextContent(/have lapsed/);
    expect(screen.queryByRole("checkbox")).toBeNull();
    // D-64: a tick from before the lapse no longer reads as a current, green "Met".
    expect(screen.getByText("Met before it lapsed")).toBeInTheDocument();
    expect(screen.queryByText("Met")).toBeNull();
    expect(screen.getByRole("button", { name: "Review criteria" })).toBeInTheDocument();
  });

  it("offers nothing to set for an involuntary patient, and pauses existing criteria", () => {
    const { rerender } = render(
      <WardDischargeCriteriaCard record={null} eligibility="involuntary" now={NOW} onChange={vi.fn()} />,
    );
    expect(screen.getByTestId("ward-drawer-criteria-status")).toHaveTextContent(CRITERIA_VOLUNTARY_ONLY);
    expect(screen.queryByRole("button", { name: "Set criteria" })).toBeNull();
    rerender(<WardDischargeCriteriaCard record={RECORD} eligibility="involuntary" now={NOW} onChange={vi.fn()} />);
    expect(screen.getByTestId("ward-drawer-criteria-status")).toHaveTextContent(/^Paused/);
    expect(screen.queryByRole("checkbox")).toBeNull();
    // Paused criteria still within their validity, so a met item still reads Met.
    expect(screen.getAllByText("Met")).toHaveLength(1);
    expect(screen.queryByText("Met before it lapsed")).toBeNull();
    // Paused and past their validity, the ticks read as lapsed.
    const later = NOW + CLINICAL_VALUES.dischargeCriteriaValidity.value;
    rerender(<WardDischargeCriteriaCard record={RECORD} eligibility="involuntary" now={later} onChange={vi.fn()} />);
    expect(screen.getByText("Met before it lapsed")).toBeInTheDocument();
    expect(screen.queryByText("Met")).toBeNull();
    expect(screen.getByRole("button", { name: "Clear criteria" })).toBeInTheDocument();
  });

  it("is read only for a desk that cannot record criteria", () => {
    render(<WardDischargeCriteriaCard record={RECORD} eligibility="voluntary" now={NOW} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getAllByText("Met")).toHaveLength(1);
  });

  it("adds typed patient specific criteria to the save and marks them on the list (D-65)", () => {
    const onChange = vi.fn().mockReturnValue({ commandId: "criteria", status: "accepted" });
    const { rerender } = render(
      <WardDischargeCriteriaCard record={null} eligibility="voluntary" now={NOW} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Set criteria" }));
    fireEvent.change(screen.getByTestId("ward-drawer-criteria-typed-1"), {
      target: { value: "  Lives with sister until flat repairs done " },
    });
    // A filled row offers the next one, up to the set number.
    expect(screen.getByTestId("ward-drawer-criteria-typed-2")).toHaveValue("");
    fireEvent.click(screen.getByRole("checkbox", { name: "Set by the treating psychiatrist" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Patient told they are on criteria led discharge" }));
    // Typed criteria alone are enough to save.
    fireEvent.click(screen.getByRole("button", { name: "Save criteria" }));
    expect(onChange).toHaveBeenCalledWith({
      criteria: [],
      met: [],
      setByTreatingPsychiatrist: true,
      patientSpecific: ["Lives with sister until flat repairs done"],
    });
    const record = {
      setAt: NOW - 60,
      items: [{ criterion: "Lives with sister until flat repairs done", metAt: null, patientSpecific: true as const }],
    };
    rerender(<WardDischargeCriteriaCard record={record} eligibility="voluntary" now={NOW} onChange={onChange} />);
    expect(screen.getByText("Patient specific")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Lives with sister until flat repairs done" }));
    expect(onChange).toHaveBeenLastCalledWith({
      criteria: ["Lives with sister until flat repairs done"],
      met: ["Lives with sister until flat repairs done"],
      setByTreatingPsychiatrist: false,
      tick: { criterion: "Lives with sister until flat repairs done", met: true },
    });
  });
  it("keeps each typed row in place when one is cleared, and refuses a repeat (D-65)", () => {
    const onChange = vi.fn().mockReturnValue({ commandId: "criteria", status: "accepted" });
    render(<WardDischargeCriteriaCard record={null} eligibility="voluntary" now={NOW} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Set criteria" }));
    const row = (n: number) => screen.getByTestId(`ward-drawer-criteria-typed-${n}`);
    fireEvent.change(row(1), { target: { value: "Walks to the shop with staff" } });
    fireEvent.change(row(2), { target: { value: "Sleeping six hours" } });
    fireEvent.change(row(1), { target: { value: "" } });
    expect(row(1)).toHaveValue("");
    expect(row(2)).toHaveValue("Sleeping six hours");
    fireEvent.change(row(1), { target: { value: "Sleeping six hours" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Set by the treating psychiatrist" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Patient told they are on criteria led discharge" }));
    expect(screen.getByRole("button", { name: "Save criteria" })).toBeDisabled();
    expect(screen.getByTestId("ward-drawer-criteria-typed-repeat")).toBeInTheDocument();
    fireEvent.change(row(1), { target: { value: "Accommodation confirmed" } });
    expect(screen.getByRole("button", { name: "Save criteria" })).toBeDisabled();
    fireEvent.change(row(1), { target: { value: "Walks to the shop with staff" } });
    fireEvent.click(screen.getByRole("button", { name: "Save criteria" }));
    expect(onChange).toHaveBeenCalledWith({
      criteria: [],
      met: [],
      setByTreatingPsychiatrist: true,
      patientSpecific: ["Walks to the shop with staff", "Sleeping six hours"],
    });
  });
});

describe("criteria save confirmation (WF-026)", () => {
  function draft() {
    fireEvent.click(screen.getByRole("button", { name: "Set criteria" }));
    fireEvent.change(screen.getByTestId("ward-drawer-criteria-typed-1"), {
      target: { value: "Synthetic typed draft" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Set by the treating psychiatrist" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Patient told they are on criteria led discharge" }));
  }
  function pending() {
    let finish!: (outcome: WardCommandOutcome) => void;
    const promise = new Promise<WardCommandOutcome>((resolve) => {
      finish = resolve;
    });
    const onChange = vi.fn(() => promise);
    render(<WardDischargeCriteriaCard record={null} eligibility="voluntary" now={NOW} onChange={onChange} />);
    draft();
    fireEvent.click(screen.getByRole("button", { name: "Save criteria" }));
    expect(screen.getByTestId("ward-drawer-criteria-typed-1")).toHaveValue("Synthetic typed draft");
    expect(screen.getByRole("button", { name: "Saving criteria…" })).toBeDisabled();
    return { finish, promise, onChange };
  }
  it.each(["refused", "failed", "cancelled"] as const)(
    "keeps the exact typed draft when the save is %s",
    async (status) => {
      const { finish, promise } = pending();
      await act(async () => {
        finish({ commandId: "criteria", status, message: "Synthetic save outcome" });
        await promise;
      });
      expect(screen.getByTestId("ward-drawer-criteria-typed-1")).toHaveValue("Synthetic typed draft");
      expect(screen.getByRole("alert")).toHaveTextContent("Synthetic save outcome");
      expect(screen.getByRole("button", { name: "Save criteria" })).toBeEnabled();
    },
  );
  it("closes only after confirmation of the submitted draft", async () => {
    const { finish, promise, onChange } = pending();
    expect(onChange).toHaveBeenCalledOnce();
    await act(async () => {
      finish({ commandId: "criteria", status: "accepted" });
      await promise;
    });
    expect(screen.queryByTestId("ward-drawer-criteria-typed-1")).not.toBeInTheDocument();
  });
  it.each(["edit", "reopen"])("does not close a newer draft after %s", async (action) => {
    const { finish, promise } = pending();
    if (action === "reopen") {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      draft();
    }
    fireEvent.change(screen.getByTestId("ward-drawer-criteria-typed-1"), {
      target: { value: "Newer synthetic draft" },
    });
    await act(async () => {
      finish({ commandId: "criteria", status: "accepted" });
      await promise;
    });
    expect(screen.getByTestId("ward-drawer-criteria-typed-1")).toHaveValue("Newer synthetic draft");
  });
  it("keeps the draft and exposes a save error when the callback rejects", async () => {
    render(
      <WardDischargeCriteriaCard
        record={null}
        eligibility="voluntary"
        now={NOW}
        onChange={() => Promise.reject(new Error("offline"))}
      />,
    );
    draft();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save criteria" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("not confirmed saved");
    expect(screen.getByTestId("ward-drawer-criteria-typed-1")).toHaveValue("Synthetic typed draft");
  });
});

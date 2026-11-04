import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PatientWardChangeCard } from "@/components/ward-management/patients/patient-ward-change-card";

const reason = "Read only. Ask the owning ward to record this change.";
describe("ward change form authority", () => {
  it.each(["leave", "discharge"] as const)("refuses a %s form left open when authority changes", (form) => {
    const save = vi.fn();
    const props = {
      now: 0,
      dayZero: new Date("2026-10-07T00:00:00Z"),
      form,
      onFormChange: vi.fn(),
      onRecordLeave: save,
      onGoneToEd: save,
      onSaveDischarge: save,
      roleLimit: () => undefined as string | undefined,
    };
    const { rerender } = render(<PatientWardChangeCard {...props} />);
    fireEvent.change(screen.getByLabelText(form === "leave" ? "Expected back time" : "Expected discharge time"), {
      target: { value: "16:00" },
    });
    const submit = screen.getByRole("button", { name: form === "leave" ? "Record leave" : "Save date" });
    expect(submit).toBeEnabled();
    rerender(<PatientWardChangeCard {...props} roleLimit={() => reason} />);
    expect(submit).toBeDisabled();
    expect(screen.getByRole("button", { name: "Start leave" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Gone to ED" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Discharge date" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.submit(screen.getByRole("form", { name: form === "leave" ? "Start leave" : "Set discharge date" }));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(reason);
  });
  it("still saves an authorised leave form", () => {
    const save = vi.fn();
    render(
      <PatientWardChangeCard
        now={0}
        dayZero={new Date("2026-10-07T00:00:00Z")}
        form="leave"
        onFormChange={vi.fn()}
        onRecordLeave={save}
        onGoneToEd={vi.fn()}
        onSaveDischarge={vi.fn()}
        roleLimit={() => undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText("Expected back time"), { target: { value: "16:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Record leave" }));
    expect(save).toHaveBeenCalledWith(960, "off_ward", undefined);
  });
});

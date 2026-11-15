import { fireEvent, screen } from "@testing-library/react";

/** Chooses `value` in a kit list picker on the Record a form sheet (Patient or Form type). Empty clears it. */
export function pickRecordField(label: "Patient" | "Form type", value: string): void {
  fireEvent.click(screen.getByRole("combobox", { name: new RegExp(`^${label}`, "u") }));
  if (value === "") {
    fireEvent.click(screen.getByText("Clear"));
    return;
  }
  const option = document.querySelector(`[role="option"][data-value="${value}"]`);
  if (!option) throw new Error(`No ${label} option ${value}`);
  fireEvent.click(option);
}

/** The picker field's chosen value (the hidden input the kit picker carries). */
export function recordFieldValue(label: "Patient" | "Form type"): string {
  const name = label === "Patient" ? "record-patient" : "record-form-type";
  return (document.querySelector(`input[name="${name}"]`) as HTMLInputElement | null)?.value ?? "";
}

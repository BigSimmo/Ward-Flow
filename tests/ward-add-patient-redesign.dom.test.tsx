import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/new",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { AddPatientForm } from "@/components/ward-management/patients/add-patient";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Synthetic records only (seeded demo patients); nothing here is a real person. */
function renderForm() {
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AddPatientForm />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

// Redesign approved 31 Oct 2026 (mock-up 30 Oct): the duplicate check sits under the identity
// fields, the finish line says what is still needed, and nothing starts chosen.
describe("Add a patient redesign", () => {
  it("runs the duplicate check inside the identity form, under the fields, with one quiet line before typing", () => {
    renderForm();
    const form = screen.getByTestId("ward-add-patient-form");
    const check = within(form).getByTestId("ward-add-patient-duplicate-check");
    expect(check).toHaveTextContent("Runs as you type: a UMRN, or a name of 4 letters or more.");
    expect(screen.getByRole("complementary", { name: "Recently added records" })).not.toContainElement(check);
  });

  it("names what is still needed beside the greyed Add patient button, in field order", () => {
    renderForm();
    const needed = screen.getByTestId("ward-add-patient-unavailable");
    expect(needed).toHaveTextContent("Needed: UMRN, date of birth, given and family name");
    fireEvent.change(screen.getByLabelText(/Record number|UMRN/i), { target: { value: "UM999999" } });
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Testable" } });
    expect(needed).toHaveTextContent("Needed: date of birth, family name");
  });

  it("takes the birth date as DD/MM/YYYY and clears a half-typed date on reset", () => {
    renderForm();
    const born = screen.getByLabelText("Date of birth") as HTMLInputElement;
    fireEvent.change(born, { target: { value: "01/01/19" } });
    expect(born.value).toBe("01/01/19");
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Testable" } });
    fireEvent.click(screen.getByTestId("ward-add-patient-reset"));
    fireEvent.click(screen.getByTestId("ward-add-patient-reset-confirm"));
    expect((screen.getByLabelText("Date of birth") as HTMLInputElement).value).toBe("");
  });

  it("starts with no gender and no Aboriginal status chosen", () => {
    renderForm();
    for (const radio of within(screen.getByRole("radiogroup", { name: "Gender" })).getAllByRole("radio")) {
      expect(radio).toHaveAttribute("aria-checked", "false");
    }
    expect(screen.getByLabelText("Aboriginal or Torres Strait Islander")).toHaveValue("");
  });
});

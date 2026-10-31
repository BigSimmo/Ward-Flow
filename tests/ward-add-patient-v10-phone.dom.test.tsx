import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

import { installMatchMediaStub } from "./setup/jsdom.setup";

function renderForm() {
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AddPatientForm />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

describe("Add a patient v10", () => {
  it("shows Added today as a hero fact (seeded patients have no added time, so 0)", () => {
    renderForm();
    expect(screen.getByTestId("ward-add-patient-added-today")).toHaveTextContent("0 added today");
  });

  it("Reset then Undo puts every field back", () => {
    renderForm();
    const given = screen.getByLabelText(/Given name/) as HTMLInputElement;
    fireEvent.change(given, { target: { value: "Testa" } });
    fireEvent.click(screen.getByTestId("ward-add-patient-reset"));
    fireEvent.click(screen.getByTestId("ward-add-patient-reset-confirm"));
    expect((screen.getByLabelText(/Given name/) as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect((screen.getByLabelText(/Given name/) as HTMLInputElement).value).toBe("Testa");
  });

  it("on a phone shows the short identity form straight away, with no larger-screen landing (shell-7)", () => {
    installMatchMediaStub(true);
    try {
      renderForm();
      expect(screen.queryByTestId("ward-add-patient-phone-landing")).not.toBeInTheDocument();
      expect(screen.queryByText("Add a patient needs a larger screen")).not.toBeInTheDocument();
      // Redesign (30 Oct 2026): the hero carries no figure; the Identity card's head holds the count.
      expect(screen.getByTestId("ward-add-patient-phone-hero")).not.toHaveTextContent("0/4");
      expect(screen.getByTestId("ward-add-patient-form")).toHaveTextContent("0 of 4 required");
      expect(screen.getByText("Gender and Aboriginal status")).toBeInTheDocument();
      expect(screen.getByTestId("ward-add-patient-form").closest("main")).toHaveAttribute("data-phone-form", "true");
      expect(screen.getByTestId("ward-add-patient-submit")).toBeInTheDocument();
    } finally {
      installMatchMediaStub(false);
    }
  });
});

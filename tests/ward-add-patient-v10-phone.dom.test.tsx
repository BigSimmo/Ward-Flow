import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/people/new",
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

import { ToastProvider } from "@/components/ui/toast";
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

  it("on a phone opens on search first, and Show the form anyway gives the short identity form", () => {
    installMatchMediaStub(true);
    try {
      renderForm();
      const landing = screen.getByTestId("ward-add-patient-phone-landing");
      const find = within(landing).getByRole("link", { name: /Find an existing patient/ });
      expect(find).toHaveAttribute("href", "/mockups/ward-flow/search");
      expect(screen.getByTestId("ward-add-patient-phone-hero")).toHaveTextContent("0/4");
      fireEvent.click(screen.getByTestId("ward-add-patient-phone-show-form"));
      expect(screen.queryByTestId("ward-add-patient-phone-landing")).not.toBeInTheDocument();
      expect(screen.getByTestId("ward-add-patient-form").closest("main")).toHaveAttribute("data-phone-form", "true");
      expect(screen.getByTestId("ward-add-patient-submit")).toBeInTheDocument();
    } finally {
      installMatchMediaStub(false);
    }
  });
});

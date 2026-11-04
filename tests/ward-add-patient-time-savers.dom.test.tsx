import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn() }),
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

function renderForm() {
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AddPatientForm />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

describe("Add a patient: time savers (search and forms review, 31 Oct 2026)", () => {
  // RF7 (Josh, 3 Nov 2026): surname first, so the cursor starts in Family name.
  it("starts the cursor in the first core field, Family name, on a larger screen", () => {
    renderForm();
    expect(screen.getByTestId("ward-add-patient-family-name")).toHaveFocus();
  });

  it("writes a UMRN as one word in capitals, whatever was typed or pasted", () => {
    renderForm();
    const umrn = screen.getByTestId("ward-add-patient-umrn");
    fireEvent.change(umrn, { target: { value: "um 100 999" } });
    expect(umrn).toHaveValue("UM100999");
  });
});

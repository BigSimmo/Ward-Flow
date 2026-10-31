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
import { calendarDateOf, perthIsoDay, perthMidnight } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// TC2-10 (26 Oct 2026): a demo whose day is well before the computer's date, as a loaded scenario can be.
const DAY_ZERO = perthMidnight(2020, 0, 10);

function renderForm() {
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR} initialDayZero={DAY_ZERO.getTime()}>
        <AddPatientForm />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

describe("Add patient checks a birth date against the demo day (TC2-10)", () => {
  const demoToday = perthIsoDay(calendarDateOf(NOW_ANCHOR, DAY_ZERO));

  it("asks for the birth date as DD/MM/YYYY in the kit's typed date box, not the browser's picker", () => {
    renderForm();
    const box = screen.getByTestId("ward-add-patient-date-of-birth");
    expect(box).toHaveAttribute("type", "text");
    expect(box).toHaveAttribute("placeholder", "DD/MM/YYYY");
  });

  it("says a birth date after the demo day is after today, though it is before the real date", () => {
    renderForm();
    const later = "2021-03-01";
    expect(later > demoToday).toBe(true);
    fireEvent.change(screen.getByTestId("ward-add-patient-date-of-birth"), { target: { value: "01/03/2021" } });
    expect(screen.getByText("The date of birth is after today.")).toBeInTheDocument();
  });

  it("accepts a birth date on or before the demo day", () => {
    renderForm();
    fireEvent.change(screen.getByTestId("ward-add-patient-date-of-birth"), { target: { value: "04/05/1990" } });
    expect(screen.queryByText("The date of birth is after today.")).not.toBeInTheDocument();
  });
});

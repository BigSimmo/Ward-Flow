import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ usePathname: () => "/ward-flow/waiting", useRouter: () => ({ push: vi.fn() }) }));
import { PatientPeekLink } from "@/components/ward-management/patients/patient-peek-link";
import { onPatientPeek } from "@/components/ward-management/shell/patient-peek-bus";

/** D-98 (Josh, 8 Nov 2026): a plain click opens the Patient peek; a new-tab click keeps the page link. */
describe("Patient peek link", () => {
  afterEach(() => cleanup());

  it("opens the peek on a plain click and keeps the href for a new tab", () => {
    const opened: string[] = [];
    const stop = onPatientPeek(({ movementId }) => opened.push(movementId));
    render(
      <PatientPeekLink movementId="m-1" href="/ward-flow/movements/m-1">
        Movement
      </PatientPeekLink>,
    );
    const link = screen.getByRole("link", { name: "Movement" });
    expect(link).toHaveAttribute("href", "/ward-flow/movements/m-1");
    expect(link).toHaveAttribute("aria-haspopup", "dialog");
    act(() => {
      fireEvent.click(link);
    });
    expect(opened).toEqual(["m-1"]);
    act(() => {
      fireEvent.click(link, { ctrlKey: true });
    });
    expect(opened).toEqual(["m-1"]);
    stop();
  });

  it("stays a plain link when there is no movement to peek", () => {
    render(
      <PatientPeekLink movementId={undefined} href="/ward-flow/people/p-1">
        Patient
      </PatientPeekLink>,
    );
    expect(screen.getByRole("link", { name: "Patient" })).not.toHaveAttribute("aria-haspopup");
  });
});

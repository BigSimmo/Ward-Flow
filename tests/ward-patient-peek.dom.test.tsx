import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const route = vi.hoisted(() => ({ path: "/ward-flow/waiting" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/dynamic", () => ({
  default: () =>
    function PeekSheetStub({ movementId }: { movementId: string }) {
      return <div data-testid="peek-sheet">{movementId}</div>;
    },
}));
import { PatientPeekHost } from "@/components/ward-management/patients/patient-peek-host";
import { PatientPeekLink } from "@/components/ward-management/patients/patient-peek-link";
import { onPatientPeek, openPatientPeek } from "@/components/ward-management/shell/patient-peek-bus";

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

/** Review finding on #1549: "Open full Patient page" must not leave the peek open over the new page. */
describe("Patient peek host", () => {
  afterEach(() => {
    cleanup();
    route.path = "/ward-flow/waiting";
  });

  it("closes the peek when the route changes", () => {
    const { rerender } = render(<PatientPeekHost />);
    act(() => openPatientPeek("m-1"));
    expect(screen.getByTestId("peek-sheet")).toHaveTextContent("m-1");
    route.path = "/ward-flow/movements/m-1";
    rerender(<PatientPeekHost />);
    expect(screen.queryByTestId("peek-sheet")).toBeNull();
  });
});

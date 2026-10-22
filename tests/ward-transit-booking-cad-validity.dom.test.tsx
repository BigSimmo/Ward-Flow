import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { GENDER_PLACEMENT_REASONS } from "@/components/ward-management/ward-change-reasons";
import { ToastProvider } from "@/components/wf";

/**
 * Visual desk check of #550 (21 Oct 2026): on the patient transit form, Save with "TBC" in the CAD
 * field did nothing and said nothing. The field now fails the browser's own required check, so Save
 * stops at the field with the reason, the same way a blank required field does.
 */

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  usePathname: () => "/ward-flow/people/WF-012",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

function CadProbe() {
  const { movements } = useWardFlow();
  return <output data-testid="live-cad">{movements.find((m) => m.id === "WF-012")!.transport?.cadNumber}</output>;
}

function openBookingForm() {
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen movementId="WF-012" />
        <CadProbe />
      </WardFlowProvider>
    </ToastProvider>,
  );
  fireEvent.click(within(screen.getByTestId("ward-patient-gate-bed")).getByRole("button"));
  const shortlist = screen.getByRole("region", { name: "Ask wards" });
  fireEvent.click(
    within(shortlist)
      .getAllByRole("checkbox", { checked: false })
      .find((box) => !box.hasAttribute("disabled"))!,
  );
  fireEvent.change(screen.getByLabelText("Ward placement reason"), { target: { value: GENDER_PLACEMENT_REASONS[0] } });
  fireEvent.click(screen.getByLabelText("Placement checked with the ward"));
  fireEvent.click(screen.getByRole("button", { name: "Ask 1 ward" }));
  fireEvent.click(screen.getByRole("button", { name: /^Accept bed at / }));
  // The step's wording is moving from "Hold" to "Pull" (UX audit item 5); either opens the form.
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^(Hold|Pull) the bed$/ }));
  fireEvent.click(screen.getByRole("button", { name: "Record transport booking" }));
  fireEvent.change(screen.getByLabelText("Transport provider"), { target: { value: "Ambulance service" } });
  fireEvent.change(screen.getByLabelText("Quoted ETA (minutes from now)"), { target: { value: "45" } });
  fireEvent.change(screen.getByLabelText("Transport legal status"), { target: { value: "involuntary" } });
  fireEvent.change(screen.getByLabelText("Clinical escort required?"), { target: { value: "yes" } });
}

describe("patient transit booking CAD field", () => {
  it("fails the browser check with the reason for a placeholder, and clears once a number is typed", () => {
    openBookingForm();
    const cad = () => screen.getByLabelText("CAD number") as HTMLInputElement;

    fireEvent.change(cad(), { target: { value: "TBC" } });
    expect(cad().validity.valid).toBe(false);
    expect(cad().validationMessage).toBe(
      "To save, the CAD number looks like a placeholder, so enter the number the provider gave.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Save booking" }));
    expect(screen.getByTestId("live-cad")).toBeEmptyDOMElement();

    // Closing keeps the typed number, so the reopened field must still fail the check.
    fireEvent.click(screen.getByRole("button", { name: "Close booking form" }));
    fireEvent.click(screen.getByRole("button", { name: "Record transport booking" }));
    expect(cad().validity.valid).toBe(false);

    fireEvent.change(cad(), { target: { value: "CAD-2026-1234" } });
    expect(cad().validity.valid).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Save booking" }));
    expect(screen.getByTestId("live-cad")).toHaveTextContent("CAD-2026-1234");
  });
});

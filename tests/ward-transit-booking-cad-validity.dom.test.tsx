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
 * field did nothing and said nothing. Since A34 (26 Oct 2026) the transit deck uses the one transport
 * booking form: a refused number is named beside the field, and Save stays unavailable with the reason.
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
  fireEvent.change(screen.getByTestId("ward-transit-transport-provider-WF-012"), {
    target: { value: "Ambulance service" },
  });
  fireEvent.click(within(screen.getByRole("group", { name: "Quick times" })).getByRole("button", { name: "+30m" }));
  fireEvent.click(screen.getByTestId("ward-transit-transport-legal-involuntary-WF-012"));
  fireEvent.click(screen.getByTestId("ward-transit-transport-escort-yes-WF-012"));
}

describe("patient transit booking CAD field", () => {
  it("names a placeholder beside the field, keeps Save unavailable, and books once a number is typed", () => {
    openBookingForm();
    const cad = () => screen.getByTestId("ward-transit-transport-cad-WF-012") as HTMLInputElement;
    const save = () => screen.getByTestId("ward-transit-book-transport-confirm-WF-012");

    fireEvent.change(cad(), { target: { value: "TBC" } });
    expect(cad()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("ward-transit-transport-cad-problem-WF-012")).toHaveTextContent(
      "The CAD number looks like a placeholder, so enter the number the provider gave.",
    );
    expect(save()).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(save());
    expect(screen.getByTestId("live-cad")).toBeEmptyDOMElement();

    fireEvent.change(cad(), { target: { value: "CAD-2026-1234" } });
    expect(cad()).not.toHaveAttribute("aria-invalid");
    fireEvent.click(save());
    expect(screen.getByTestId("live-cad")).toHaveTextContent("CAD-2026-1234");
  });
});

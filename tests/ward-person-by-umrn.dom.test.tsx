// shell-6 (13 Oct 2026): a UMRN typed or pasted into /people/ resolves to that person; an unknown
// one says "No one with UMRN X" and hands it to the patient search in memory, never in a URL.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/people/UM999999",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ward-management/patients/patient-now-screen", () => ({
  PatientNowScreen: ({ patientId }: { patientId?: string }) => <p data-testid="patient-now">{patientId}</p>,
}));
vi.mock("@/components/ward-management/patients/person-screen", () => ({
  PersonScreen: ({ patientId }: { patientId: string }) => <p data-testid="person-screen">{patientId}</p>,
}));

import { PersonByUmrn } from "@/components/ward-management/patients/person-by-umrn";
import { takeHandedOffPatientSearchText } from "@/components/ward-management/search/patient-query-handoff";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function renderUmrn(umrn: string) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PersonByUmrn umrn={umrn} governed={false} />
    </WardFlowProvider>,
  );
}

describe("PersonByUmrn", () => {
  it("opens the person whose UMRN is in the address, in any letter case", () => {
    const patient = wardPatients[0];
    renderUmrn(patient.umrn.toLowerCase());
    expect(screen.getByTestId("patient-now")).toHaveTextContent(patient.id);
  });

  it("says no one has an unknown UMRN and links to the search with it filled in", () => {
    renderUmrn("UM999999");
    expect(screen.getByText(/No one with UMRN UM999999\./u)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Search patients for UM999999" });
    // The UMRN never goes into the link; it is handed to the search in memory on click.
    expect(link).toHaveAttribute("href", "/mockups/ward-flow/search");
    fireEvent.click(link);
    expect(takeHandedOffPatientSearchText()).toBe("UM999999");
    expect(screen.queryByText(/is not a person/u)).toBeNull();
  });
});

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/people/PT-028",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function AdmissionProbe({ patientId }: { patientId: string }) {
  const { admissions, leaveBeds } = useWardFlow();
  const admission = admissions.find((item) => item.patientId === patientId && item.state === "occupied");
  return (
    <>
      <output data-testid="probe-awol">{String(admission?.absentWithoutLeaveSince ?? "none")}</output>
      <output data-testid="probe-ed">{String(admission?.awayAtEmergencyDepartmentSince ?? "none")}</output>
      <output data-testid="probe-leave">{leaveBeds.filter((bed) => bed.admissionId === admission?.id).length}</output>
    </>
  );
}

function setup(patientId: string) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PatientNowScreen patientId={patientId} />
      <AdmissionProbe patientId={patientId} />
    </WardFlowProvider>,
  );
}

const status = () => screen.getByTestId("ward-patient-status-card");
const pill = () => screen.getByTestId("ward-patient-state-pill");

describe("the Gate board modes (Josh, 9 Oct 2026)", () => {
  it("shows a patient in an occupied bed as on the ward, with discharge readiness and no placement controls", () => {
    setup("PT-028");
    expect(status()).toHaveAttribute("data-mode", "ward");
    expect(pill()).toHaveTextContent("On ward");
    expect(screen.getByRole("heading", { name: "Discharge readiness" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Place them" })).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-person-open-ward")).toHaveAttribute(
      "href",
      expect.stringContaining("/mockups/ward-flow/ward/"),
    );
  });

  it("records absent without leave and the return through the engine", () => {
    setup("PT-028");
    fireEvent.click(screen.getByRole("button", { name: "Absent without leave" }));
    expect(screen.getByTestId("probe-awol")).toHaveTextContent(String(NOW_ANCHOR));
    expect(status()).toHaveAttribute("data-mode", "awol");
    expect(pill()).toHaveTextContent("Absent without leave");
    expect(within(status()).getByText("Search the ward and grounds")).toBeInTheDocument();
    fireEvent.click(within(status()).getByRole("button", { name: "Record return" }));
    expect(screen.getByTestId("probe-awol")).toHaveTextContent("none");
    expect(status()).toHaveAttribute("data-mode", "ward");
  });

  it("records leave with a typed return time, then the return", () => {
    setup("PT-028");
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    const save = screen.getByRole("button", { name: "Record leave" });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Expected back time"), { target: { value: "23:30" } });
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "1" } });
    fireEvent.click(save);
    expect(screen.getByTestId("probe-leave")).toHaveTextContent("1");
    expect(status()).toHaveAttribute("data-mode", "leave");
    expect(screen.getByRole("heading", { name: "If not back on time" })).toBeInTheDocument();
    fireEvent.click(within(status()).getByRole("button", { name: "Record return" }));
    expect(screen.getByTestId("probe-leave")).toHaveTextContent("0");
    expect(status()).toHaveAttribute("data-mode", "ward");
  });

  it("shows a seeded patient at an emergency department and records their return", () => {
    setup("PT-029");
    expect(status()).toHaveAttribute("data-mode", "away_ed");
    fireEvent.click(within(status()).getByRole("button", { name: "Record return" }));
    expect(screen.getByTestId("probe-ed")).toHaveTextContent("none");
    expect(status()).toHaveAttribute("data-mode", "ward");
  });

  it("shows a seeded patient on leave", () => {
    setup("PT-036");
    expect(status()).toHaveAttribute("data-mode", "leave");
    expect(pill()).toHaveTextContent("On leave");
  });

  it("puts a community treatment order on the quiet band without placement controls", () => {
    setup("PT-008");
    expect(status()).toHaveAttribute("data-mode", "cto");
    expect(pill()).toHaveTextContent("On a CTO");
    expect(screen.getByTestId("ward-person-identity")).toHaveAttribute("data-quiet", "true");
    expect(screen.queryByRole("button", { name: "Place them" })).not.toBeInTheDocument();
  });

  it("keeps past stays in History, never on Now", () => {
    setup("PT-010");
    expect(status()).toHaveAttribute("data-mode", "inactive");
    expect(document.getElementById("pnpane-now")).not.toHaveTextContent("Ward stays");
    fireEvent.click(screen.getByRole("tab", { name: /^History/ }));
    expect(screen.getByTestId("ward-patient-ward-stays")).toBeVisible();
  });
});

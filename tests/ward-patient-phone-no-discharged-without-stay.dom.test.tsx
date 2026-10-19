// shell-24 (13 Oct 2026): a patient who has never been admitted shows no "Discharged" figure on the
// phone patient page (it used to read "None · Discharged"). Orders and Presentations stay.
import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/new-person",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

function NewPatient() {
  const { patients, dispatch, now } = useWardFlow();
  useEffect(() => {
    dispatch({
      type: "ADD_PATIENT",
      role: "coordinator",
      now,
      umrn: "UM999998",
      givenName: "Synthetic",
      familyName: "Newperson",
      dateOfBirth: "1990-01-01",
    });
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const added = patients.find((patient) => patient.umrn === "UM999998");
  return added ? <PatientNowScreen patientId={added.id} /> : null;
}

afterEach(() => installMatchMediaStub(false));

describe("phone patient page for someone never admitted", () => {
  it("shows no Discharged figure", async () => {
    installMatchMediaStub(true);
    await act(async () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <NewPatient />
        </WardFlowProvider>,
      );
    });
    const figures = await screen.findByTestId("ward-patient-phone-figures");
    expect(figures).not.toHaveTextContent("Discharged");
    expect(figures).toHaveTextContent("Orders");
    expect(figures).toHaveTextContent("Presentations");
  });
});

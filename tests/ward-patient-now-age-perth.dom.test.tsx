import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { perthMidnight } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  usePathname: () => "/ward-flow/people/WF-012",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

afterEach(() => vi.unstubAllEnvs());

/*
 * Audit 1 (CS-18, Josh 20 Oct): the Patient page built a local midnight and `patientAgeYears` moved
 * it to Perth again, so on the Perth birthday a browser east of Perth showed a year low. The demo
 * day is pinned to WF-012's own birthday, so the age must be the whole years since birth.
 */
describe.each(["Australia/Sydney", "Australia/Perth"])("Patient page age on a %s browser", (zone) => {
  it("counts the Perth birthday as a whole year", () => {
    vi.stubEnv("TZ", zone);
    const seed = seedWardFlowState();
    const movement = seed.movements.find((candidate) => candidate.id === "WF-012")!;
    const patient = seed.patients.find((candidate) => candidate.id === movement.patientId)!;
    const [year, month, day] = patient.dateOfBirth.split("-").map(Number) as [number, number, number];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR} initialDayZero={perthMidnight(2026, month - 1, day).getTime()}>
        <PatientNowScreen movementId="WF-012" />
      </WardFlowProvider>,
    );
    const age = 2026 - year;
    expect(screen.getAllByText(new RegExp(`^${age} y,`)).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(new RegExp(`^${age - 1} y,`))).toHaveLength(0);
  });
});

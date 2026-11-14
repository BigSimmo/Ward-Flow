// R-MOVE-5 (Josh, 14 Nov 2026), synthetic seed only. The transport officer's copy holds no UMRN (role
// access plan, 15 Oct 2026). The desk says the UMRN is not shown, not "not recorded", and gives the
// date of birth, which the officer's copy already carries, as the second identifier.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { OfficerScreen, isOfficerJob } from "@/components/ward-management/officer/officer-screen";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { formatDateOfBirth } from "@/components/ward-management/ward-patients";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const seed = seedWardFlowState();
const job = seed.movements.find(isOfficerJob)!;
const person = resolveSubjectPatient(job, seed).patient!;

/** The officer's scoped copy: the person keeps a name and date of birth, never a UMRN. */
function OfficerCopy() {
  const world = useWardFlow();
  const movement = {
    ...job,
    transport: { ...job.transport!, acceptedAt: NOW_ANCHOR - 10, enRouteAt: NOW_ANCHOR - 5 },
    closure: undefined,
  };
  return (
    <WardFlowOverride
      value={{
        ...world,
        movements: [movement],
        patients: world.patients.map((patient) => (patient.id === person.id ? { ...patient, umrn: "" } : patient)),
      }}
    >
      <OfficerScreen />
    </WardFlowOverride>
  );
}

afterEach(cleanup);

describe("the officer desk names who to collect with two identifiers (R-MOVE-5)", () => {
  it("shows the date of birth and says the UMRN is not shown on the job panel and identity check", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerCopy />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId(`ward-officer-select-${job.id}`));
    const panel = screen.getByTestId("ward-officer-detail");
    expect(panel).toHaveTextContent(`DOB ${formatDateOfBirth(person.dateOfBirth)}`);
    expect(panel).toHaveTextContent("UMRN not shown on this desk");
    expect(panel).not.toHaveTextContent("UMRN not recorded");
    const identity = within(panel).getByTestId(`ward-officer-identity-${job.id}`);
    expect(identity).toHaveTextContent("UMRN not shown on this desk");
    expect(identity).toHaveTextContent(`DOB ${formatDateOfBirth(person.dateOfBirth)}`);
  });
});

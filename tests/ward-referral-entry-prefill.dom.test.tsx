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

import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { catchmentRoutingDestinations, lookupCatchment } from "@/components/ward-management/ward-catchment";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Option B (Josh, 13 Oct 2026): ED, community team and Home all open the one referral slide-out,
 * prefilled from where it starts. When the entry point names a person, the record answers what it
 * can: the cohort, the catchment the suburb names (counted as confirmed, Change reopens it) and the
 * referring site. The seed records no home region on a movement. Form rule (design audit FORM-REF,
 * 5 Nov 2026): the home region now warns in "Before you send" instead of blocking, so step 1 is
 * complete from the record alone; answering the region clears the warning.
 */
afterEach(() => {
  cleanup();
  discardReferralDraft();
});

/** A seeded person with one open movement whose record answers every step 1 question. */
function answeredPerson() {
  const state = seedWardFlowState();
  for (const movement of state.movements) {
    if (movement.closure || !movement.cohort || movement.homeRegion) continue;
    const patient = resolveSubjectPatient(movement, state).patient;
    if (!patient?.suburb) continue;
    const open = state.movements.filter(
      (other) => !other.closure && resolveSubjectPatient(other, state).patient?.id === patient.id,
    );
    if (open.length !== 1) continue;
    const teams = catchmentRoutingDestinations(lookupCatchment(patient.suburb));
    if (teams?.length !== 1 && !patient.catchmentCommunityTeam) continue;
    const site = edById(movement.originEdId)?.siteCode;
    if (!site) continue;
    return { patientId: patient.id, siteCode: site };
  }
  throw new Error("the seed has no person whose record answers step 1");
}

function stepState(name: string) {
  const step = within(screen.getByRole("group", { name: "Referral sections" })).getByRole("button", { name });
  return step.getAttribute("data-done");
}

describe("the referral slide-out opened from an entry point", () => {
  it("completes step 1 from the record, warns on the home region, with the person as a summary with Change", () => {
    const { patientId, siteCode } = answeredPerson();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer
          onClose={vi.fn()}
          initialCategory="ed"
          initialDestination="ward"
          initialPatientId={patientId}
          initialOriginSiteCode={siteCode}
        />
      </WardFlowProvider>,
    );
    expect(stepState("Patient")).toBe("true");
    expect(screen.getAllByText(/Catchment confirmed/u).length).toBeGreaterThan(0);
    expect(screen.getByTestId("ward-referral-send-warnings")).toHaveTextContent("home region");
    fireEvent.change(screen.getByLabelText("Home region"), { target: { value: "Perth Metropolitan" } });
    expect(stepState("Patient")).toBe("true");
    expect(screen.queryByTestId("ward-referral-send-warnings")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Catchment confirmed/u).length).toBeGreaterThan(0);
    // The summary, not the search: the entry point already named the person.
    expect(screen.queryByRole("combobox", { name: "Find a patient" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change patient" }));
    expect(screen.getByRole("combobox", { name: "Find a patient" })).toBeInTheDocument();
  });
});

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { GENDER_UNANSWERED } from "@/components/ward-management/referrals/referral-submission";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { observationAt } from "@/components/ward-management/ward-observation";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/ed/rph-ed",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  discardReferralDraft();
  window.sessionStorage.clear();
});

/**
 * WS-01 (workflow speed audit, 26 Oct 2026): the referral said "Complete" with gender "Not
 * recorded" while the ED board showed "Female", and the ward then could not accept. Gender now
 * comes from the board when the record has none, and a ward referral answers it before Send.
 * Synthetic seed data only.
 */
function openReferral(patientId: string) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardReferralDrawer onClose={vi.fn()} initialPatientId={patientId} initialCategory="ed" />
    </WardFlowProvider>,
  );
  fireEvent.click(
    within(screen.getByRole("group", { name: "Referral sections" })).getByRole("button", { name: "Referral" }),
  );
}

describe("WS-01: gender on a ward referral", () => {
  it("carries gender from the person's ED board journey when the patient record has none", () => {
    // The audit's case: a patient registered with no gender, on the ED board with gender Female.
    let flow: ReturnType<typeof useWardFlow> | undefined;
    function Capture() {
      flow = useWardFlow();
      return null;
    }
    function Opener() {
      const [patientId, setPatientId] = useState<string>();
      const { patients } = useWardFlow();
      return patientId ? (
        <WardReferralDrawer onClose={vi.fn()} initialPatientId={patientId} initialCategory="ed" />
      ) : (
        <button type="button" onClick={() => setPatientId(patients.find((patient) => patient.umrn === "UM999101")!.id)}>
          open referral
        </button>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Capture />
        <Opener />
      </WardFlowProvider>,
    );
    act(() => {
      flow!.dispatch({
        type: "ADD_PATIENT",
        role: "ed",
        now: NOW_ANCHOR,
        givenName: "Synthetic",
        familyName: "Boardonly",
        dateOfBirth: "1990-01-01",
        umrn: "UM999101",
      });
    });
    const patient = flow!.patients.find((candidate) => candidate.umrn === "UM999101")!;
    expect(patient.gender).toBeUndefined();
    const ed = allEmergencyDepartments()[0]!;
    act(() => {
      flow!.dispatch({
        type: "RAISE_REFERRAL",
        role: "ed",
        now: NOW_ANCHOR,
        edId: ed.id,
        patientId: patient.id,
        draft: {
          cohort: "Adult",
          security: "Open",
          sex: "Female",
          gender: "Female",
          observation: observationAt("general"),
          highAcuity: false,
          legalStatus: "Voluntary",
          urgency: 2,
          legalFormCode: null,
        },
      });
    });
    expect(flow!.movements.some((movement) => movement.patientId === patient.id && movement.gender === "Female")).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "open referral" }));
    fireEvent.click(
      within(screen.getByRole("group", { name: "Referral sections" })).getByRole("button", { name: "Referral" }),
    );
    expect(screen.getByTestId("ward-referral-gender")).toHaveValue("Female");
    expect(screen.getByLabelText("Recorded sex")).toHaveValue("Female");
    expect(screen.queryByTestId("ward-referral-gender-review")).not.toBeInTheDocument();
  });

  it("offers Not yet recorded as an answer, kept apart from unanswered, and says the ward cannot accept yet", () => {
    const journey = wardMovements.find((movement) => isWaitingInEd(movement) && movement.patientId !== undefined)!;
    openReferral(journey.patientId!);
    const gender = screen.getByTestId("ward-referral-gender") as HTMLSelectElement;
    expect([...gender.options].slice(0, 2).map((option) => option.text)).toEqual([
      "Choose a gender",
      "Not yet recorded",
    ]);
    fireEvent.change(gender, { target: { value: "not_recorded" } });
    expect(screen.getByTestId("ward-referral-gender-review")).toHaveTextContent(
      /The ward cannot accept until a coordinator records a reason/,
    );
    fireEvent.change(gender, { target: { value: "" } });
    expect(screen.queryByTestId("ward-referral-gender-review")).not.toBeInTheDocument();
    expect(GENDER_UNANSWERED).toMatch(/Choose the gender identity/);
  });
});

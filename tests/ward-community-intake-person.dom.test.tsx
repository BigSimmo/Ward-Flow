import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { matchReferralPatient } from "@/components/ward-management/referrals/referral-patient-match";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";

/**
 * A2-12 and A2-10 (audit 13 Oct 2026): the community intake sent a Tier 1 referral as "Unknown
 * Patient" because UMRN was optional and there was no name. It now needs a registered person by
 * name or UMRN, or "Unidentified" with a description, and says why it is greyed in visible text.
 */
function LastReferral() {
  const { referrals } = useWardFlow();
  const last = referrals[referrals.length - 1];
  return (
    <>
      <p data-testid="referral-count">{referrals.length}</p>
      <p data-testid="last-referral-patient">{last?.patientId ?? "none"}</p>
      <p data-testid="last-referral-history">{last?.history ?? ""}</p>
    </>
  );
}

function renderIntake() {
  render(
    <ToastProvider>
      <WardFlowProvider>
        <CommunityScreen teamId="midland" />
        <LastReferral />
      </WardFlowProvider>
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Intake referral" }));
}

function answerTheRest() {
  for (const id of [
    "ward-community-intake-age-band",
    "ward-community-intake-home-region",
    "ward-community-intake-urgency",
    "ward-community-intake-origin-site",
  ]) {
    const select = screen.getByTestId(id) as HTMLSelectElement;
    const value = [...select.options].map((option) => option.value).find(Boolean)!;
    fireEvent.change(select, { target: { value } });
  }
}

beforeEach(() =>
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === WF_PHONE_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  ),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("community intake names its person", () => {
  it("stays greyed, with a visible reason, until a person is named", () => {
    renderIntake();
    answerTheRest();
    const reason = document.getElementById("ward-community-intake-blocked");
    expect(reason).toHaveTextContent("Enter the patient's name or UMRN, or choose Unidentified.");
    expect(reason).not.toHaveClass("sr-only");
    const before = screen.getByTestId("referral-count").textContent;
    fireEvent.click(screen.getByTestId("ward-community-intake-submit"));
    expect(screen.getByTestId("referral-count").textContent).toBe(before);
  });

  it("sends for the registered person a UMRN names", () => {
    const person = seedWardFlowState().patients.find((patient) => patient.umrn !== "")!;
    renderIntake();
    fireEvent.change(screen.getByTestId("ward-community-intake-umrn"), { target: { value: person.umrn } });
    answerTheRest();
    fireEvent.click(screen.getByTestId("ward-community-intake-submit"));
    expect(screen.getByTestId("last-referral-patient")).toHaveTextContent(person.id);
  });

  it("sends an unidentified person only with a description, which leads the history", () => {
    renderIntake();
    fireEvent.click(screen.getByTestId("ward-community-intake-unidentified"));
    answerTheRest();
    expect(document.getElementById("ward-community-intake-blocked")).toHaveTextContent(
      "Describe the unidentified person before sending.",
    );
    fireEvent.change(screen.getByTestId("ward-community-intake-description"), {
      target: { value: "Woman, about 40, at Midland station" },
    });
    fireEvent.click(screen.getByTestId("ward-community-intake-submit"));
    expect(screen.getByTestId("last-referral-history")).toHaveTextContent(
      "Unidentified person: Woman, about 40, at Midland station",
    );
  });
});

describe("matchReferralPatient", () => {
  const patients = seedWardFlowState().patients;
  const person = patients.find((patient) => patient.umrn !== "")!;
  it("finds a person by UMRN or by name, and nobody for a blank", () => {
    expect(matchReferralPatient(patients, person.umrn)?.id).toBe(person.id);
    expect(matchReferralPatient(patients, `  ${person.givenName}   ${person.familyName} `)?.id).toBe(person.id);
    expect(matchReferralPatient(patients, "")).toBeUndefined();
  });
});

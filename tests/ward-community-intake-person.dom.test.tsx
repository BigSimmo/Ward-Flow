import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import {
  matchReferralPatient,
  referralPatientLabel,
} from "@/components/ward-management/referrals/referral-patient-match";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";

/**
 * A2-12 and A2-10 (audit 13 Oct 2026): the community intake sent a Tier 1 referral as "Unknown
 * Patient" because UMRN was optional and there was no name. It now needs a registered person by
 * name or UMRN, or "Not yet identified" with a description, and says why it is greyed in visible text.
 *
 * Round 2 (option B, 13 Oct 2026) retired the community intake modal: the team page's "Refer from
 * team" opens the one referral slide-out from that team. The same person requirement is proven
 * there: the slide-out opened from a team starts on nobody, and Send names what is missing.
 */
const TEAM = COMMUNITY_TEAM_PAGES[0]!.name;

function renderTeamPage() {
  render(
    <ToastProvider>
      <WardFlowProvider>
        <CommunityScreen teamId="albany" />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

function renderIntake() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardReferralDrawer onClose={vi.fn()} initialCategory="community" initialSendingTeam={TEAM} />
    </WardFlowProvider>,
  );
}

function sendBlockedReason() {
  fireEvent.click(
    within(screen.getByRole("group", { name: "Referral sections" })).getByRole("button", { name: "Wards" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Send referral" }));
  return screen.getByRole("alert");
}

function patientRow() {
  return within(screen.getByTestId("ward-referral-summary-rail")).getByText("Patient").parentElement!;
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
  discardReferralDraft();
  vi.unstubAllGlobals();
});

describe("community intake names its person", () => {
  it("offers Refer from team, not the retired intake modal", () => {
    renderTeamPage();
    expect(screen.getAllByRole("button", { name: "Refer from team" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Intake referral" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-community-intake-form")).not.toBeInTheDocument();
  });

  it("stays greyed, with a visible reason, until a person is named", () => {
    vi.unstubAllGlobals();
    renderIntake();
    expect(screen.getByTestId("ward-referral-no-patient")).toHaveTextContent("No patient chosen");
    const reason = sendBlockedReason();
    expect(reason).toHaveTextContent('Find a registered patient, add a new patient, or choose "Not yet identified".');
    expect(reason).not.toHaveClass("sr-only");
  });

  it("names the registered person a UMRN finds", () => {
    vi.unstubAllGlobals();
    const person = seedWardFlowState().patients.find((patient) => patient.umrn !== "")!;
    renderIntake();
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a patient" }), { target: { value: person.umrn } });
    fireEvent.click(within(screen.getByRole("listbox", { name: "Matching patients" })).getAllByRole("option")[0]!);
    expect(screen.queryByTestId("ward-referral-no-patient")).not.toBeInTheDocument();
    expect(patientRow()).toHaveTextContent(person.familyName);
  });

  it("sends an unidentified person only with a description, which leads the patient line", () => {
    vi.unstubAllGlobals();
    renderIntake();
    fireEvent.click(screen.getByTestId("ward-referral-unidentified"));
    expect(sendBlockedReason()).toHaveTextContent("Describe the unidentified person.");
    fireEvent.change(screen.getByTestId("ward-referral-unidentified-description"), {
      target: { value: "Woman, about 40, at Midland station" },
    });
    expect(patientRow()).toHaveTextContent("Not yet identified, Woman, about 40, at Midland station");
  });

  it("P157: says a provisional name is allowed and keeps the unidentified prefix", () => {
    vi.unstubAllGlobals();
    renderIntake();
    fireEvent.click(screen.getByTestId("ward-referral-unidentified"));
    const input = screen.getByTestId("ward-referral-unidentified-description");
    expect(document.getElementById(`${input.id}-hint`)).toHaveTextContent(/^name if known, or a description$/);
    expect(input).toHaveAttribute(
      "placeholder",
      'For example, "J. Smith (unconfirmed)" or man about 30, brought in by police',
    );
    fireEvent.change(input, { target: { value: "J. Smith (unconfirmed)" } });
    expect(patientRow()).toHaveTextContent("Not yet identified, J. Smith (unconfirmed)");
  });
});

describe("matchReferralPatient", () => {
  const patients = seedWardFlowState().patients;
  const person = patients.find((patient) => patient.umrn !== "")!;
  it("finds a person by UMRN or by the picked label, and nobody for a blank", () => {
    expect(matchReferralPatient(patients, person.umrn)?.id).toBe(person.id);
    expect(matchReferralPatient(patients, ` ${referralPatientLabel(person).toUpperCase()} `)?.id).toBe(person.id);
    expect(matchReferralPatient(patients, "")).toBeUndefined();
  });

  // Clinical-safety audit (1 Nov 2026): a typed name alone never links a record, even a unique one.
  it("never links a record from a typed name alone", () => {
    const unique = patients.filter(
      (candidate) =>
        patients.filter((other) => other.givenName === candidate.givenName && other.familyName === candidate.familyName)
          .length === 1,
    )[0]!;
    expect(matchReferralPatient(patients, `${unique.givenName} ${unique.familyName}`)).toBeUndefined();
    expect(matchReferralPatient(patients, `${unique.familyName}, ${unique.givenName}`)).toBeUndefined();
  });

  it("labels a record with no UMRN by its date of birth, so a pick still names an identifier", () => {
    const noUmrn = { ...person, id: "synthetic-no-umrn" as typeof person.id, umrn: "", dateOfBirth: "1990-02-03" };
    expect(referralPatientLabel(noUmrn)).toBe(`${person.familyName}, ${person.givenName} · born 03/02/1990`);
    expect(matchReferralPatient([...patients, noUmrn], referralPatientLabel(noUmrn))?.id).toBe(noUmrn.id);
  });
});

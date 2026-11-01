import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { ToastProvider } from "@/components/wf";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { referralPatientLabel } from "@/components/ward-management/referrals/referral-patient-match";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { formatDateOfBirth, type Patient } from "@/components/ward-management/ward-patients";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  EdInboxReferralFixture,
  markNotYetIdentified,
  openRaiseIntoMovementForm,
} from "./helpers/ed-raise-into-movement";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

/**
 * A2-1 and A2-10 (audit 13 Oct 2026): the ED "Raise referral" form filed an Unknown Patient with no
 * name or UMRN, off screen and silently, and its greyed button explained itself only to a screen
 * reader. It now starts from a person, says why it is greyed in visible text, and confirms the raise
 * with a toast that opens the new row.
 *
 * Round 2 (option B, 13 Oct 2026): ED "Raise referral" now opens the shared referral slide-out
 * (its no-patient start is covered in `ward-referral-no-default-patient.dom.test.tsx`). The inline
 * form survives only as "Ask for a bed" from the ED inbox, so these cases prove the same
 * person requirement there. An inbox referral with no person on it opens as "Not yet identified";
 * clearing that is the "nobody named yet" state.
 */
function LastMovementPatient() {
  const { movements } = useWardFlow();
  return (
    <>
      <p data-testid="last-movement-patient">{movements[movements.length - 1]?.patientId ?? "no-patient"}</p>
      <p data-testid="movement-count">{movements.length}</p>
    </>
  );
}

function renderEd() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToastProvider>
        <EdInboxReferralFixture edId="jhc-ed" />
        <EdScreen edId="jhc-ed" />
        <LastMovementPatient />
      </ToastProvider>
    </WardFlowProvider>,
  );
  openRaiseIntoMovementForm();
}

/** Clears the inbox referral's "Not yet identified", leaving nobody named on the form. */
function clearNotYetIdentified() {
  const box = screen.getByTestId("ward-ed-referral-unidentified") as HTMLInputElement;
  if (box.checked) fireEvent.click(box);
}

function answerClinicalFields() {
  for (const [testId, value] of [
    ["ward-ed-referral-cohort", "Adult"],
    ["ward-ed-referral-security", "Open"],
    ["ward-ed-referral-sex", "Female"],
    ["ward-ed-referral-gender", "Female"],
    ["ward-ed-referral-legal-status", "Voluntary"],
    ["ward-ed-referral-urgency", "3"],
  ] as const) {
    fireEvent.change(screen.getByTestId(testId), { target: { value } });
  }
  fireEvent.change(screen.getByTestId("ward-ed-referral-observation"), { target: { value: "general" } });
  fireEvent.click(screen.getByTestId("ward-ed-referral-high-acuity-not-required"));
}

describe("ED Raise referral starts from a person", () => {
  it("is greyed with a visible reason until a patient is found or marked not yet identified", () => {
    renderEd();
    clearNotYetIdentified();
    answerClinicalFields();
    const submit = screen.getByTestId("ward-ed-referral-submit");
    expect(submit).toHaveAttribute("aria-disabled", "true");
    const reason = document.getElementById("ward-ed-referral-blocked");
    expect(reason).toHaveTextContent("Find the patient by name or UMRN");
    expect(reason).not.toHaveClass("sr-only");
    const before = screen.getByTestId("movement-count").textContent;
    fireEvent.click(submit);
    expect(screen.getByTestId("movement-count").textContent).toBe(before);
  });

  it("does not raise when Enter submits the form with no patient chosen", () => {
    renderEd();
    clearNotYetIdentified();
    answerClinicalFields();
    const before = screen.getByTestId("movement-count").textContent;
    fireEvent.submit(screen.getByTestId("ward-ed-referral-form"));
    expect(screen.getByTestId("movement-count").textContent).toBe(before);
  });

  it("shows only the first sentence of a long reason beside the button", () => {
    renderEd();
    markNotYetIdentified();
    expect(document.getElementById("ward-ed-referral-blocked")).toHaveTextContent(
      /^Choose a security level before raising this referral\.$/u,
    );
  });

  it("raises for the registered person found by UMRN and confirms with Open row", () => {
    const person = seedWardFlowState().patients.find((patient) => patient.umrn !== "")!;
    renderEd();
    clearNotYetIdentified();
    fireEvent.change(screen.getByTestId("ward-ed-referral-patient"), { target: { value: person.umrn } });
    answerClinicalFields();
    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));
    expect(screen.getByTestId("last-movement-patient")).toHaveTextContent(person.id);
    expect(screen.getByText("Referral raised")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open row" })).toBeInTheDocument();
    expect(referralPatientLabel(person)).toContain(person.umrn);
  });

  it("replaces sex prefilled from one person when the clinician changes to another", () => {
    const patients = seedWardFlowState().patients.filter((patient) => patient.umrn !== "" && patient.sex);
    const first = patients[0]!;
    const second = patients.find((patient) => patient.sex !== first.sex)!;
    renderEd();
    clearNotYetIdentified();
    const field = screen.getByTestId("ward-ed-referral-patient");
    fireEvent.change(field, { target: { value: first.umrn } });
    expect(screen.getByTestId("ward-ed-referral-sex")).toHaveValue(first.sex);
    fireEvent.change(field, { target: { value: second.umrn } });
    expect(screen.getByTestId("ward-ed-referral-sex")).toHaveValue(second.sex);
  });
});

/** A person whose name no other seed record shares, so a name-only match would have found them. */
function uniquelyNamedPerson(): Patient {
  const patients = seedWardFlowState().patients;
  return patients.find(
    (candidate) =>
      candidate.umrn !== "" &&
      candidate.sex !== undefined &&
      patients.filter((other) => other.givenName === candidate.givenName && other.familyName === candidate.familyName)
        .length === 1,
  )!;
}

// Clinical-safety audit (1 Nov 2026): a record links only from a pick or an exact UMRN.
describe("ED Ask for a bed links a record only from a pick or a UMRN", () => {
  it("leaves a typed name unregistered, with nothing linked and nothing prefilled", () => {
    const person = uniquelyNamedPerson();
    renderEd();
    clearNotYetIdentified();
    fireEvent.change(screen.getByTestId("ward-ed-referral-patient"), {
      target: { value: `${person.givenName} ${person.familyName}` },
    });
    expect(screen.queryByTestId("ward-ed-referral-patient-linked")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-ed-referral-sex")).not.toHaveValue(person.sex);
    expect(document.getElementById("ward-ed-referral-blocked")).toHaveTextContent("Find the patient by name or UMRN");
  });

  it("shows the linked record's name, UMRN and date of birth once picked", () => {
    const person = uniquelyNamedPerson();
    renderEd();
    clearNotYetIdentified();
    const field = screen.getByTestId("ward-ed-referral-patient");
    fireEvent.change(field, { target: { value: referralPatientLabel(person) } });
    const linked = screen.getByTestId("ward-ed-referral-patient-linked");
    expect(linked).toHaveTextContent(
      `Linked: ${person.familyName}, ${person.givenName} · UMRN ${person.umrn} · DOB ${formatDateOfBirth(person.dateOfBirth)}`,
    );
    expect(field).toHaveAttribute("aria-describedby", linked.id);
  });
});

/** Two inbox referrals, each already naming its registered person. */
function TwoPersonReferralsFixture({ edId, first, second }: { edId: string; first: Patient; second: Patient }) {
  const flow = useWardFlow();
  const receive = (patientId: string) => {
    flow.dispatch({
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: flow.now,
      patientId,
      ageBand: "Adult",
      destinations: [{ kind: "emergency_department", edId, purpose: "psychiatric_review" }],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    } as never);
  };
  return (
    <>
      <button type="button" hidden data-testid="fixture-first" onClick={() => receive(first.id)} />
      <button type="button" hidden data-testid="fixture-second" onClick={() => receive(second.id)} />
      <button
        type="button"
        hidden
        data-testid="fixture-arrived"
        onClick={() => {
          const referralId = flow.referrals.at(-1)?.id;
          if (referralId)
            flow.dispatch({ type: "RECORD_ARRIVED_IN_DEPARTMENT", role: "ed", now: flow.now, referralId });
        }}
      />
      <p data-testid="fixture-referral-ids">
        {flow.referrals
          .filter((referral) => referral.patientId === first.id || referral.patientId === second.id)
          .map((referral) => referral.id)
          .join(" ")}
      </p>
    </>
  );
}

// Clinical-safety audit (1 Nov 2026): the open form used to keep showing the first person while
// filing for the second.
describe("ED Ask for a bed follows the referral it was opened for", () => {
  it("shows the new person when Ask for a bed is pressed on another referral while the form is open", () => {
    const patients = seedWardFlowState().patients.filter((patient) => patient.umrn !== "");
    const [first, second] = [patients[0]!, patients[1]!];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <TwoPersonReferralsFixture edId="jhc-ed" first={first} second={second} />
          <EdScreen edId="jhc-ed" />
        </ToastProvider>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("fixture-first"));
    fireEvent.click(screen.getByTestId("fixture-arrived"));
    fireEvent.click(screen.getByTestId("fixture-second"));
    fireEvent.click(screen.getByTestId("fixture-arrived"));
    const [firstId, secondId] = screen.getByTestId("fixture-referral-ids").textContent!.split(" ");

    fireEvent.click(screen.getByTestId(`ward-ed-inbox-raise-${firstId}`));
    expect(screen.getByTestId("ward-ed-referral-patient")).toHaveValue(referralPatientLabel(first));
    expect(screen.getByTestId("ward-ed-referral-patient-linked")).toHaveTextContent(first.umrn);

    fireEvent.click(screen.getByTestId(`ward-ed-inbox-raise-${secondId}`));
    expect(screen.getByTestId("ward-ed-referral-patient")).toHaveValue(referralPatientLabel(second));
    expect(screen.getByTestId("ward-ed-referral-patient-linked")).toHaveTextContent(second.umrn);
    expect(screen.getByTestId("ward-ed-referral-patient-linked")).not.toHaveTextContent(first.umrn);
  });
});

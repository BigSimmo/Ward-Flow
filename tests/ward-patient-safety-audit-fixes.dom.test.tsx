import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import { RecordFormSheet, type RecordDraft } from "@/components/ward-management/legal-forms/legal-forms-sheets";
import { PatientDetailsTab } from "@/components/ward-management/patients/patient-dossier-tabs";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Movement } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";

/*
 * UX audit (21 Oct 2026), patient record and legal findings: the record says each fact once, and the
 * patient record can start a legal form for its own movement.
 */
const seed = seedWardFlowState();
const open = seed.movements.find((movement) => isOpen(movement) && movement.legalStatus);
if (!open) throw new Error("the seed no longer carries an open movement with a legal status");
const patient: Patient = { ...seed.patients[0]!, sex: open.sex, gender: open.gender, legalStatus: open.legalStatus };

function renderDetails(movement: Movement, who: Patient) {
  render(<PatientDetailsTab patient={who} movement={movement} displayName="Synthetic Person" />);
  return within(screen.getByRole("region", { name: "Patient details" }));
}

describe("Record details says each fact once", () => {
  it("shows one legal status and no placement sex or gender when the record and the movement agree", () => {
    const pane = renderDetails(open, patient);
    expect(pane.getByText("Legal status")).toBeInTheDocument();
    expect(pane.queryByText("Patient legal status")).not.toBeInTheDocument();
    expect(pane.queryByText("Movement legal status")).not.toBeInTheDocument();
    expect(pane.queryByText("Placement sex")).not.toBeInTheDocument();
    expect(pane.queryByText("Placement gender")).not.toBeInTheDocument();
  });

  it("shows both legal statuses, named apart, when they differ", () => {
    const other = open.legalStatus === "Voluntary" ? "Involuntary inpatient" : "Voluntary";
    const pane = renderDetails(open, { ...patient, legalStatus: other as Patient["legalStatus"] });
    expect(pane.getByText("Movement legal status")).toBeInTheDocument();
    expect(pane.getByText("Patient legal status")).toBeInTheDocument();
  });

  it("writes the date of birth as DD/MM/YYYY, the header's format", () => {
    const pane = renderDetails(open, { ...patient, dateOfBirth: "1988-03-14" });
    expect(pane.getByText("14/03/1988")).toBeInTheDocument();
    expect(pane.queryByText("1988-03-14")).not.toBeInTheDocument();
  });
});

describe("the placement rule on the one patient record (R-2026-09-04-A)", () => {
  // The retired governed dossier carried this guard; Patient Now's Details tab is now the only
  // screen that shows both sensitive fields, so the rule is checked here.
  const withBoth = seed.patients.find(
    (person) => person.aboriginalOrTorresStraitIslanderStatus !== undefined && person.interpreterLanguage !== undefined,
  );

  it("has a seeded patient carrying both sensitive fields, or the assertion below is vacuous", () => {
    expect(withBoth).toBeDefined();
  });

  it("keeps Aboriginal or Torres Strait Islander status and interpreter language apart, in different groups", () => {
    const pane = renderDetails(open, { ...withBoth!, legalStatus: open.legalStatus });
    const labels = pane.getAllByRole("term").map((term) => term.textContent ?? "");
    const aboriginal = labels.indexOf("Aboriginal or Torres Strait Islander status");
    const interpreter = labels.indexOf("Interpreter / preferred language");
    expect(aboriginal).toBeGreaterThan(-1);
    expect(interpreter).toBeGreaterThan(-1);
    expect(Math.abs(aboriginal - interpreter)).toBeGreaterThan(1);
    const terms = pane.getAllByRole("term");
    expect(terms[aboriginal]!.closest("dl")).not.toBe(terms[interpreter]!.closest("dl"));
  });
});

describe("Legal now on the patient record", () => {
  it("offers Record a form, which opens Legal forms for this movement with the sheet open", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen patientId="PT-001" />
      </WardFlowProvider>,
    );
    const card = within(screen.getByTestId("ward-patient-legal-now"));
    expect(card.getByRole("button", { name: "Forms" })).toBeInTheDocument();
    const link = card.getByRole("link", { name: "Record a form" });
    expect(link.getAttribute("href")).toMatch(/^\/ward-flow\/legal-forms\?movement=[^&]+&record=1$/u);
  });

  it("offers no Record a form for an arrived stay, which the Record a form sheet cannot take", () => {
    const arrived = seed.movements.find(
      (movement) => movement.stage === "arrived" && !movement.legalForm && movement.patientId,
    );
    if (!arrived?.patientId) throw new Error("the seed no longer carries an arrived stay without a form");
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen patientId={arrived.patientId} />
      </WardFlowProvider>,
    );
    const card = within(screen.getByTestId("ward-patient-legal-now"));
    expect(card.getByText("No form recorded")).toBeInTheDocument();
    expect(card.queryByRole("link", { name: "Record a form" })).not.toBeInTheDocument();
  });

  it("opens Record a form with the movement chosen when the address asks for it", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <LegalFormsScreen initialMovementId={open.id} recordOnOpen />
      </WardFlowProvider>,
    );
    const sheet = within(screen.getByTestId("ward-legal-record"));
    const movement = sheet.getByLabelText("Movement") as HTMLSelectElement;
    expect(movement.value).toBe(open.id);
  });

  it("leaves the sheet closed on a plain ?movement= link, as a Governance gap sends", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <LegalFormsScreen initialMovementId={open.id} />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-legal-record")).not.toBeInTheDocument();
  });
});

describe("Legal forms list", () => {
  it("never says Not tracked over 0 of 0 recorded", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <LegalFormsScreen />
      </WardFlowProvider>,
    );
    expect(document.body.textContent).not.toMatch(/Not tracked|0 of 0 recorded/u);
  });
});

function RecordSheet({ movement, target }: { movement: string; target?: string }) {
  const [draft, onDraft] = useState<RecordDraft>({ form: "1A", movement });
  return (
    <RecordFormSheet
      open
      onClose={() => {}}
      draft={draft}
      onDraft={onDraft}
      openMovements={seed.movements.filter(isOpen)}
      labelOf={(m) => m.id}
      now={NOW_ANCHOR}
      targetMovement={target}
    />
  );
}

describe("Record a form opened from a patient record", () => {
  it("keeps the linked movement when an unsent draft for another patient is waiting", () => {
    const [first, second] = seed.movements.filter(isOpen);
    if (!first || !second) throw new Error("the seed no longer carries two open movements");
    window.sessionStorage.clear();
    vi.useFakeTimers();
    try {
      const earlier = render(<RecordSheet movement="" />);
      fireEvent.change(screen.getByLabelText("Movement"), { target: { value: first.id } });
      fireEvent.change(screen.getByLabelText("Time on form"), { target: { value: "00:00" } });
      act(() => vi.advanceTimersByTime(500));
      earlier.unmount();
      render(<RecordSheet movement={second.id} target={second.id} />);
      expect(screen.getByLabelText("Movement")).toHaveValue(second.id);
      expect(screen.getByLabelText("Time on form")).toHaveValue("");
    } finally {
      cleanup();
      window.sessionStorage.clear();
      vi.useRealTimers();
    }
  });
});

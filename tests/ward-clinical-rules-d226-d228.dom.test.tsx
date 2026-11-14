// D-226 to D-228 (Josh, 14 Nov 2026): the Forms page refusal after a Form 3E, and Find a ward's
// "No bed now", "Not suitable" and amber "Locked" groups. Every input is synthetic.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecordFormSheet, type RecordDraft } from "@/components/ward-management/legal-forms/legal-forms-sheets";
import { FindAWard, type FindAWardRow } from "@/components/ward-management/referrals/find-a-ward";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { eligibility, placementFit } from "@/components/ward-management/ward-eligibility";
import { restrictionNotice } from "@/components/ward-management/ward-derivations-shortlist";
import { AFTER_3E_REFUSAL } from "@/components/ward-management/ward-legal-after-3e";
import type { LegalForm, Movement, Unit } from "@/components/ward-management/ward-model";

const NOW = 2 * 1440 + 600;
afterEach(() => cleanup());
const state = seedWardFlowStateAt(0);
const base = state.movements.find((movement) => !movement.closure)!;
const after3E: Movement = {
  ...base,
  id: "WF-AFTER-3E-SHEET",
  closure: undefined,
  legalStatus: "Involuntary inpatient",
  legalForm: { code: "3E", earlierForms: [{ code: "3A", at: NOW - 40, by: "ed" }] } as LegalForm,
  formedAt: NOW - 45,
};

function Sheet({ coordinator, onSave }: { coordinator: boolean; onSave: (input: unknown) => void }) {
  const [draft, setDraft] = useState<RecordDraft>({ form: "", movement: after3E.id });
  return (
    <RecordFormSheet
      open
      onClose={() => {}}
      draft={draft}
      onDraft={setDraft}
      openMovements={[after3E]}
      labelOf={() => "Synthetic movement"}
      now={NOW}
      coordinator={coordinator}
      onSaveForm={(input) => {
        onSave(input);
        return true;
      }}
    />
  );
}

function openSheet(coordinator: boolean) {
  const onSave = vi.fn();
  render(
    <WardFlowProvider initialNow={NOW}>
      <Sheet coordinator={coordinator} onSave={onSave} />
    </WardFlowProvider>,
  );
  const sheet = screen.getByTestId("ward-legal-record");
  fireEvent.change(within(sheet).getByLabelText("Form type"), { target: { value: "6C" } });
  fireEvent.change(within(sheet).getByLabelText("Time on form"), { target: { value: "09:30" } });
  return { sheet, onSave };
}

describe("D-226: Record a form after a Form 3E", () => {
  it("refuses a continuation for a desk that is not the coordinator, and says who can", () => {
    const { sheet, onSave } = openSheet(false);
    expect(within(sheet).getByTestId("ward-legal-forms-after-3e-refused")).toHaveTextContent(AFTER_3E_REFUSAL);
    expect(within(sheet).queryByRole("radio")).not.toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "Save Form 6C anyway" }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("lets the coordinator save it once a listed reason is picked, and sends the reason", () => {
    const { sheet, onSave } = openSheet(true);
    fireEvent.click(within(sheet).getByRole("button", { name: "Save Form 6C anyway" }));
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(within(sheet).getByRole("radio", { name: "Form 3E recorded in error" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Save Form 6C anyway" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ formCode: "6C", after3EReason: "form_3e_in_error" }));
  });
});

describe("D-227: a single-sex ward of the other gender is not suitable", () => {
  it("the shared classifier calls it not suitable, never a review", () => {
    const ward = state.units.find((unit) => unit.sexDesignation === "Female only")!;
    const movement: Movement = { ...base, closure: undefined, cohort: ward.cohort, gender: "Male" };
    expect(placementFit(eligibility(movement, ward, NOW)).kind).toBe("not_suitable");
  });
});

describe("D-227 and D-228: Find a ward groups", () => {
  const [a, b, c, d] = state.units as Unit[];
  const rows: FindAWardRow[] = [
    { unit: a!, fit: true, ready: 2 },
    { unit: b!, fit: true, ready: 1, locked: true },
    { unit: c!, fit: false, ready: 0, noBed: true, reason: "No Ready bed" },
    { unit: d!, fit: false, ready: 1, unsuitable: true, reason: "Does not suit this patient" },
  ];

  it("lists a fully locked ward under its own group with Locked, still tickable", () => {
    render(
      <FindAWard query="" onQueryChange={() => {}} rows={rows} chosen={[]} onToggle={() => {}} testIdPrefix="t" />,
    );
    const locked = screen.getByRole("group", { name: "Fits, locked ward" });
    expect(within(locked).getByText("Locked")).toBeInTheDocument();
    expect(within(locked).getByRole("checkbox")).toBeEnabled();
    expect(within(screen.getByRole("group", { name: "Fits, bed ready" })).queryByText("Locked")).toBeNull();
  });

  it("lists no bed now and not suitable apart, and neither can be ticked", () => {
    render(
      <FindAWard query="" onQueryChange={() => {}} rows={rows} chosen={[]} onToggle={() => {}} testIdPrefix="t" />,
    );
    const noBed = screen.getByRole("group", { name: "No bed now" });
    expect(within(noBed).getByText("No bed now")).toBeInTheDocument();
    expect(within(noBed).getByRole("checkbox")).toBeDisabled();
    const unsuitable = screen.getByRole("group", { name: "Not suitable" });
    expect(within(unsuitable).getByRole("checkbox")).toBeDisabled();
    expect(screen.queryByText("Review")).toBeNull();
  });

  it("marks only a wholly locked ward for an open-bed movement as Locked", () => {
    const lockedWard = state.units.find((unit) => unit.lockedBeds > 0 && unit.lockedBeds >= unit.beds);
    const openMovement: Movement = {
      ...base,
      closure: undefined,
      security: "Open",
      legalStatus: "Involuntary inpatient",
    };
    if (lockedWard) expect(restrictionNotice(openMovement, lockedWard)?.level).toBe("more_restrictive");
    const mixed = state.units.find((unit) => unit.beds > unit.lockedBeds)!;
    expect(restrictionNotice(openMovement, mixed)?.level).not.toBe("more_restrictive");
  });
});

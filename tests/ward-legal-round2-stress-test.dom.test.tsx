import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import { RecordFormSheet, type RecordDraft } from "@/components/ward-management/legal-forms/legal-forms-sheets";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import type { LegalForm, Movement } from "@/components/ward-management/ward-model";
import {
  currentLegalMismatchesFor,
  LEGAL_MISMATCH_CHIP,
  LEGAL_MISMATCH_WARNING,
} from "@/components/ward-management/ward-stay-legal";
import { LegalMismatchBadge } from "@/components/ward-management/legal-mismatch-badge";
import { afterEndedOrderWarning, legalRecordWarnings } from "@/components/ward-management/ward-legal-order-rules";
import { currentLegalPosition } from "@/components/ward-management/ward-legal-form-progression";
import {
  legalFormBreakdown,
  legalFormGroupRows,
  legalOrdersEndedToday,
} from "@/components/ward-management/legal-forms/legal-forms-derivations";
import { authorisationShort, authorisationValue } from "@/components/ward-management/ward-authorisation";

// Master stress test round 2, 14 Nov 2026 (Josh: "yes to all recommendations"): R-LEGAL-4, 7, 8,
// 11 and 12. Synthetic data only.

const NOW = 2 * 1440 + 600; // day 2, 10:00

afterEach(() => {
  cleanup();
});
const state = seedWardFlowStateAt(0);
const unit = state.units[0]!;
const base = state.movements.find((movement) => !movement.closure)!;

function journey(patch: Partial<Movement> = {}): Movement {
  return {
    ...base,
    id: "WF-LEGAL-ROUND2",
    stage: "accepted_awaiting_bed",
    closure: undefined,
    acceptedUnitId: unit.id,
    referredUnitIds: [],
    declines: [],
    transport: undefined,
    legalForm: undefined,
    legalStatus: "Voluntary",
    legalMismatch: undefined,
    ...patch,
  };
}

const ended3E = (): Partial<Movement> => ({
  legalStatus: "Involuntary inpatient",
  legalForm: {
    code: "3E",
    earlierForms: [{ code: "4A", at: NOW - 40, by: "ed" }],
  } as LegalForm,
  formedAt: NOW - 45,
});

describe("R-LEGAL-4: one legal-mismatch chip on lists", () => {
  const flagged = journey({ legalMismatch: { at: NOW - 30, unitId: unit.id, kind: "voluntary_on_locked_ward" } });

  it("shows the chip with the approved sentence as its title", () => {
    render(<LegalMismatchBadge movement={flagged} />);
    const chip = screen.getByTestId(`ward-legal-mismatch-chip-${flagged.id}`);
    expect(chip).toHaveTextContent(LEGAL_MISMATCH_CHIP);
    expect(chip.querySelector(`[title="${LEGAL_MISMATCH_WARNING}"]`)).not.toBeNull();
    expect(LEGAL_MISMATCH_WARNING).toBe("Legal status does not match this ward. Check before moving.");
  });

  it("shows nothing once the flag no longer describes the journey", () => {
    const { container } = render(<LegalMismatchBadge movement={journey()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists the open journeys accepted for one ward with a current mismatch", () => {
    expect(currentLegalMismatchesFor([flagged, journey({ id: "WF-CLEAN" })], unit.id).map((m) => m.id)).toEqual([
      flagged.id,
    ]);
    expect(currentLegalMismatchesFor([flagged], "another-ward")).toEqual([]);
  });
});

describe("R-LEGAL-7: the register answer names the hospital, not the ward", () => {
  it("keeps D-209's word, source and date, and says the ward is not checked", () => {
    expect(authorisationValue({ id: "gry-adult-secure" })).toBe(
      "Authorised for the hospital (Chief Psychiatrist register, 7 Sep 2026), ward not checked",
    );
    expect(authorisationValue({ id: "sjgs-adult-secure" })).toBe("Not on the authorised register (7 Sep 2026)");
    expect(authorisationValue({ id: "not-a-ward" })).toBe("Not stated");
  });

  it("R-LEGAL-8: gives the fit line the same answer in short", () => {
    expect(authorisationShort("on_register")).toBe("hospital on register");
    expect(authorisationShort("not_on_register")).toBe("not on register");
    expect(authorisationShort("not_stated")).toBe("not stated");
  });
});

describe("R-LEGAL-11: a form after a recorded Form 3E warns, never blocks", () => {
  it("warns in plain words for any form after a 3E", () => {
    const movement = journey(ended3E());
    expect(afterEndedOrderWarning(movement, "3C")).toBe(
      "Form 3E is already recorded for this person. Check the paper. If Form 3C is right, save it.",
    );
    expect(legalRecordWarnings(movement, { continuationFormCode: "3C" })).toContain(
      afterEndedOrderWarning(movement, "3C"),
    );
  });

  it("says nothing with no 3E on file, for a second 3E, or before a form is chosen", () => {
    expect(afterEndedOrderWarning(journey({ legalForm: { code: "4A" } as LegalForm }), "3C")).toBeNull();
    expect(afterEndedOrderWarning(journey(ended3E()), "3E")).toBeNull();
    expect(afterEndedOrderWarning(journey(ended3E()), undefined)).toBeNull();
    expect(legalRecordWarnings(journey(ended3E()))).not.toContain(expect.stringContaining("Form 3E is already"));
  });
});

describe("R-LEGAL-12: the Forms page counts forms in force and says what ended", () => {
  const inForce = journey({
    id: "WF-IN-FORCE",
    legalStatus: "Involuntary inpatient",
    legalForm: { code: "4A", dueAt: NOW + 300 } as LegalForm,
  });
  const after3E = journey({ id: "WF-AFTER-3E", ...ended3E() });

  it("a Form 3E on file is not in force", () => {
    expect(currentLegalPosition(after3E).inForce).toBe(false);
    expect(currentLegalPosition(inForce).inForce).toBe(true);
    expect(currentLegalPosition(journey()).inForce).toBe(false);
  });

  it("drops the 3E person from both groups and the breakdown, and counts them as ended today", () => {
    const movements = [inForce, after3E];
    const rows = [
      ...legalFormGroupRows(movements, NOW, "with-deadline"),
      ...legalFormGroupRows(movements, NOW, "no-deadline"),
    ];
    expect(rows.map((movement) => movement.id)).toEqual(["WF-IN-FORCE"]);
    expect(legalFormBreakdown(movements, NOW).map((row) => row.code)).toEqual(["4A"]);
    expect(legalOrdersEndedToday(movements, NOW)).toBe(1);
    expect(legalOrdersEndedToday(movements, NOW + 1440)).toBe(0);
  });
});

describe("R-LEGAL-11: Record a form says it on the spot and still saves", () => {
  function Harness({ movement, onSave }: { movement: Movement; onSave: () => void }) {
    const [draft, setDraft] = useState<RecordDraft>({ form: "", movement: movement.id });
    return (
      <RecordFormSheet
        open
        onClose={() => {}}
        draft={draft}
        onDraft={setDraft}
        openMovements={[movement]}
        labelOf={() => "Synthetic movement"}
        now={NOW}
        onSaveForm={() => {
          onSave();
          return true;
        }}
      />
    );
  }

  it("warns under the form type, labels the button, and records on Save", () => {
    const onSave = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW}>
        <Harness movement={journey(ended3E())} onSave={onSave} />
      </WardFlowProvider>,
    );
    const sheet = screen.getByTestId("ward-legal-record");
    fireEvent.change(within(sheet).getByLabelText("Form type"), { target: { value: "3C" } });
    expect(within(sheet).getByTestId("ward-legal-forms-after-3e")).toHaveTextContent(
      "Form 3E is already recorded for this person. Check the paper. If Form 3C is right, save it.",
    );
    fireEvent.change(within(sheet).getByLabelText("Time on form"), { target: { value: "09:30" } });
    const save = within(sheet).getByRole("button", { name: "Save Form 3C anyway" });
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

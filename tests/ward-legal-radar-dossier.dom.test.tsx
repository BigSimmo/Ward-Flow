import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { formTimeLeft } from "@/components/ward-management/legal-forms/legal-form-time-left";
import { PatientDocumentsTab } from "@/components/ward-management/patients/patient-dossier-tabs";
import type { PatientNowRecord } from "@/components/ward-management/patients/patient-now-records";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";

// Top 25 item 19: a typed paper expiry reads its time left through the one
// shared rule. Settings warnings only (1h urgent, 3h soon), no separate 4h amber. Synthetic data only.
const NOW = 10 * 60 + 42;
const URGENT = CLINICAL_VALUES.dueSoonUrgent.value;
const SOON = CLINICAL_VALUES.dueSoon.value;

function movement(dueAt: number): Movement {
  const base = seedWardFlowStateAt(0).movements[0]!;
  return { ...base, closure: undefined, legalForm: { code: "4A", kind: "transport", dueAt } } as Movement;
}

const record = { documents: [] } as unknown as PatientNowRecord;

function renderTab(dueAt: number) {
  return render(
    <PatientDocumentsTab
      record={record}
      movement={movement(dueAt)}
      movementInForce
      now={NOW}
      onRecordDocument={() => undefined}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("paper legal form time left, one rule", () => {
  it("uses the Settings warnings and has no separate four hour amber", () => {
    expect(formTimeLeft(movement(NOW + URGENT - 1), NOW, DEFAULT_DUE_SOON_THRESHOLDS)?.standing).toBe("urgent");
    expect(formTimeLeft(movement(NOW + SOON - 1), NOW, DEFAULT_DUE_SOON_THRESHOLDS)?.standing).toBe("soon");
    // Between the first warning and four hours the form is later, not amber.
    expect(formTimeLeft(movement(NOW + SOON + 30), NOW, DEFAULT_DUE_SOON_THRESHOLDS)?.standing).toBe("later");
    expect(formTimeLeft(movement(NOW - 5), NOW, DEFAULT_DUE_SOON_THRESHOLDS)?.standing).toBe("passed");
  });

  it("shows the typed expiry and the warning word on the patient's forms register (as typed, D-93)", () => {
    renderTab(NOW + 120);
    const line = screen.getByTestId("dossier-paper-expiry-time-left");
    expect(line.textContent).toMatch(/Ends .+ as typed/u);
    expect(line.textContent).not.toMatch(/\bleft\b/u);
    expect(line.textContent).toContain(`Within ${SOON / 60}h`);
  });

  it("shows the typed expiry on a continued form, where it sits on the original row", () => {
    const continued = movement(NOW + 120);
    continued.legalForm = {
      ...continued.legalForm!,
      continuedBy: { code: "5B", startedAt: NOW - 60, recordedAt: NOW - 60, by: "ward" },
    } as Movement["legalForm"];
    render(
      <PatientDocumentsTab
        record={record}
        movement={continued}
        movementInForce
        now={NOW}
        onRecordDocument={() => undefined}
      />,
    );
    expect(screen.getByTestId("dossier-paper-expiry-time-left").textContent).toMatch(/Ends .+ as typed/u);
  });
});

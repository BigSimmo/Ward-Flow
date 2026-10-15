import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { formTimeLeft } from "@/components/ward-management/legal-forms/legal-form-time-left";
import { PatientDocumentsTab } from "@/components/ward-management/patients/patient-dossier-tabs";
import type { PatientNowRecord } from "@/components/ward-management/patients/patient-now-records";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";

// Top 25 item 19 (flag top25-legal-radar): a typed paper expiry reads its time left through the one
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
  act(() => setWardFeatureFlagOnDevice("top25-legal-radar", null));
});

describe("paper legal form time left, one rule", () => {
  it("uses the Settings warnings and has no separate four hour amber", () => {
    expect(formTimeLeft(movement(NOW + URGENT - 1), NOW)?.standing).toBe("urgent");
    expect(formTimeLeft(movement(NOW + SOON - 1), NOW)?.standing).toBe("soon");
    // Between the first warning and four hours the form is later, not amber.
    expect(formTimeLeft(movement(NOW + SOON + 30), NOW)?.standing).toBe("later");
    expect(formTimeLeft(movement(NOW - 5), NOW)?.standing).toBe("passed");
  });

  it("shows time left and the warning word on the patient's forms register with the flag on", () => {
    act(() => setWardFeatureFlagOnDevice("top25-legal-radar", true));
    renderTab(NOW + 120);
    const line = screen.getByTestId("dossier-paper-expiry-time-left");
    expect(line.textContent).toContain("2h 00m left");
    expect(line.textContent).toContain(`Within ${SOON / 60}h`);
  });

  it("keeps the old line with the flag off", () => {
    act(() => setWardFeatureFlagOnDevice("top25-legal-radar", false));
    renderTab(NOW + 120);
    expect(screen.queryByTestId("dossier-paper-expiry-time-left")).toBeNull();
    expect(screen.getByText(/Paper expiry typed/).textContent).not.toContain("left");
  });
});

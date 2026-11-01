import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PatientHistoryTab } from "@/components/ward-management/patients/patient-history-tab";
import type { PatientNowRecord } from "@/components/ward-management/patients/patient-now-records";

// On a movement route the record's id is the movement (WF-*), not the patient (PT-*). History must
// still find the linked patient's earlier episodes, as Community, Details and Documents do. Synthetic.
afterEach(() => {
  cleanup();
});

function renderHistory(patientId?: string) {
  render(
    <PatientHistoryTab
      record={{ id: "WF-999", presentations: [] } as unknown as PatientNowRecord}
      patientId={patientId}
      dayZero={new Date(2026, 9, 21)}
      unitName={() => undefined}
      open
      onBackToNow={() => undefined}
    />,
  );
}

describe("History on a movement route", () => {
  it("shows the linked patient's earlier episodes", () => {
    renderHistory("PT-023");
    expect(screen.getAllByText(/14 Jun/).length).toBeGreaterThan(0);
  });

  it("shows none when no patient is linked", () => {
    renderHistory(undefined);
    expect(screen.queryAllByText(/14 Jun/)).toHaveLength(0);
  });
});

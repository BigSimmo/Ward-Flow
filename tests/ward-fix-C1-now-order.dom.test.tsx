// Fix round C1 (nightly pictures note, Josh approved 13 Nov 2026): on the Patient page the blocker
// (the status card, "Cannot move / No ward asked") comes before the triage and Carer call back rows,
// on a phone, a tablet in portrait and a desktop, so the new rows never push it below the fold.
// Synthetic data only.
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const viewport = vi.hoisted(() => ({ phone: false, portrait: false }));
vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => viewport.phone,
  useIsTabletPortrait: () => viewport.portrait,
}));
vi.mock("@/components/ward-management/patients/patient-status-card", () => ({
  PatientStatusCard: () => <div data-testid="status-card">Cannot move</div>,
}));

import { PatientNowLayout } from "@/components/ward-management/patients/patient-now-layouts";
import type { PatientStatusContext } from "@/components/ward-management/patients/patient-status-card";

afterEach(cleanup);

function renderLayout() {
  render(
    <PatientNowLayout
      mode="find"
      context={{} as PatientStatusContext}
      legal={null}
      why={null}
      change={null}
      calls={[]}
      sheetRows={null}
      tiles={<div data-testid="carer-call-back">Carer call back</div>}
    />,
  );
  const card = screen.getByTestId("status-card");
  const carer = screen.getByTestId("carer-call-back");
  return card.compareDocumentPosition(carer) & Node.DOCUMENT_POSITION_FOLLOWING;
}

describe("the blocker leads the Carer call back row", () => {
  it.each([
    ["phone", { phone: true, portrait: false }],
    ["tablet portrait", { phone: false, portrait: true }],
    ["desktop", { phone: false, portrait: false }],
  ])("on a %s", (_name, size) => {
    Object.assign(viewport, size);
    expect(renderLayout()).toBeTruthy();
  });
});

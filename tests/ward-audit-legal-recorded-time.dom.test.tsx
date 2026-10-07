import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Movement } from "@/components/ward-management/ward-model";

vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>()),
  useWardFlow: () => context,
  useWardFlowClock: () => NOW_ANCHOR,
}));

const context = { ...seedWardFlowState(), dayZero: new Date("2026-09-23T00:00:00"), dispatch: vi.fn() };

// Owner, 26 Sept 2026: the button's accessible name is now the resolved patient's formal name, never
// the WF journey number — resolved from the same fixture movement below, against this context's own
// patients/referrals, rather than typed by hand.
const auditMovement: Movement = {
  ...seedWardFlowState().movements[0],
  id: "WF-AUDIT-LEGAL",
  legalForm: { code: "3D", dueAt: NOW_ANCHOR + 45 },
  formedAt: NOW_ANCHOR - 20,
  legalClock: {
    code: "1A",
    startedAt: NOW_ANCHOR - 500,
    expiresAt: NOW_ANCHOR + 5000,
    basis: "written",
    region: "metro",
    ageBand: "adult",
  },
};
const inspectButtonName = `Open dossier for ${resolveSubjectPatient(auditMovement, context).formalName}`;

beforeEach(() => {
  context.dispatch.mockClear();
  context.movements = [auditMovement];
});

describe("Legal Forms current paper facts", () => {
  it("does not present a conflicting legacy legal clock as a second current expiry", () => {
    render(<LegalFormsScreen />);
    fireEvent.click(screen.getByRole("button", { name: inspectButtonName }));
    expect(screen.getByText("Recorded deadline")).toBeVisible();
    expect(screen.queryByTestId("ward-legal-forms-clock-WF-AUDIT-LEGAL")).not.toBeInTheDocument();
    expect(screen.getByText("Time written")).toBeVisible();
  });

  it("records an entered written time without calculating or gating on a statutory expiry", () => {
    render(<LegalFormsScreen />);
    fireEvent.click(screen.getByRole("button", { name: inspectButtonName }));
    fireEvent.change(screen.getByLabelText("Date the form was written"), { target: { value: "2026-09-23" } });
    fireEvent.change(screen.getByLabelText("Time the form was written"), { target: { value: "09:30" } });
    expect(screen.getByTestId("ward-legal-forms-clock-preview-WF-AUDIT-LEGAL")).toHaveTextContent(
      "No expiry is calculated.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Save time written" }));
    expect(context.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RECORD_LEGAL_FORM_WRITTEN",
        movementId: "WF-AUDIT-LEGAL",
        formCode: "3D",
        writtenAt: expect.any(Number),
      }),
    );
  });
});

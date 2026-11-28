import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * WS-19 (H-0983, workflow speed audit 26 Oct 2026): on a phone the open step sheet covers the head,
 * so "Jump to Clearance" could not be tapped and the user stepped through Next twice. The sheet's
 * own head now carries the jump buttons, leaving out the step already open.
 */

vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => true,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  discardReferralDraft();
});

function seededPatientId() {
  const state = seedWardFlowState();
  for (const movement of state.movements) {
    if (movement.closure) continue;
    const patient = resolveSubjectPatient(movement, state).patient;
    if (patient) return patient.id;
  }
  throw new Error("the seed has no person on an open journey");
}

describe("phone referral step sheet", () => {
  it("jumps to Clearance from the step rows, with no separate Jump buttons", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer
          onClose={vi.fn()}
          initialCategory="ed"
          initialDestination="ward"
          initialPatientId={seededPatientId()}
        />
      </WardFlowProvider>,
    );
    // Audit four 62: the "Jump to" buttons are gone. The step rows are the jumps, and the foot line
    // says only that the form was pre-filled from the record.
    expect(screen.getByTestId("ward-referral-fast-track")).toHaveTextContent("pre-filled from the record");
    expect(screen.queryByTestId("ward-referral-sheet-jump-clearance")).not.toBeInTheDocument();
    const steps = within(screen.getByRole("group", { name: "Referral sections" }));
    fireEvent.click(steps.getByRole("button", { name: /^Clearance/ }));
    expect(screen.getByText(/^\d+ · Clearance$/)).toBeInTheDocument();
  });
});

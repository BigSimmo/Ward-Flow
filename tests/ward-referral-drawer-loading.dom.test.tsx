import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * A ward opening a referral on a slow phone sees the drawer at once, saying it is opening, and can
 * close it, rather than the tap appearing to do nothing while the referral's script arrives (PC
 * review, 27 Oct 2026). `next/dynamic` is held at its loading state to stand in for that wait.
 */
vi.mock("next/dynamic", () => ({
  default: (_load: unknown, options: { loading?: () => ReactNode }) => {
    const Loading: ComponentType = () => <>{options.loading?.()}</>;
    return Loading;
  },
}));

import { WardReferralDetailDrawer } from "@/components/ward-management/ward/ward-awaiting-referral";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("opening a referral before its script has arrived", () => {
  it("shows the drawer with an opening status, named for the patient, and closes it", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((candidate) => candidate.patientId !== undefined)!;
    const unit = state.units[0];
    const identity = resolveSubjectPatient(movement, state);
    const onClose = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDetailDrawer
          movement={movement}
          unit={unit}
          now={NOW_ANCHOR}
          identity={identity}
          onClose={onClose}
          blocked={undefined}
          onDecline={() => {}}
          onAccept={() => {}}
        />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-referral-drawer-loading").textContent).toBe("Opening the referral…");
    expect(screen.getByRole("dialog", { name: identity.displayName })).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

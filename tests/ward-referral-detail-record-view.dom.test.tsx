import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SharedSessionContext } from "@/components/ward-management/shell/ward-shared-session-context";
import { WardReferralDetailDrawer } from "@/components/ward-management/ward/ward-referral-detail";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** D-80: since D-79 the referral detail shows name, UMRN and documents, so opening it is a record view. */
describe("opening a referral's full detail", () => {
  const state = seedWardFlowState();
  const movement = state.movements.find((candidate) => candidate.patientId !== undefined)!;
  const unit = state.units[0];
  const drawer = () => (
    <WardReferralDetailDrawer
      movement={movement}
      unit={unit}
      now={NOW_ANCHOR}
      identity={resolveSubjectPatient(movement, state)}
      onClose={() => {}}
      blocked={undefined}
      onDecline={() => {}}
      onAccept={() => {}}
    />
  );

  it("is logged once, as a referral record view, in the signed-in shared workspace", () => {
    const logRecordView = vi.fn();
    // The shell memoises its session, so a re-render keeps the same one.
    const session = { signOut: vi.fn(), logRecordView };
    const { rerender } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SharedSessionContext.Provider value={session}>{drawer()}</SharedSessionContext.Provider>
      </WardFlowProvider>,
    );
    expect(logRecordView).toHaveBeenCalledTimes(1);
    expect(logRecordView).toHaveBeenCalledWith(movement.patientId, "referral");
    rerender(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SharedSessionContext.Provider value={session}>{drawer()}</SharedSessionContext.Provider>
      </WardFlowProvider>,
    );
    expect(logRecordView).toHaveBeenCalledTimes(1);
  });

  it("logs the patient a referral link names when the journey has no direct link", () => {
    const linked = state.movements.find(
      (candidate) =>
        candidate.patientId === undefined &&
        state.referrals.some((referral) => referral.id === candidate.referralId && referral.patientId !== undefined),
    )!;
    const identity = resolveSubjectPatient(linked, state);
    expect(identity.patient).toBeDefined();
    const logRecordView = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SharedSessionContext.Provider value={{ signOut: vi.fn(), logRecordView }}>
          <WardReferralDetailDrawer
            movement={linked}
            unit={unit}
            now={NOW_ANCHOR}
            identity={identity}
            onClose={() => {}}
            blocked={undefined}
            onDecline={() => {}}
            onAccept={() => {}}
          />
        </SharedSessionContext.Provider>
      </WardFlowProvider>,
    );
    expect(logRecordView).toHaveBeenCalledWith(identity.patient!.id, "referral");
  });

  it("logs nothing in the local demo", () => {
    expect(() => render(<WardFlowProvider initialNow={NOW_ANCHOR}>{drawer()}</WardFlowProvider>)).not.toThrow();
  });
});

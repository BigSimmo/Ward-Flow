import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isNotVoluntary } from "@/components/ward-management/ward-legal-meaning";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// D-186 item 4, drawn on screen: the coordinator's legal status change asks for the legal form for any
// chosen status other than Voluntary (the "not voluntary" rule), a referral for examination included,
// and asks none while no status is chosen. Synthetic seed records only.

afterEach(cleanup);

const MOVEMENT = seedWardFlowState().movements.find((movement) => isOpen(movement))!;

function Harness() {
  const { movements, units, bedReleases, leaveBeds, referrals, now, dispatch, configuration } = useWardFlow();
  return (
    <ShortlistPanel
      movement={movements.find((candidate) => candidate.id === MOVEMENT.id)}
      now={now}
      units={units}
      bedReleases={bedReleases}
      leaveBeds={leaveBeds}
      admissions={wardAdmissions}
      referrals={referrals}
      selectedUnitId={undefined}
      onSelectUnit={() => {}}
      dispatch={dispatch}
      parallelReferralCap={configuration.parallelReferralCap}
    />
  );
}

describe("the shortlist asks for the legal form by the not voluntary rule", () => {
  it("asks for every chosen status but Voluntary, and none before a status is chosen", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Harness />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-change-legal-status-toggle"));
    const status = screen.getByLabelText(/^Legal status for/u) as HTMLSelectElement;
    const values = [...status.options].map((option) => option.value);
    expect(values).toContain("Referred for psychiatric examination");
    expect(values).toContain("Voluntary");
    for (const value of values) {
      fireEvent.change(status, { target: { value } });
      const asked = screen.queryByTestId("ward-change-legal-status-form") !== null;
      expect(asked, value || "no status chosen").toBe(isNotVoluntary(value || undefined));
    }
  });
});

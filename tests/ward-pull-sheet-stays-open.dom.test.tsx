import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The sheet's form is stubbed: this pins only where the sheet lives, not what it asks.
vi.mock("@/components/ward-management/referrals/pull-accepted-referral", () => ({
  PullAcceptedReferral: () => <p data-testid="pull-form-stub">Journey started without the bed</p>,
}));
vi.mock("@/components/ward-management/ward-patient-name", () => ({
  usePatientOf: () => () => ({ formalName: "SMITH, Alex", umrn: "U0000001" }),
}));
vi.mock("@/components/ward-management/settings/discreet-names", () => ({
  usePatientNameDisplay: () => (name: string) => name,
}));

import { AcceptedPullRows, useAcceptedPull } from "@/components/ward-management/coordinator/accepted-pull-rows";
import type { AcceptedAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";

const entry = {
  referral: { id: "ref-1", originSiteCode: "SYN", destinations: [] },
  unitId: "unit-1",
  unitName: "Synthetic Ward",
} as unknown as AcceptedAwaitingPull;

function Page({ toPull }: { toPull: readonly AcceptedAwaitingPull[] }) {
  const pull = useAcceptedPull();
  return (
    <>
      {pull.sheet}
      {toPull.length > 0 ? (
        <AcceptedPullRows
          toPull={toPull}
          now={0 as never}
          phone={false}
          testId="rows"
          pulling={pull.pulling}
          setPulling={pull.setPulling}
        />
      ) : null}
    </>
  );
}

describe("Pull the bed sheet (Alerts #1230 bug)", () => {
  it("stays open when starting the journey without the bed removes the last row", async () => {
    const { rerender } = render(<Page toPull={[entry]} />);
    fireEvent.click(screen.getAllByRole("button", { name: /^Pull the bed for / }).at(-1)!);
    expect(await screen.findByTestId("pull-form-stub")).toBeInTheDocument();
    rerender(<Page toPull={[]} />);
    expect(screen.queryByTestId("rows")).not.toBeInTheDocument();
    expect(screen.getByTestId("pull-form-stub")).toBeInTheDocument();
  });
});

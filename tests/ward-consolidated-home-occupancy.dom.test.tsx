import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Movement, Referral } from "@/components/ward-management/ward-model";

const seed = seedWardFlowState();
const original = seed.units[0]!;
const unit = {
  ...original,
  beds: 2,
  blocked: 0,
  closedBeds: [],
  isClosed: false,
  empty: { ...original.empty, value: 1 },
  allocatable: { ...original.allocatable, value: 1 },
};
const referral: Referral = {
  ...seed.referrals[0]!,
  destinations: [
    {
      ...seed.referrals[0]!.destinations[0]!,
      state: "accepted",
      destination: {
        kind: "psychiatric_ward",
        unitId: unit.id,
        sex: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
      acceptedUnitId: unit.id,
      heldBedNumber: 2,
      withdrawnAt: undefined,
    },
  ],
};
const movement: Movement = {
  ...seed.movements[0]!,
  acceptedUnitId: unit.id,
  heldBedNumber: 2,
  admissionId: undefined,
  referralId: undefined,
  stage: "accepted_awaiting_bed",
  closure: undefined,
};
const units = [unit];
const admissions: typeof seed.admissions = [];
const bedReleases: typeof seed.bedReleases = [];
const leaveBeds: typeof seed.leaveBeds = [];
const heldReferrals = [referral];
const heldMovements = [movement];
const noReferrals: Referral[] = [];
const noMovements: Movement[] = [];

function Picture({ held, kind }: { held: boolean; kind: "referral" | "movement" }) {
  const flow = useWardFlow();
  return (
    <WardFlowOverride
      value={{
        ...flow,
        units,
        admissions,
        bedReleases,
        leaveBeds,
        referrals: held && kind === "referral" ? heldReferrals : noReferrals,
        movements: held && kind === "movement" ? heldMovements : noMovements,
      }}
    >
      <CoordinatorScreen />
    </WardFlowOverride>
  );
}
function App({ held, kind }: { held: boolean; kind: "referral" | "movement" }) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Picture held={held} kind={kind} />
    </WardFlowProvider>
  );
}
afterEach(cleanup);

describe("Home occupancy includes named incoming reservations", () => {
  it.each(["referral", "movement"] as const)(
    "updates on adding and releasing a %s hold without remounting Home",
    (kind) => {
      const view = render(<App held={false} kind={kind} />);
      expect(screen.getByTestId("ward-home-occupancy-link")).toHaveTextContent("50.0%");
      view.rerender(<App held kind={kind} />);
      expect(screen.getByTestId("ward-home-occupancy-link")).toHaveTextContent("100.0%");
      view.rerender(<App held={false} kind={kind} />);
      expect(screen.getByTestId("ward-home-occupancy-link")).toHaveTextContent("50.0%");
    },
  );
});

// Audit 24-1 B-06: the ED "Withdraw referral" confirm counts an accepted request as live, says the
// pulled bed is released, and names the person with their UMRN. Synthetic seed data only.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardFlowContextValue } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => cleanup());

const ED_ID = "fsh-ed";
const seen: { current?: WardFlowContextValue } = {};

function Probe() {
  const state = useWardFlow();
  useLayoutEffect(() => {
    seen.current = state;
  });
  return null;
}

describe("ED Withdraw referral confirm with a pulled bed (B-06)", () => {
  it("counts the accepted request, says the pulled bed is released, and shows the UMRN", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId={ED_ID} />
        <Probe />
      </WardFlowProvider>,
    );
    const state = seen.current!;
    const pulled = state.movements.find(
      (movement) =>
        movement.originEdId === ED_ID &&
        !movement.closure &&
        movement.stage === "pulled" &&
        movement.acceptedUnitId !== undefined &&
        movement.transport?.collectedAt === undefined,
    );
    expect(pulled, "the seed must carry a pulled, uncollected movement at this ED").toBeTruthy();
    const ward = state.units.find((unit) => unit.id === pulled!.acceptedUnitId)!.name;
    const person = state.resolvePatientIdentity(pulled!);

    fireEvent.click(screen.getByTestId(`ward-ed-withdraw-referral-toggle-${pulled!.id}`));
    const confirm = screen.getByTestId(`ward-ed-withdraw-referral-${pulled!.id}`);
    expect(confirm).not.toHaveTextContent("all 0");
    expect(confirm).toHaveTextContent(
      `Withdraw the referral for ${person.displayName} (${person.umrn})? This says the patient no longer needs a bed, so it withdraws that referral and releases the bed pulled at ${ward} and closes the movement.`,
    );
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  WARD_FLOW_DEMO_STORAGE_KEY,
  WardFlowProvider,
  useWardFlow,
} from "@/components/ward-management/ward-flow-provider";

/**
 * Q77 (Josh, 31 Oct 2026): screens show the seed's earlier role word under its new name, while the
 * workspace that is saved keeps the word as it was recorded. Synthetic seed records only.
 */
function AgreedByProbe() {
  const { movements, now, dispatch } = useWardFlow();
  const agreedBy = movements.flatMap((movement) => movement.acceptanceConditions ?? []).map((item) => item.agreedBy);
  return (
    <>
      <output data-testid="agreed-by">{agreedBy.join(" | ")}</output>
      <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 20 })}>
        Advance demo
      </button>
    </>
  );
}

afterEach(() => window.sessionStorage.clear());

describe("Q77 in the provider: shown in the new names, saved as recorded", () => {
  it("shows the new name on screen and saves the earlier word", () => {
    render(
      <WardFlowProvider>
        <AgreedByProbe />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Advance demo" }));
    const onScreen = screen.getByTestId("agreed-by").textContent ?? "";
    expect(onScreen).toContain("Nurse in charge");
    expect(onScreen).not.toContain("Ward manager");
    const saved = window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY) ?? "";
    expect(saved).toContain('"agreedBy":"Ward manager"');
  });
});

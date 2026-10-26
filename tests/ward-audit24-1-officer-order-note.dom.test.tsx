import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(cleanup);

/**
 * Audit 24-1 decision 5 (Josh, 25 Oct 2026): the transport job list keeps its "Next action" order
 * (it is not the ED queue, so the never-build rule does not cover it) and says so on screen.
 * Synthetic demo data only.
 */
describe("officer job list order is stated (audit 24-1 decision 5)", () => {
  it("names the next-action order while that sort is chosen, and drops it for another sort", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerScreen />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-officer-order-note").textContent).toBe(
      "Next action order: late jobs first, then forms still to upload, then the jobs furthest along.",
    );
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Sort jobs" })).getByText("Longest wait"));
    expect(screen.queryByTestId("ward-officer-order-note")).toBeNull();
  });
});

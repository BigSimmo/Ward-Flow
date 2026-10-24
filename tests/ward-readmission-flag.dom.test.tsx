import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// A ward's own page (`ward-chrome-role.ts` reads the role from the route).
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/ward-flow/ward/rph-adult-secure",
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { ReadmissionFlag } from "@/components/ward-management/ward-readmission-flag";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** D-80: on a ward's route the chip shows only the flag its own copy carries, never another ward. */
describe("readmission chip on a ward's page (D-80)", () => {
  const flag = { dischargedAt: NOW_ANCHOR - 3 * 24 * 60, daysBefore: 3 };

  it("shows a ward copy's flag without naming the other ward", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReadmissionFlag flag={flag} wardCopy expandable={false} testId="chip" />
      </WardFlowProvider>,
    );
    const chip = screen.getByTestId("chip");
    expect(chip).toHaveTextContent("28d readmission");
    expect(chip).toHaveAttribute("title", expect.stringMatching(/from a psychiatric ward · 3d before$/u));
  });

  it("still hides the coordinator's flag on a ward's route", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReadmissionFlag flag={{ ...flag, unitName: "Another ward" }} testId="chip" />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("chip")).toBeNull();
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * A2-3 (audit 13 Oct 2026): New referral from Peel ED opened on a Midland ED person, a hard-coded
 * demo key. With no named person the sheet now opens on nobody and asks for a patient.
 */
afterEach(cleanup);

describe("New referral with no named person", () => {
  for (const initialCategory of ["ward", "ed", "community"] as const) {
    it(`opens on no patient from the ${initialCategory} menu`, () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <WardReferralDrawer onClose={() => {}} initialCategory={initialCategory} />
        </WardFlowProvider>,
      );
      expect(screen.getByTestId("ward-referral-no-patient")).toHaveTextContent("No patient chosen");
      expect(document.body).not.toHaveTextContent("Rhys Cadwaller");
      expect(screen.getByRole("searchbox", { name: "Find a patient" })).toBeInTheDocument();
    });
  }

  it("still opens on the named person when a row names one", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={() => {}} initialPatientId="PT-023" />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-referral-no-patient")).toBeNull();
  });
});

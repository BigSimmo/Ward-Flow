// Audit 24-1 A-02: an arrival plan does not clear the pull time limit (the engine keeps it, E-13),
// and the Patient page reads the recorded `pullExpiresAt`, never a typed "4h". Synthetic data only.
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderArrivalSection } from "@/components/ward-management/patients/patient-now-arrival-section";
import type { PatientArrivalSectionContext } from "@/components/ward-management/patients/patient-now-arrival-section";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => cleanup());

// Ward Flow instants are minutes.
const MINUTE = 1;

function renderSection(pullExpiresAt: number | undefined, withPlan: boolean) {
  const movement = {
    id: "WF-AUDIT-ARRIVAL",
    stage: "pulled",
    pullExpiresAt,
    arrivalDetails: withPlan ? { estimatedArrivalAt: NOW_ANCHOR + 30 * MINUTE, mode: undefined } : undefined,
  } as unknown as Movement;
  const ctx: PatientArrivalSectionContext = {
    acceptingWardName: "Synthetic Ward",
    displayCadNumber: undefined,
    hasArrivalPlan: withPlan,
    // The screen forces this false once a plan exists; the section must not rely on it.
    isHoldExpired: false,
    isOverdue: false,
    isPulled: true,
    liveMovement: movement,
    mode: "held",
    now: NOW_ANCHOR,
    pullExpiresAt,
    setShowArrivalTimeModal: () => undefined,
    setShowUploadFormsModal: () => undefined,
    uploadedForms: [],
  };
  return render(<>{renderArrivalSection(ctx)}</>);
}

describe("Patient page arrival plan: the pull time limit stays (A-02)", () => {
  it("keeps showing a lapsed pull once an arrival time is recorded, and never says cleared", () => {
    renderSection(NOW_ANCHOR - 10 * MINUTE, true);
    const banner = screen.getByTestId("ward-patient-pulled-banner");
    expect(banner).not.toHaveTextContent(/cleared/i);
    expect(banner).not.toHaveTextContent(/\b4h\b/);
    expect(screen.getByTestId("ward-patient-pull-hold-remaining")).toHaveAttribute("data-tone", "danger");
    const limit = screen.getByTestId("ward-patient-pull-time-limit");
    expect(limit).toHaveTextContent(/^Passed at .+ AWST\. Pull expired 10m ago\. Move or release\.$/);
  });

  it("reads the recorded expiry for an extra-travel pull, with no typed 4h", () => {
    renderSection(NOW_ANCHOR + 300 * MINUTE, false);
    const banner = screen.getByTestId("ward-patient-pulled-banner");
    expect(banner).not.toHaveTextContent(/\b4h\b/);
    expect(screen.getByTestId("ward-patient-pull-time-limit")).toHaveTextContent(
      /^Until .+ AWST\. Pull 5h 00m left\.$/,
    );
  });

  it("says when no pull time limit is recorded", () => {
    renderSection(undefined, true);
    expect(screen.getByTestId("ward-patient-pull-time-limit")).toHaveTextContent("No pull time limit recorded");
    expect(screen.queryByTestId("ward-patient-pull-hold-remaining")).not.toBeInTheDocument();
  });
});

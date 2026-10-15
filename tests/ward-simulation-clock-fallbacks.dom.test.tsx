import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GlobalSearchPreview } from "@/components/ward-management/search/global-search-preview";
import { RecordPreview } from "@/components/ward-management/search/record-preview";
import { WardMhaCalculator } from "@/components/ward-management/tools/ward-mha-calculator";
import { perthMidnight } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("M-TIME-01: simulation clock resolution instead of browser wall-clock new Date()", () => {
  const seed = seedWardFlowState();
  const basePatient = seed.patients[0]!;

  it("GlobalSearchPreview computes patient age from simulation dayZero and now rather than wall-clock Date", () => {
    // Patient born on 16 Aug 1990:
    // On dayZero (15 Aug 2026) they are 35y; two days later (17 Aug 2026, now = NOW_ANCHOR + 2880) they are 36y.
    const birthdayPatient = {
      ...basePatient,
      id: "PT-CLOCK-TEST" as const,
      umrn: "UM999001",
      dateOfBirth: "1990-08-16",
      sex: "Female" as const,
    };
    const scenarioDayZero = perthMidnight(2026, 7, 15); // 15 Aug 2026

    const { rerender } = render(
      <GlobalSearchPreview
        item={{
          kind: "person",
          id: birthdayPatient.id,
          title: "Clock Test",
          meta: "",
          href: "/mockups/ward-flow/patients",
        }}
        patients={[birthdayPatient]}
        referrals={[]}
        movements={[]}
        units={seed.units}
        now={NOW_ANCHOR}
        dayZero={scenarioDayZero}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ward-global-search-preview")).toHaveTextContent("UM999001 · 35y · F");

    rerender(
      <GlobalSearchPreview
        item={{
          kind: "person",
          id: birthdayPatient.id,
          title: "Clock Test",
          meta: "",
          href: "/mockups/ward-flow/patients",
        }}
        patients={[birthdayPatient]}
        referrals={[]}
        movements={[]}
        units={seed.units}
        now={NOW_ANCHOR + 2 * 1440}
        dayZero={scenarioDayZero}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ward-global-search-preview")).toHaveTextContent("UM999001 · 36y · F");
  });

  it("RecordPreview computes patient age from dayZero and now across multi-day simulation advances", () => {
    const birthdayPatient = {
      ...basePatient,
      id: "PT-RECORD-CLOCK" as const,
      umrn: "UM999002",
      dateOfBirth: "1986-08-16",
    };
    const scenarioDayZero = perthMidnight(2026, 7, 15); // 15 Aug 2026

    const { container, rerender } = render(
      <RecordPreview
        selection={{ kind: "person", patient: birthdayPatient }}
        referrals={[]}
        movements={[]}
        patients={[birthdayPatient]}
        units={seed.units}
        now={NOW_ANCHOR}
        dayZero={scenarioDayZero}
        onClose={vi.fn()}
      />,
    );
    expect(container.textContent).toContain("39 years");

    rerender(
      <RecordPreview
        selection={{ kind: "person", patient: birthdayPatient }}
        referrals={[]}
        movements={[]}
        patients={[birthdayPatient]}
        units={seed.units}
        now={NOW_ANCHOR + 2 * 1440}
        dayZero={scenarioDayZero}
        onClose={vi.fn()}
      />,
    );
    expect(container.textContent).toContain("40 years");
  });

  it("WardMhaCalculator resolves multi-day simulation instant offsets cleanly from referenceNow", () => {
    const scenarioInstant = new Date(perthMidnight(2026, 7, 15).getTime() + (NOW_ANCHOR + 1440) * 60_000);
    render(<WardMhaCalculator referenceNow={scenarioInstant} />);
    expect(screen.getByLabelText("Order expiry date written on form")).toHaveValue("2026-08-16");
    expect(screen.getByLabelText("Order expiry time written on form")).toHaveValue("10:42");
  });
});

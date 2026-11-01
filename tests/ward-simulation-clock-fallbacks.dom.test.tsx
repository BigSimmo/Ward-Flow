import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { GlobalSearchPreview } from "@/components/ward-management/search/global-search-preview";
import { RecordPreview } from "@/components/ward-management/search/record-preview";
import { WardFormTimes } from "@/components/ward-management/tools/ward-form-times";
import { perthMidnight } from "@/components/ward-management/ward-clock";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { typeDate } from "./helpers/type-date-time";

describe("M-TIME-01: simulation clock resolution instead of browser wall-clock new Date()", () => {
  const seed = seedWardFlowState();
  const basePatient = seed.patients[0]!;

  // New York is west of Perth, Sydney east of it: a browser-local midnight rebuilt from the Perth day is
  // the day before in Sydney, which showed a patient a year younger on their birthday.
  it.each(["America/New_York", "Australia/Sydney"])(
    "GlobalSearchPreview computes patient age from simulation dayZero and now rather than wall-clock Date (%s)",
    (zone) => {
      vi.stubEnv("TZ", zone);
      try {
        // Patient born on 16 Aug 1990:
        // On dayZero (15 Aug 2026) they are 35y; on their Perth birthday (16 Aug 2026, now = NOW_ANCHOR + 1440) they are 36y.
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
              href: "/ward-flow/patients",
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
              href: "/ward-flow/patients",
            }}
            patients={[birthdayPatient]}
            referrals={[]}
            movements={[]}
            units={seed.units}
            now={NOW_ANCHOR + 1440}
            dayZero={scenarioDayZero}
            onOpen={vi.fn()}
          />,
        );
        expect(screen.getByTestId("ward-global-search-preview")).toHaveTextContent("UM999001 · 36y · F");
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );

  it.each(["America/New_York", "Australia/Sydney"])(
    "RecordPreview computes patient age from dayZero and now across multi-day simulation advances (%s)",
    (zone) => {
      vi.stubEnv("TZ", zone);
      try {
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
            now={NOW_ANCHOR + 1440}
            dayZero={scenarioDayZero}
            onClose={vi.fn()}
          />,
        );
        expect(container.textContent).toContain("40 years");
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );

  it("WardFormTimes resolves simulation dayZero and demoNow cleanly without wall-clock drift", () => {
    const scenarioDayZero = perthMidnight(2026, 7, 15); // 15 Aug 2026
    function OverrideDayZero({ children }: { children: ReactNode }) {
      const value = useWardFlow();
      return <WardFlowOverride value={{ ...value, dayZero: scenarioDayZero }}>{children}</WardFlowOverride>;
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR + 1440}>
        <OverrideDayZero>
          <WardFormTimes />
        </OverrideDayZero>
      </WardFlowProvider>,
    );
    // The date no longer starts on the demo day (no form time is prefilled, 19 Oct 2026), so type
    // the demo clock's own Perth date and time and read the gap: zero means the scenario day was used.
    expect(screen.getByLabelText("Date written on form")).toHaveValue("");
    expect(screen.getByLabelText("Time written on form")).toHaveValue("");
    const minutes = NOW_ANCHOR + 1440;
    const day = 15 + Math.floor(minutes / 1440);
    const clock = `${String(Math.floor((minutes % 1440) / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    fireEvent.change(screen.getByRole("combobox", { name: "Form" }), { target: { value: "1A" } });
    typeDate(screen.getByLabelText("Date written on form"), `2026-08-${day}`);
    fireEvent.change(screen.getByLabelText("Time written on form"), { target: { value: clock } });
    expect(screen.getByRole("status")).toHaveTextContent("0h 00m");
  });
});

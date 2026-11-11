// M120 (master audit list, 10 Nov 2026; Josh approved the fix, D-125): every forecast surface states
// its method, and the ED "May pass" card names nobody. Synthetic rows only.
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const phone = vi.hoisted(() => ({ value: false }));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => <a {...props}>{children}</a>,
}));
vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => phone.value,
}));
vi.mock("@/components/ward-management/shell/ward-access-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => ({ role: "coordinator" }),
}));
vi.mock("@/components/ward-management/ward-patient-name", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/ward-patient-name")>()),
  usePatientOf: () => () => ({ formalName: "SYNTHETIC, Testperson", umrn: "S0000001" }),
}));
vi.mock("@/components/ward-management/forecast/use-forecast-model", () => ({
  useForecastModel: () => ({
    tomorrow: { kinds: [] },
    levers: [],
    risk: {
      targetMinutes: 1440,
      horizonMinutes: 1440,
      alreadyOver: 1,
      byEd: [{ edId: "ed-synthetic", atRisk: 1, alreadyOver: 1, firstMinutesLeft: 90 }],
      atRisk: [
        {
          movementId: "m-synthetic",
          edId: "ed-synthetic",
          kind: "open_adult",
          urgency: "routine",
          passesAt: 1530,
          minutesLeft: 90,
          slotAt: null,
          nextRelease: null,
          acceptedUnitName: null,
          declines: 0,
        },
      ],
    },
  }),
  useForecastHistory: () => ({ record: { days: [] } }),
  useForecastAlerts: () => [
    { kind: "ed_access_risk", edId: "ed-synthetic", people: 1, firstMinutesLeft: 90, alreadyOver: 0, threshold: 120 },
  ],
  forecastEdName: () => "Synthetic ED",
}));

import { EdAccessRiskCard } from "@/components/ward-management/forecast/ed-access-risk-card";
import { ForecastAlertsGroup } from "@/components/ward-management/forecast/forecast-alerts-group";
import { ForecastBriefPanel } from "@/components/ward-management/forecast/forecast-brief-panel";
import { FORECAST_METHOD_LINE } from "@/components/ward-management/ward-forecast-method";

const METHOD = "From recorded waits and releases. Not a prediction.";

afterEach(() => {
  phone.value = false;
});

describe("M120: the ED May pass card names nobody and states its method", () => {
  it.each([
    ["desktop", false],
    ["phone", true],
  ])("on %s: no name, no UMRN, no Find a bed, and the method line", (_label, isPhone) => {
    phone.value = isPhone;
    render(<EdAccessRiskCard edId="ed-synthetic" now={0} />);
    const card = screen.getByTestId("forecast-ed-risk");
    expect(card).toHaveTextContent("May pass 24 hours in ED");
    expect(card).toHaveTextContent("Open adult");
    expect(card).toHaveTextContent("in 1h 30m");
    expect(card).not.toHaveTextContent("SYNTHETIC");
    expect(card).not.toHaveTextContent("S0000001");
    expect(card).not.toHaveTextContent("Find a bed");
    expect(card.querySelectorAll("a")).toHaveLength(0);
    expect(screen.getByTestId("forecast-ed-risk-method")).toHaveTextContent(METHOD);
  });
});

describe("M120: the TV brief and the forecast alerts state the method", () => {
  it("uses one method line, in plain words", () => {
    expect(FORECAST_METHOD_LINE).toBe(METHOD);
  });

  it("the bed meeting TV brief carries it", () => {
    render(<ForecastBriefPanel now={0} />);
    expect(screen.getByTestId("forecast-brief-method")).toHaveTextContent(METHOD);
  });

  it("the Forecast alerts group carries it beside its Settings link", () => {
    render(<ForecastAlertsGroup now={0} head={(count) => <h2>Forecast {count}</h2>} />);
    expect(screen.getByTestId("ward-alerts-forecast-ed-ed-synthetic")).toHaveTextContent(
      "May pass the ED access target",
    );
    const caption = screen.getByTestId("ward-alerts-forecast-method");
    expect(caption).toHaveTextContent(METHOD);
    expect(caption).toHaveTextContent("Set in Settings");
  });
});

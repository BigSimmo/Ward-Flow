// TC2-07 (audit 26 Oct 2026, H-0766): the forecast says when its days run past the WA holiday list.
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ForecastWeekPanel } from "@/components/ward-management/forecast/forecast-week-panel";
import { WA_PUBLIC_HOLIDAYS_LAST_YEAR } from "@/components/ward-management/wa-public-holidays";
import { perthMidnight } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOTE = `WA public holidays after ${WA_PUBLIC_HOLIDAYS_LAST_YEAR} are not listed yet`;

function panelOn(year: number, monthIndex: number, day: number) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR} initialDayZero={perthMidnight(year, monthIndex, day).getTime()}>
      <ForecastWeekPanel now={NOW_ANCHOR} />
    </WardFlowProvider>,
  );
  return screen.getByTestId("forecast-week");
}

afterEach(cleanup);

describe("forecast week and the WA holiday list", () => {
  it("says nothing while every day shown is on the list", () => {
    expect(panelOn(WA_PUBLIC_HOLIDAYS_LAST_YEAR, 5, 1)).not.toHaveTextContent(NOTE);
  });

  it("says holidays are not marked once the seven days reach past the last listed year", () => {
    expect(panelOn(WA_PUBLIC_HOLIDAYS_LAST_YEAR, 11, 28)).toHaveTextContent(NOTE);
  });
});

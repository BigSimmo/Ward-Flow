// P072 (27 Oct 2026): "Next 7 days" said weekend days and days after tomorrow only by shading and
// italics. Each header now says it in words too.
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ForecastWeekPanel } from "@/components/ward-management/forecast/forecast-week-panel";
import { WA_PUBLIC_HOLIDAYS_LAST_YEAR } from "@/components/ward-management/wa-public-holidays";
import { perthMidnight } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(cleanup);

describe("Next 7 days header labels", () => {
  it("names weekend days and days that may move in words, not only by style", () => {
    render(
      <WardFlowProvider
        initialNow={NOW_ANCHOR}
        initialDayZero={perthMidnight(WA_PUBLIC_HOLIDAYS_LAST_YEAR, 5, 1).getTime()}
      >
        <ForecastWeekPanel now={NOW_ANCHOR} />
      </WardFlowProvider>,
    );
    const heads = within(screen.getByTestId("forecast-week-table"))
      .getAllByRole("columnheader")
      .slice(1)
      .map((cell) => cell.textContent ?? "");
    expect(heads).toHaveLength(7);
    // Today and tomorrow are firm; every later day says it may move.
    heads.slice(0, 2).forEach((text) => expect(text).not.toMatch(/may move/));
    heads.slice(2).forEach((text) => expect(text).toMatch(/may move\)$/));
    // Every Saturday and Sunday says weekend (unless it is a listed holiday, which says holiday).
    heads.filter((text) => /^(Sat|Sun) /.test(text)).forEach((text) => expect(text).toMatch(/\((weekend|holiday)/));
    expect(heads.some((text) => /^(Sat|Sun) /.test(text))).toBe(true);
  });
});

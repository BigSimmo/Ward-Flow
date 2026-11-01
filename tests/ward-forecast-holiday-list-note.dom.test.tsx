// TC2-07 (audit 26 Oct 2026, H-0766): the discharge weekend list says when its days run past the WA
// holiday list. (The forecast week panel this file also covered was deleted on 1 Nov 2026, Q96.)
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DischargeWeekendPrep } from "@/components/ward-management/discharges/discharge-weekend-prep";
import { WA_PUBLIC_HOLIDAYS_LAST_YEAR } from "@/components/ward-management/wa-public-holidays";
import { perthMidnight } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOTE = `WA public holidays after ${WA_PUBLIC_HOLIDAYS_LAST_YEAR} are not listed yet`;

afterEach(cleanup);

describe("discharge weekend list and the WA holiday list", () => {
  const seed = seedWardFlowState();
  function prepOn(year: number, monthIndex: number, day: number) {
    render(
      <DischargeWeekendPrep
        releases={seed.bedReleases}
        units={seed.units}
        nameFor={() => null}
        now={NOW_ANCHOR}
        dayZero={perthMidnight(year, monthIndex, day)}
        onOpen={() => undefined}
      />,
    );
    return screen.getByTestId("ward-discharge-weekend-prep");
  }

  it("says nothing while its look-ahead is on the list", () => {
    expect(prepOn(WA_PUBLIC_HOLIDAYS_LAST_YEAR, 5, 1)).not.toHaveTextContent(NOTE);
  });

  it("says holidays are not marked once its look-ahead reaches past the last listed year", () => {
    expect(prepOn(WA_PUBLIC_HOLIDAYS_LAST_YEAR, 11, 28)).toHaveTextContent(NOTE);
  });
});

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useForecastModel, type ForecastModel } from "@/components/ward-management/forecast/use-forecast-model";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// H-0359 (USC-08): every forecast panel on a screen calls the model hook. Panels reading the same
// records and clock now share one forecast instead of each working it out again. Synthetic world.
function Panel({ now, seen }: { now: number; seen: ForecastModel[] }) {
  seen.push(useForecastModel(now));
  return null;
}

describe("forecast model shared between panels", () => {
  it("gives panels on the same records and clock the same forecast, and a new one for a new clock", () => {
    const seen: ForecastModel[] = [];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Panel now={NOW_ANCHOR} seen={seen} />
        <Panel now={NOW_ANCHOR} seen={seen} />
        <Panel now={NOW_ANCHOR + 60} seen={seen} />
      </WardFlowProvider>,
    );
    const [first, second, later] = seen;
    expect(first!.tomorrow).toBe(second!.tomorrow);
    expect(first!.risk).toBe(second!.risk);
    expect(first!.levers).toBe(second!.levers);
    expect(later!.tomorrow).not.toBe(first!.tomorrow);
    expect(later!.horizons).toEqual(first!.horizons);
  });
});

// Ported from #1431 (WF-FIG-018): the Capacity forecast records its viewing baseline on leaving.
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BedForecast } from "@/components/ward-management/capacity/capacity-bed-forecast";
import { useCapacityModel } from "@/components/ward-management/capacity/capacity-model";
import {
  FORECAST_LAST_LOOK_STORAGE_KEY,
  parseForecastLook,
} from "@/components/ward-management/forecast/forecast-last-look";
import { useForecastChange, useForecastModel } from "@/components/ward-management/forecast/use-forecast-model";
import { resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { ReactNode } from "react";

const wrapper = ({ children }: { children: ReactNode }) => (
  <WardFlowProvider initialNow={NOW_ANCHOR}>{children}</WardFlowProvider>
);
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));
const lookKeys = () =>
  Object.keys(window.sessionStorage).filter((key) => key.startsWith(FORECAST_LAST_LOOK_STORAGE_KEY));

function ForecastView() {
  const model = useCapacityModel();
  return <BedForecast model={model} onTryScenario={() => {}} onWard={() => {}} />;
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetWardAccessStoreForTests();
  setWardFeatureFlagOnDevice("role-access", true);
});
afterEach(async () => {
  cleanup();
  await flush();
  resetWardAccessStoreForTests();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("Capacity forecast viewing baseline", () => {
  it("the actual Capacity forecast records a viewing baseline on leaving, and alert readers never replace it", async () => {
    const view = render(<ForecastView />, { wrapper });
    expect(lookKeys()).toHaveLength(0);
    view.unmount();
    await flush();
    expect(lookKeys()).toHaveLength(1);
    const key = lookKeys()[0]!;
    const saved = window.sessionStorage.getItem(key);
    const previous = parseForecastLook(saved)!;
    const reader = renderHook(
      ({ now, drop }) => {
        const model = useForecastModel(now);
        const tomorrow = { ...model.tomorrow, total: { ...model.tomorrow.total, likely: previous.likely - drop } };
        return useForecastChange({ ...model, tomorrow }, now, { remember: false });
      },
      { wrapper, initialProps: { now: NOW_ANCHOR + 1, drop: 2 } },
    );
    expect(reader.result.current?.delta).toBe(-2);
    reader.rerender({ now: NOW_ANCHOR + 2, drop: 3 });
    expect(reader.result.current?.delta).toBe(-3);
    expect(window.sessionStorage.getItem(key)).toBe(saved);
    reader.unmount();
    await flush();
    expect(window.sessionStorage.getItem(key)).toBe(saved);
  });
});

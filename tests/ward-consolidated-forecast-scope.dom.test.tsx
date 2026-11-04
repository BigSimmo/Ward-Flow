import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BedForecast } from "@/components/ward-management/capacity/capacity-bed-forecast";
import { useCapacityModel } from "@/components/ward-management/capacity/capacity-model";
import {
  FORECAST_HISTORY_STORAGE_KEY,
  forecastBrowserKey,
  historyEntry,
} from "@/components/ward-management/forecast/forecast-history";
import {
  FORECAST_LAST_LOOK_STORAGE_KEY,
  parseForecastLook,
} from "@/components/ward-management/forecast/forecast-last-look";
import {
  useForecastChange,
  useForecastHistory,
  useForecastModel,
} from "@/components/ward-management/forecast/use-forecast-model";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { ReactNode } from "react";

const east = { role: "coordinator", scope: { kind: "service", service: "East Metro" } } as const;
const south = { role: "coordinator", scope: { kind: "service", service: "South Metro" } } as const;
const wrapper = ({ children }: { children: ReactNode }) => (
  <WardFlowProvider initialNow={NOW_ANCHOR}>{children}</WardFlowProvider>
);
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));
const historyKeys = () =>
  Object.keys(window.localStorage).filter((key) => key.startsWith(FORECAST_HISTORY_STORAGE_KEY));
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

describe("consolidated forecast viewing and fallback scope", () => {
  it("distinguishes actors, roles, desks and worlds in browser identity", () => {
    const key = (actor: string, access = east, scenario = "standard", generation = 1) =>
      forecastBrowserKey(FORECAST_HISTORY_STORAGE_KEY, actor, access, scenario, generation);
    const baseline = key("synthetic-actor");
    expect(key("synthetic-other")).not.toBe(baseline);
    expect(key("synthetic-actor", east, "other-world")).not.toBe(baseline);
    expect(key("synthetic-actor", east, "standard", 2)).not.toBe(baseline);
    expect(forecastBrowserKey(FORECAST_HISTORY_STORAGE_KEY, "synthetic-actor", south, "standard", 1)).not.toBe(
      baseline,
    );
    expect(
      forecastBrowserKey(
        FORECAST_HISTORY_STORAGE_KEY,
        "synthetic-actor",
        { ...east, role: "executive" },
        "standard",
        1,
      ),
    ).not.toBe(baseline);
  });

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

  it("keeps same-actor desk histories separate on the same and following days and ignores legacy copies", () => {
    const legacy = historyEntry(NOW_ANCHOR - 1440, 99, { low: 99, likely: 99, high: 99 });
    window.localStorage.setItem(`${FORECAST_HISTORY_STORAGE_KEY}:local-demo:standard:0`, JSON.stringify([legacy]));
    setWardAccess(east);
    const view = renderHook(
      ({ now, gap }) => {
        const model = useForecastModel(now);
        return useForecastHistory(
          {
            ...model,
            tomorrow: {
              ...model.tomorrow,
              total: { ...model.tomorrow.total, now: gap, low: gap, likely: gap, high: gap },
            },
          },
          now,
        );
      },
      { wrapper, initialProps: { now: NOW_ANCHOR, gap: 6 } },
    );
    expect(view.result.current.history.map((entry) => entry.nowGap)).toEqual([6]);
    act(() => {
      setWardAccess(south);
      view.rerender({ now: NOW_ANCHOR, gap: 4 });
    });
    expect(view.result.current.history.map((entry) => entry.nowGap)).toEqual([4]);
    view.rerender({ now: NOW_ANCHOR + 1440, gap: 4 });
    expect(view.result.current.record.days[0]?.miss).toBe(0);
    expect(historyKeys()).toHaveLength(2);
    act(() => setWardAccess(east));
    expect(view.result.current.history[0]?.nowGap).toBe(6);
    expect(view.result.current.record.days[0]?.miss).toBe(-2);
  });
});

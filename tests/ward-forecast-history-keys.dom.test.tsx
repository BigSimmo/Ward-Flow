import { useEffect } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FORECAST_HISTORY_STORAGE_KEY } from "@/components/ward-management/forecast/forecast-history";
import { useForecastHistory, useForecastModel } from "@/components/ward-management/forecast/use-forecast-model";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

let shownHistory: ReturnType<typeof useForecastHistory>["history"] = [];
function History() {
  const model = useForecastModel(NOW_ANCHOR);
  const { history } = useForecastHistory(model, NOW_ANCHOR);
  useEffect(() => {
    shownHistory = history;
  }, [history]);
  return null;
}

const keys = () => Object.keys(window.localStorage).filter((key) => key.startsWith(FORECAST_HISTORY_STORAGE_KEY));

afterEach(() => window.localStorage.clear());

// P-5 (fresh audit 26 Oct 2026): a reseed or scenario switch starts a new key, and the old ones went
// unswept in the local demo. Writing the current world's key now removes this person's earlier ones.
describe("forecast history keys", () => {
  it("keeps one key per person, dropping earlier worlds and leaving another person's", () => {
    window.localStorage.setItem(`${FORECAST_HISTORY_STORAGE_KEY}:local-demo:standard:0-old`, "[]");
    window.localStorage.setItem(`${FORECAST_HISTORY_STORAGE_KEY}:local-demo:winter-surge:3`, "[]");
    window.localStorage.setItem(`${FORECAST_HISTORY_STORAGE_KEY}:someone-else:standard:0`, "[]");
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <History />
      </WardFlowProvider>,
    );
    const mine = keys().filter((key) => key.includes(":local-demo:"));
    expect(mine).toHaveLength(1);
    expect(mine[0]).not.toMatch(/0-old$|winter-surge:3$/);
    expect(keys()).toContain(`${FORECAST_HISTORY_STORAGE_KEY}:someone-else:standard:0`);
  });

  // Time audit C3/G7 (13 Nov 2026): the key carried the scenario and reseed but not the demo day, and
  // a fresh demonstration starts at the same reseed every day, so yesterday's session was read as
  // today's: today's entry was never taken and yesterday's stood in for it.
  it("starts a new history on a new demo day, so yesterday's session is not read as today's", () => {
    const yesterday = Date.UTC(2026, 10, 11, 16); // Perth midnight, 12 Nov 2026
    const today = yesterday + 86_400_000;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR} initialDayZero={yesterday}>
        <History />
      </WardFlowProvider>,
    );
    const [yesterdayKey] = keys().filter((key) => key.includes(":local-demo:"));
    const stored = JSON.parse(window.localStorage.getItem(yesterdayKey)!);
    window.localStorage.setItem(yesterdayKey, JSON.stringify([{ ...stored[0], nowGap: 999 }]));
    cleanup();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR} initialDayZero={today}>
        <History />
      </WardFlowProvider>,
    );
    const mine = keys().filter((key) => key.includes(":local-demo:"));
    expect(mine).toHaveLength(1);
    expect(mine[0]).not.toBe(yesterdayKey);
    expect(shownHistory).toHaveLength(1);
    expect(shownHistory[0]!.nowGap).not.toBe(999);
  });
});

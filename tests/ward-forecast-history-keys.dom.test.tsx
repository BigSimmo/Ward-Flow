import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FORECAST_HISTORY_STORAGE_KEY } from "@/components/ward-management/forecast/forecast-history";
import { useForecastHistory, useForecastModel } from "@/components/ward-management/forecast/use-forecast-model";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function History() {
  const model = useForecastModel(NOW_ANCHOR);
  useForecastHistory(model, NOW_ANCHOR);
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
});

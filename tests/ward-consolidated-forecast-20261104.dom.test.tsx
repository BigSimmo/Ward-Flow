import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useForecastHistory, useForecastModel } from "@/components/ward-management/forecast/use-forecast-model";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";

function Probe() {
  const model = useForecastModel(NOW_ANCHOR);
  useForecastHistory(model, NOW_ANCHOR);
  return null;
}
afterEach(() => window.localStorage.clear());
describe("daily forecast snapshot recovery", () => {
  it("retries a failed daily snapshot after reconnection and stops after acknowledgement", async () => {
    let fail = true;
    let attempts = 0;
    const snapshots: unknown[] = [];
    const api = {
      forecastHistory: async (body?: { snapshot?: unknown }) => {
        if (body?.snapshot) {
          attempts += 1;
          if (fail) throw new Error("synthetic connection failure");
          snapshots.push(body.snapshot);
        }
        return { shared: true, generation: 0, snapshots, reasons: [] };
      },
    } as unknown as SharedAccessApi;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SharedAccessContext.Provider value={{ api, actorId: "synthetic-actor" }}>
          <Probe />
        </SharedAccessContext.Provider>
      </WardFlowProvider>,
    );
    await waitFor(() => expect(attempts).toBe(1));
    fail = false;
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(snapshots).toHaveLength(1));
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(attempts).toBe(2);
  });
});

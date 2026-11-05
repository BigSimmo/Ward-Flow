import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useForecastHistory, useForecastModel } from "@/components/ward-management/forecast/use-forecast-model";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";
const desk = vi.hoisted(() => ({ scope: { kind: "site", siteCode: "RPH" } as unknown }));
vi.mock("@/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => ({ role: "coordinator", scope: desk.scope }),
}));
function Probe() {
  const model = useForecastModel(NOW_ANCHOR);
  const { history } = useForecastHistory(model, NOW_ANCHOR);
  return (
    <>
      <span data-testid="history-length">{history.length}</span>
      <span data-testid="history-days">{history.map((entry) => entry.day).join(",")}</span>
    </>
  );
}
const api = {} as SharedAccessApi;
function App({ workspaceId, selectedApi = api }: { workspaceId?: string; selectedApi?: SharedAccessApi }) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <SharedAccessContext.Provider value={{ api: selectedApi, actorId: "synthetic-actor", workspaceId }}>
        <Probe />
      </SharedAccessContext.Provider>
    </WardFlowProvider>
  );
}
afterEach(() => window.localStorage.clear());
describe("forecast fallback scope", () => {
  it("partitions workspace and desk histories while retaining each desk's fallback", () => {
    const view = render(<App workspaceId="synthetic-workspace-a" />);
    expect(screen.getByTestId("history-length")).toHaveTextContent("1");
    const keys = () => Object.keys(window.localStorage).filter((key) => key.startsWith("ward-flow-forecast-history:"));
    const first = keys()[0]!;
    const saved = JSON.parse(window.localStorage.getItem(first)!);
    window.localStorage.setItem(first, JSON.stringify([{ ...saved[0], day: saved[0].day - 1 }, ...saved]));
    desk.scope = { kind: "site", siteCode: "SCGH" };
    view.rerender(<App workspaceId="synthetic-workspace-a" />);
    expect(screen.getByTestId("history-length")).toHaveTextContent("1");
    expect(keys()).toHaveLength(2);
    view.rerender(<App workspaceId="synthetic-workspace-b" />);
    expect(screen.getByTestId("history-length")).toHaveTextContent("1");
    expect(keys()).toHaveLength(3);
    expect(JSON.parse(window.localStorage.getItem(first)!)).toHaveLength(2);
  });
  it("keeps different local scoped desks' fallback histories apart", () => {
    desk.scope = { kind: "site", siteCode: "RPH" };
    const local = () => (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Probe />
      </WardFlowProvider>
    );
    const view = render(local());
    expect(screen.getByTestId("history-length")).toHaveTextContent("1");
    const keys = () => Object.keys(window.localStorage).filter((key) => key.startsWith("ward-flow-forecast-history:"));
    const first = keys()[0]!;
    desk.scope = { kind: "site", siteCode: "SCGH" };
    view.rerender(local());
    expect(keys()).toHaveLength(2);
    expect(keys()).toContain(first);
  });
  it("does not persist or reuse shared fallback before the server identifies its workspace", () => {
    render(<App />);
    expect(screen.getByTestId("history-length")).toHaveTextContent("0");
    expect(
      Object.keys(window.localStorage).filter((key) => key.startsWith("ward-flow-forecast-history:")),
    ).toHaveLength(0);
  });
  it("retires shared history when the same API client changes authoritative workspace", async () => {
    let serverDay = -11;
    const selectedApi = {
      forecastHistory: async () => ({
        shared: true,
        generation: 0,
        snapshots: [
          { day: serverDay, at: NOW_ANCHOR + serverDay * 1440, nowGap: 1, tomorrow: { low: 1, likely: 1, high: 1 } },
        ],
        reasons: [],
      }),
    } as unknown as SharedAccessApi;
    const view = render(<App workspaceId="workspace-a" selectedApi={selectedApi} />);
    await waitFor(() => expect(screen.getByTestId("history-days")).toHaveTextContent("-11"));
    serverDay = -22;
    view.rerender(<App workspaceId="workspace-b" selectedApi={selectedApi} />);
    expect(screen.getByTestId("history-days")).not.toHaveTextContent("-11");
    await waitFor(() => expect(screen.getByTestId("history-days")).toHaveTextContent("-22"));
  });
});

import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { LAST_LOOK_STORAGE_KEY } from "@/components/ward-management/coordinator/since-last-look";
import { useSinceLastLook } from "@/components/ward-management/coordinator/since-last-look-panel";
import { FORECAST_LAST_LOOK_STORAGE_KEY } from "@/components/ward-management/forecast/forecast-last-look";
import { useForecastChange, useForecastModel } from "@/components/ward-management/forecast/use-forecast-model";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";
import { endWardFlowBrowserSession, endWardFlowTabSession } from "@/components/ward-management/ward-browser-data";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Audit 4 A4-07 (browser-confirmed): after sign-out the Command and Capacity screens are still
 * mounted for one more render with the signed-out context, so their leave-save effects re-run
 * after the sweep and the later unmount wrote the per-account picture back. This follows the real
 * order: end the session, re-render signed out, then unmount and let the deferred save run.
 */
type Account = { api: SharedAccessApi; actorId: string | null } | null;

function signedIn(actorId: string): Account {
  return { actorId, api: {} as SharedAccessApi };
}

function Screens() {
  const world = useWardFlow();
  useSinceLastLook(world, world.now);
  const model = useForecastModel(world.now);
  useForecastChange(model, world.now, { remember: true });
  return null;
}

function App({ account }: { account: Account }) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <SharedAccessContext.Provider value={account}>
        <Screens />
      </SharedAccessContext.Provider>
    </WardFlowProvider>
  );
}

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

function forecastKey(actorId: string) {
  return `${FORECAST_LAST_LOOK_STORAGE_KEY}:${encodeURIComponent(actorId)}`;
}

describe("leave-saves after a sign-out (Audit 4 A4-07)", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("writes no picture back when the screens re-render signed out and then close", async () => {
    const account = signedIn("synthetic-account-one");
    const view = render(<App account={account} />);
    endWardFlowBrowserSession();
    // The shared workspace drops its account context once the session ends.
    view.rerender(<App account={null} />);
    await flush();
    view.unmount();
    await flush();
    expect(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(forecastKey("synthetic-account-one"))).toBeNull();
    expect(window.sessionStorage.getItem(forecastKey("local-demo"))).toBeNull();
  });

  it("writes no picture back when the old account's context is still shown after the end", async () => {
    const account = signedIn("synthetic-account-one");
    const view = render(<App account={account} />);
    endWardFlowBrowserSession();
    view.rerender(<App account={account} />);
    view.unmount();
    await flush();
    expect(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(forecastKey("synthetic-account-one"))).toBeNull();
  });

  it("writes no picture back after a this-tab-only idle sign-out either", async () => {
    const view = render(<App account={signedIn("synthetic-account-one")} />);
    endWardFlowTabSession();
    view.rerender(<App account={null} />);
    await flush();
    view.unmount();
    await flush();
    expect(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(forecastKey("synthetic-account-one"))).toBeNull();
  });

  it("saves normally again once a new session signs in, even for the same account", async () => {
    const first = render(<App account={signedIn("synthetic-account-one")} />);
    endWardFlowBrowserSession();
    first.unmount();
    await flush();
    expect(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).toBeNull();

    const next = render(<App account={signedIn("synthetic-account-one")} />);
    next.unmount();
    await flush();
    expect(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).not.toBeNull();
    expect(window.sessionStorage.getItem(forecastKey("synthetic-account-one"))).not.toBeNull();
  });
});

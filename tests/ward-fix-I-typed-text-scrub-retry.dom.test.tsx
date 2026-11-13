import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Audit 4 A4-02 (13 Nov 2026): the code that makes the safe copy of a day holding typed text loads
 * the first time text is typed. When that load failed (offline, server away), saving used to stop
 * for the rest of the day with no retry, and the "not saved" note was itself loaded on demand, so it
 * could not show offline either. Now the note is in the first load and shows while the copy is
 * missing, and the load is tried again when the connection returns and on the next save attempt.
 * D-18 holds throughout: the typed words are never written.
 *
 * The copy's load waits on the scenario networks, so failing that load (mocked) fails the copy's.
 */
const networks = vi.hoisted(() => ({ fail: 0 }));
vi.mock("@/components/ward-management/ward-scenario-network-loader", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-scenario-network-loader")>();
  return {
    ...actual,
    loadScenarioNetworks: () =>
      networks.fail > 0
        ? (networks.fail--, Promise.reject(new Error("Failed to fetch dynamically imported module")))
        : actual.loadScenarioNetworks(),
  };
});

const KEY = "ward-flow:demo-save-current";

async function freshProvider() {
  const provider = await import("@/components/ward-management/ward-flow-provider");
  const { WardDemoNotSavedNote } = await import("@/components/ward-management/shell/ward-demo-saving");
  const { TYPED_TEXT_NOT_KEPT } = await import("@/components/ward-management/ward-flow-typed-text-ledger");
  let current: ReturnType<typeof provider.useWardFlow> | undefined;
  function Capture() {
    current = provider.useWardFlow();
    return null;
  }
  render(
    <provider.WardFlowProvider>
      <Capture />
      <WardDemoNotSavedNote />
    </provider.WardFlowProvider>,
  );
  await waitFor(() => expect(window.sessionStorage.getItem(KEY)).toBe("1"));
  const typeBlocker = (blocker: string) =>
    act(() => {
      current!.dispatch({
        type: "RECORD_MOVEMENT_BLOCKER",
        role: "coordinator",
        now: current!.now,
        movementId: current!.movements[0].id,
        blocker,
      });
    });
  return { storageKey: provider.WARD_FLOW_DEMO_STORAGE_KEY, TYPED_TEXT_NOT_KEPT, typeBlocker, now: () => current! };
}

describe("typed-text copy whose code failed to load (A4-02)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.resetModules();
    networks.fail = 0;
  });
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("shows the not-saved note at once, then saves the copy when the connection returns", async () => {
    const { storageKey, TYPED_TEXT_NOT_KEPT, typeBlocker, now } = await freshProvider();
    networks.fail = 1;
    const typed = "Synthetic typed blocker words 3pd";
    typeBlocker(typed);

    // The note is part of the first load, so it shows while the copy's code is missing.
    expect(await screen.findByTestId("ward-demo-not-saved")).toBeInTheDocument();
    expect(now().savingOnDevice).toBe(false);
    expect(window.sessionStorage.getItem(storageKey)).not.toContain(typed);

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(window.sessionStorage.getItem(storageKey)).toContain(TYPED_TEXT_NOT_KEPT));
    expect(window.sessionStorage.getItem(storageKey)).not.toContain(typed);
    expect(now().savingOnDevice).toBe(true);
    expect(screen.queryByTestId("ward-demo-not-saved")).toBeNull();
  });

  it("tries again on the next save attempt, without waiting for an online event", async () => {
    const { storageKey, TYPED_TEXT_NOT_KEPT, typeBlocker, now } = await freshProvider();
    networks.fail = 1;
    typeBlocker("Synthetic typed blocker words 4qe");
    await screen.findByTestId("ward-demo-not-saved");

    // The server is back but the browser never went offline: the next step loads the copy.
    const later = "Synthetic typed blocker words 5rf";
    typeBlocker(later);
    await waitFor(() => expect(window.sessionStorage.getItem(storageKey)).toContain(TYPED_TEXT_NOT_KEPT));
    expect(window.sessionStorage.getItem(storageKey)).not.toContain(later);
    expect(now().savingOnDevice).toBe(true);
  });
});

describe("not-saved note (A4-02)", () => {
  it("is drawn in the same render, with nothing to fetch", async () => {
    const { WardDemoNotSavedContext, WardDemoNotSavedNote } =
      await import("@/components/ward-management/shell/ward-demo-saving");
    render(
      <WardDemoNotSavedContext.Provider value={false}>
        <WardDemoNotSavedNote />
      </WardDemoNotSavedContext.Provider>,
    );
    expect(screen.getByTestId("ward-demo-not-saved")).toHaveTextContent(
      "Demonstration state is not saved on this device.",
    );
  });
});

// Help remembered by account (migration 17): the account's memory and the device's combine at
// sign-in, later marks are sent, and the demo site keeps device memory only. Synthetic ids only.
import { createElement } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountHelpReply,
  missingFromAccount,
  WardHelpAccountMemory,
} from "@/components/ward-management/help/ward-help-account-memory";
import { markTourSeen, TOUR_SEEN_STORAGE_KEY } from "@/components/ward-management/help/ward-help-store";
import { WHATS_NEW_STORAGE_KEY } from "@/components/ward-management/help/ward-whats-new";
import { HELP_HINTS_KEY, markHelpHint } from "@/components/ward-management/help-content/ward-help-hints";
import {
  HELP_TIPS_OFF_KEY,
  helpTipsOff,
  helpTipsOffByDefault,
  setHelpTipsOff,
} from "@/components/ward-management/help-content/ward-help-tips-off";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";

const AUTO_DONE = "ward_flow_choice_tour_auto_done";
const account = (memory: Record<string, unknown> = {}) => ({
  shared: true,
  tours: [],
  tips: [],
  whatsNew: [],
  tipsOff: null,
  ...memory,
});

function mount(preferences?: SharedAccessApi["preferences"]) {
  const api = (preferences ? { preferences } : {}) as SharedAccessApi;
  return render(
    createElement(
      SharedAccessContext.Provider,
      { value: { api, actorId: "synthetic-actor" } },
      createElement(WardHelpAccountMemory),
    ),
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe("Help remembered by account", () => {
  it("applies account marks at sign-in without uploading unowned device marks", async () => {
    localStorage.setItem(TOUR_SEEN_STORAGE_KEY, "ward");
    localStorage.setItem(HELP_HINTS_KEY, "ward:ward");
    localStorage.setItem(WHATS_NEW_STORAGE_KEY, JSON.stringify(["2026-11-03-home-flow"]));
    const call = vi.fn(async (body?: Record<string, unknown>) =>
      body
        ? account()
        : account({ tours: ["coordinator"], tips: ["coordinator:capacity"], whatsNew: ["2026-11-04-a"] }),
    );
    mount(call);
    await waitFor(() => expect(call).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem(TOUR_SEEN_STORAGE_KEY)?.split(",").sort()).toEqual(["coordinator", "ward"]);
    expect(localStorage.getItem(HELP_HINTS_KEY)?.split(",").sort()).toEqual(["coordinator:capacity", "ward:ward"]);
    expect(JSON.parse(localStorage.getItem(WHATS_NEW_STORAGE_KEY) ?? "[]").sort()).toEqual([
      "2026-11-03-home-flow",
      "2026-11-04-a",
    ]);
    // The tour was offered on another device, so it is not offered again here.
    expect(localStorage.getItem(AUTO_DONE)).toBe("coordinator");
    expect(call.mock.calls[0][0]).toBeUndefined();
  });

  it("sends later marks together, and tips off only when the person changes it", async () => {
    const call = vi.fn(async (body?: Record<string, unknown>) => account(body ? {} : { tipsOff: true }));
    mount(call);
    await waitFor(() => expect(call).toHaveBeenCalledTimes(1));
    // The account's choice stands on this device, and is not sent back.
    expect(helpTipsOff()).toBe(true);
    vi.useFakeTimers();
    act(() => {
      markTourSeen("ed");
      markHelpHint("ed", "ed-board");
      setHelpTipsOff(false);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(call).toHaveBeenCalledTimes(2);
    expect(call.mock.calls[1][0]).toEqual({ tours: ["ed"], tips: ["ed:ed-board"], tipsOff: false });
  });

  it("does not upload the previous account's marks when the signed-in account changes", async () => {
    const first = vi.fn(async () => account({ tours: ["ward"] }));
    const second = vi.fn(async (body?: Record<string, unknown>) => account(body));
    const tree = (actorId: string, preferences: SharedAccessApi["preferences"]) =>
      createElement(
        SharedAccessContext.Provider,
        { value: { api: { preferences } as SharedAccessApi, actorId } },
        createElement(WardHelpAccountMemory),
      );
    const view = render(tree("synthetic-account-a", first));
    await waitFor(() => expect(localStorage.getItem(TOUR_SEEN_STORAGE_KEY)).toBe("ward"));
    view.rerender(tree("synthetic-account-b", second));
    await waitFor(() => expect(second).toHaveBeenCalledTimes(1));
    vi.useFakeTimers();
    act(() => markTourSeen("ed"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(second).toHaveBeenCalledTimes(2);
    expect(second.mock.calls[1]?.[0]).toEqual({ tours: ["ed"] });
    expect(first).toHaveBeenCalledTimes(1);
  });

  it("N36: keeps a failed save's marks for the same account and retries them after a remount", async () => {
    const tree = (actorId: string, preferences: SharedAccessApi["preferences"]) =>
      createElement(
        SharedAccessContext.Provider,
        { value: { api: { preferences } as SharedAccessApi, actorId } },
        createElement(WardHelpAccountMemory),
      );
    const failing = vi.fn(async (body?: Record<string, unknown>) => {
      if (body) throw new Error("Saved history could not be saved");
      return account();
    });
    const first = render(tree("synthetic-account-a", failing));
    await waitFor(() => expect(failing).toHaveBeenCalledTimes(1));
    vi.useFakeTimers();
    act(() => markTourSeen("ed"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(failing).toHaveBeenCalledTimes(2);
    first.unmount();
    vi.useRealTimers();
    // Another account on this device never receives the unsaved mark.
    const other = vi.fn(async () => account());
    const second = render(tree("synthetic-account-b", other));
    await waitFor(() => expect(other).toHaveBeenCalledTimes(1));
    second.unmount();
    expect(other).toHaveBeenCalledTimes(1);
    // The same account, reconnected, sends it.
    const working = vi.fn(async (body?: Record<string, unknown>) => account(body));
    render(tree("synthetic-account-a", working));
    await waitFor(() => expect(working).toHaveBeenCalledTimes(2));
    expect(working.mock.calls[1]?.[0]).toEqual({ tours: ["ed"] });
  });

  it("#1426: retries a tips choice whose save failed with the next mark", async () => {
    let fail = true;
    const call = vi.fn(async (body?: Record<string, unknown>) => {
      if (body && fail) throw new Error("Saved history could not be saved");
      return account();
    });
    mount(call);
    await waitFor(() => expect(call).toHaveBeenCalledTimes(1));
    vi.useFakeTimers();
    act(() => setHelpTipsOff(true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(call.mock.calls[1]?.[0]).toEqual({ tipsOff: true });
    fail = false;
    act(() => markTourSeen("ed"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(call).toHaveBeenCalledTimes(3);
    expect(call.mock.calls[2]?.[0]).toEqual({ tours: ["ed"], tipsOff: true });
  });

  it("does not upload a device tips choice made before sign-in", async () => {
    setHelpTipsOff(true);
    const call = vi.fn(async () => account());
    mount(call);
    await waitFor(() => expect(call).toHaveBeenCalledTimes(1));
    vi.useFakeTimers();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("before migration 17, or when the server is unreachable, the device's memory stands", async () => {
    localStorage.setItem(TOUR_SEEN_STORAGE_KEY, "ward");
    const older = vi.fn(async () => ({ shared: false }));
    mount(older);
    await waitFor(() => expect(older).toHaveBeenCalledTimes(1));
    cleanup();
    const down = vi.fn(async () => {
      throw new Error("Saved history could not be read");
    });
    mount(down);
    await waitFor(() => expect(down).toHaveBeenCalledTimes(1));
    act(() => markTourSeen("ed"));
    expect(localStorage.getItem(TOUR_SEEN_STORAGE_KEY)).toBe("ward,ed");
    expect(older).toHaveBeenCalledTimes(1);
    expect(down).toHaveBeenCalledTimes(1);
  });

  it("does nothing without an account, as on the demo site", () => {
    expect(() => mount()).not.toThrow();
    expect(accountHelpReply({ shared: false })).toBeNull();
    expect(accountHelpReply(account({ tours: ["ward", 3] }))?.tours).toEqual(["ward"]);
    expect(
      missingFromAccount({ tours: ["ward"], tips: [], whatsNew: [] }, { tours: ["ward"], tips: [], whatsNew: [] }),
    ).toBeNull();
  });
});

describe("page tips on the demo site", () => {
  it("start off in a demo production build, stay on in a shared one, and a choice is kept either way", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "");
    expect(helpTipsOffByDefault()).toBe(true);
    expect(helpTipsOff()).toBe(true);
    setHelpTipsOff(false);
    expect(localStorage.getItem(HELP_TIPS_OFF_KEY)).toBe("no");
    expect(helpTipsOff()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "true");
    localStorage.removeItem(HELP_TIPS_OFF_KEY);
    expect(helpTipsOff()).toBe(false);
  });
});

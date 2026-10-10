import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Microsoft sign-in, faked so the shared connection's sign-out can be exercised offline.
const msal = vi.hoisted(() => ({
  logoutRedirect: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
  order: [] as string[],
}));
vi.mock("@azure/msal-browser", () => ({
  PublicClientApplication: class {
    initialize = async () => {};
    handleRedirectPromise = async () => ({ account: { username: "synthetic.coordinator" } });
    getActiveAccount = () => null;
    getAllAccounts = () => [];
    setActiveAccount = () => {};
    acquireTokenSilent = async () => ({ accessToken: "synthetic-token" });
    loginRedirect = async () => {};
    logoutRedirect = async (...args: unknown[]) => {
      msal.order.push("sign-out");
      await msal.logoutRedirect(...args);
    };
  },
}));

// Same reason as every sibling settings dom suite: next/link needs an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AlertsPane } from "@/components/ward-management/settings/settings-panes";
import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import {
  PHONE_PUSH_SCOPE,
  PHONE_PUSH_WORKER_URL,
  PhonePushAccessContext,
  phonePushRow,
  releasePhonePush,
  usePhonePush,
  type PhonePushAccess,
  type PhonePushApi,
  type PhonePushState,
} from "@/components/ward-management/shell/ward-phone-push";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { useWardShared } from "@/components/ward-management/ward-shared-access";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";

/** Feature 4, 10 Oct 2026: phone alerts are off by default, per device, and never hidden. */

const UNAVAILABLE: PhonePushState[] = [
  "local",
  "signed-out",
  "checking",
  "unsupported",
  "install",
  "server-off",
  "denied",
  "busy",
];

function alertsPane(state: PhonePushState, onPhonePushChange = vi.fn()) {
  render(
    <AlertsPane
      phonePush={state}
      onPhonePushChange={onPhonePushChange}
      buzz={false}
      onBuzzChange={vi.fn()}
      onTestBuzz={vi.fn()}
      onPreview={vi.fn()}
    />,
  );
  const row = screen.getByTestId("setting-phone-alerts-row");
  return { row, toggle: within(row).getByRole("switch", { name: "Phone alerts" }), onPhonePushChange };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("phone alerts row", () => {
  it.each(UNAVAILABLE)("%s: greys out with a reason, stays reachable and changes nothing", (state) => {
    const { row, toggle, onPhonePushChange } = alertsPane(state);
    expect(row).toHaveTextContent(phonePushRow(state).sub);
    expect(phonePushRow(state).sub.length).toBeGreaterThan(10);
    expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(toggle).not.toHaveAttribute("disabled");
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(onPhonePushChange).not.toHaveBeenCalled();
  });

  it("off: available, and pressing asks to turn on", () => {
    const { row, toggle, onPhonePushChange } = alertsPane("off");
    expect(toggle).not.toHaveAttribute("aria-disabled");
    expect(toggle).not.toBeChecked();
    expect(row).toHaveTextContent("with Ward Flow closed");
    fireEvent.click(toggle);
    expect(onPhonePushChange).toHaveBeenCalledWith(true);
  });

  it("on: checked, and pressing asks to turn off", () => {
    const { toggle, onPhonePushChange } = alertsPane("on");
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(onPhonePushChange).toHaveBeenCalledWith(false);
  });

  it("the local demonstration shows the row disabled with the shared-workspace reason", () => {
    render(
      <WardFlowProvider>
        <SettingsScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("radio", { name: /^Alerts/ }));
    const row = screen.getByTestId("setting-phone-alerts-row");
    expect(row).toHaveTextContent("Needs the shared Azure workspace");
    expect(within(row).getByRole("switch", { name: "Phone alerts" })).toHaveAttribute("aria-disabled", "true");
  });

  it("never shows a Ward Flow id, record number or the word for a patient in any state", () => {
    for (const state of [...UNAVAILABLE, "off", "on", "limit", "in-use", "error", "error-on"] as PhonePushState[]) {
      expect(phonePushRow(state).sub).not.toMatch(/WF-|UMRN|patient/i);
      // One line at 390px wide: the row truncates a longer reason.
      expect(phonePushRow(state).sub.length).toBeLessThanOrEqual(41);
    }
  });
});

/* The device switch ------------------------------------------------------------------------- */

const SERVER_KEY = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 5)]).toString("base64url");

function fakeApi(enabled = true): PhonePushApi & { [K in keyof PhonePushApi]: ReturnType<typeof vi.fn> } {
  return {
    pushKey: vi.fn(async () =>
      enabled ? { enabled: true as const, publicKey: SERVER_KEY } : { enabled: false as const },
    ),
    pushStatus: vi.fn(async () => true),
    pushSubscribe: vi.fn(async (): Promise<"subscribed" | "limit" | "in-use"> => "subscribed"),
    pushUnsubscribe: vi.fn(async () => true),
  };
}

function installBrowser({
  permission = "default" as NotificationPermission,
  answer = "granted" as NotificationPermission,
  subscribed = false,
} = {}) {
  const subscription = {
    endpoint: "https://fcm.googleapis.com/fcm/send/device",
    options: { applicationServerKey: new Uint8Array(Buffer.from(SERVER_KEY, "base64url")).buffer },
    toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/device", keys: { p256dh: "p", auth: "a" } }),
    unsubscribe: vi.fn(async () => true),
  };
  let current: typeof subscription | null = subscribed ? subscription : null;
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => {
      current = subscription;
      return subscription;
    }),
  };
  const registration = { active: {}, pushManager };
  const serviceWorker = {
    register: vi.fn(async () => registration),
    getRegistration: vi.fn(async () => registration),
  };
  const Notification = { permission, requestPermission: vi.fn(async () => answer) };
  vi.stubGlobal("Notification", Notification);
  vi.stubGlobal("PushManager", function PushManager() {});
  Object.defineProperty(navigator, "serviceWorker", { value: serviceWorker, configurable: true });
  return { subscription, pushManager, serviceWorker, Notification };
}

function hook(access: PhonePushAccess) {
  return renderHook(() => usePhonePush(), {
    wrapper: ({ children }) => (
      <PhonePushAccessContext.Provider value={access}>{children}</PhonePushAccessContext.Provider>
    ),
  });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("usePhonePush", () => {
  it("is local without the shared workspace, and asks to sign in when signed out", () => {
    expect(renderHook(() => usePhonePush()).result.current[0]).toBe("local");
    expect(hook({ kind: "signed-out" }).result.current[0]).toBe("signed-out");
  });

  it("says when the browser cannot receive push", () => {
    expect(hook({ kind: "connected", api: fakeApi() }).result.current[0]).toBe("unsupported");
  });

  it("on an iPhone browser tab, says to add Ward Flow to the Home Screen", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    );
    expect(hook({ kind: "connected", api: fakeApi() }).result.current[0]).toBe("install");
  });

  it("says when the server is not set up for phone alerts", async () => {
    installBrowser();
    const { result } = hook({ kind: "connected", api: fakeApi(false) });
    expect(result.current[0]).toBe("checking");
    await waitFor(() => expect(result.current[0]).toBe("server-off"));
  });

  it("reads this account's subscription on this device as on", async () => {
    installBrowser({ permission: "granted", subscribed: true });
    const api = fakeApi();
    const { result } = hook({ kind: "connected", api });
    await waitFor(() => expect(result.current[0]).toBe("on"));
    expect(api.pushStatus).toHaveBeenCalledWith("https://fcm.googleapis.com/fcm/send/device");
  });

  it("shared device: another account's subscription reads as off, and Off leaves it alone", async () => {
    const browser = installBrowser({ permission: "granted", subscribed: true });
    const api = fakeApi();
    api.pushStatus.mockResolvedValue(false);
    const { result } = hook({ kind: "connected", api });
    await waitFor(() => expect(result.current[0]).toBe("off"));
    api.pushUnsubscribe.mockResolvedValue(false);
    await act(async () => {
      expect(await result.current[1](false)).toBe("off");
    });
    expect(browser.subscription.unsubscribe).not.toHaveBeenCalled();
  });

  it("an unreadable device check is an error the person can retry", async () => {
    installBrowser({ permission: "granted", subscribed: true });
    const api = fakeApi();
    api.pushStatus.mockRejectedValue(new Error("503"));
    const { result } = hook({ kind: "connected", api });
    await waitFor(() => expect(result.current[0]).toBe("error"));
  });

  it("says when notifications are blocked for the site", async () => {
    installBrowser({ permission: "denied" });
    const { result } = hook({ kind: "connected", api: fakeApi() });
    await waitFor(() => expect(result.current[0]).toBe("denied"));
  });

  it("turns on: asks permission, installs the worker for Ward Flow only and registers the device", async () => {
    const browser = installBrowser();
    const api = fakeApi();
    const { result } = hook({ kind: "connected", api });
    await waitFor(() => expect(result.current[0]).toBe("off"));
    await act(async () => {
      expect(await result.current[1](true)).toBe("on");
    });
    expect(result.current[0]).toBe("on");
    expect(browser.Notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(browser.serviceWorker.register).toHaveBeenCalledWith(PHONE_PUSH_WORKER_URL, {
      scope: PHONE_PUSH_SCOPE,
      updateViaCache: "none",
    });
    const [options] = browser.pushManager.subscribe.mock.calls[0] as unknown as [PushSubscriptionOptionsInit];
    expect(options.userVisibleOnly).toBe(true);
    expect(Buffer.from(options.applicationServerKey as Uint8Array).toString("base64url")).toBe(SERVER_KEY);
    expect(api.pushSubscribe).toHaveBeenCalledWith({
      endpoint: "https://fcm.googleapis.com/fcm/send/device",
      keys: { p256dh: "p", auth: "a" },
    });
  });

  it("respects a refused permission and registers nothing", async () => {
    const browser = installBrowser({ answer: "denied" });
    const api = fakeApi();
    const { result } = hook({ kind: "connected", api });
    await waitFor(() => expect(result.current[0]).toBe("off"));
    await act(async () => {
      expect(await result.current[1](true)).toBe("denied");
    });
    expect(browser.serviceWorker.register).not.toHaveBeenCalled();
    expect(api.pushSubscribe).not.toHaveBeenCalled();
  });

  it("turns off: removes the device from the server, then from the browser", async () => {
    const browser = installBrowser({ permission: "granted", subscribed: true });
    const api = fakeApi();
    const { result } = hook({ kind: "connected", api });
    await waitFor(() => expect(result.current[0]).toBe("on"));
    await act(async () => {
      expect(await result.current[1](false)).toBe("off");
    });
    expect(api.pushUnsubscribe).toHaveBeenCalledWith("https://fcm.googleapis.com/fcm/send/device");
    expect(browser.subscription.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("reports a server failure as an error the person can retry", async () => {
    installBrowser({ permission: "granted" });
    const api = fakeApi();
    api.pushSubscribe.mockRejectedValueOnce(new Error("503"));
    const { result } = hook({ kind: "connected", api });
    await waitFor(() => expect(result.current[0]).toBe("off"));
    await act(async () => {
      expect(await result.current[1](true)).toBe("error");
    });
    expect(phonePushRow(result.current[0]).unavailable).toBe(false);
  });

  it("shows why the server refused, rather than asking to retry", async () => {
    installBrowser({ permission: "granted" });
    const api = fakeApi();
    api.pushSubscribe.mockResolvedValueOnce("in-use");
    const { result } = hook({ kind: "connected", api });
    await waitFor(() => expect(result.current[0]).toBe("off"));
    await act(async () => {
      expect(await result.current[1](true)).toBe("in-use");
    });
    expect(phonePushRow(result.current[0])).toEqual({
      checked: false,
      unavailable: false,
      sub: "On for another account on this device",
    });
  });

  it("a failed turn-off stays on with the error, and the next tap retries it", async () => {
    const browser = installBrowser({ permission: "granted", subscribed: true });
    const api = fakeApi();
    api.pushUnsubscribe.mockRejectedValueOnce(new Error("503"));
    const { result } = hook({ kind: "connected", api });
    await waitFor(() => expect(result.current[0]).toBe("on"));
    await act(async () => {
      expect(await result.current[1](false)).toBe("error-on");
    });
    expect(phonePushRow(result.current[0])).toEqual({
      checked: true,
      unavailable: false,
      sub: "Server not reached. Try again.",
    });
    expect(browser.subscription.unsubscribe).not.toHaveBeenCalled();
    await act(async () => {
      expect(await result.current[1](false)).toBe("off");
    });
    expect(browser.subscription.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("replaces a subscription made for an earlier server key", async () => {
    const browser = installBrowser({ permission: "granted", subscribed: true });
    browser.subscription.options.applicationServerKey = new Uint8Array(65).buffer;
    const api = fakeApi();
    const { result } = hook({ kind: "connected", api });
    await waitFor(() => expect(result.current[0]).toBe("on"));
    await act(async () => {
      expect(await result.current[1](true)).toBe("on");
    });
    expect(browser.subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(browser.pushManager.subscribe).toHaveBeenCalledTimes(1);
  });
});

describe("releasePhonePush before sign-out", () => {
  it("revokes this account's record, then the browser subscription", async () => {
    const browser = installBrowser({ permission: "granted", subscribed: true });
    const api = fakeApi();
    await releasePhonePush(api);
    expect(api.pushUnsubscribe).toHaveBeenCalledWith("https://fcm.googleapis.com/fcm/send/device");
    expect(browser.subscription.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("leaves another account's browser subscription, and never throws", async () => {
    const browser = installBrowser({ permission: "granted", subscribed: true });
    const api = fakeApi();
    api.pushUnsubscribe.mockResolvedValueOnce(false);
    await releasePhonePush(api);
    expect(browser.subscription.unsubscribe).not.toHaveBeenCalled();
    api.pushUnsubscribe.mockRejectedValueOnce(new Error("offline"));
    await expect(releasePhonePush(api)).resolves.toBeUndefined();
  });

  it("does nothing in a browser without push", async () => {
    const api = fakeApi();
    await releasePhonePush(api);
    expect(api.pushUnsubscribe).not.toHaveBeenCalled();
  });
});

/* The shared connection's phone calls and sign-out ------------------------------------------ */

const SHARED_SNAPSHOT = {
  dataMode: "prototype",
  revision: 1,
  now: 642,
  payload: {
    version: 1,
    state: JSON.parse(JSON.stringify(seedWardFlowStateAt(0))),
    dayZero: "2026-10-07T00:00:00Z",
    startedAt: "2026-10-07T10:00:00Z",
  },
};

function sharedServer(hang: string | null = null) {
  const calls: { path: string; body: unknown }[] = [];
  const answers: Record<string, unknown> = {
    "/v1/workspace": { snapshot: SHARED_SNAPSHOT },
    "/v1/workspace/push-key": { enabled: true, publicKey: SERVER_KEY },
    "/v1/workspace/push-status": { owned: true },
    "/v1/workspace/push-subscribe": { subscribed: true },
    "/v1/workspace/push-unsubscribe": { subscribed: false, revoked: true },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      const path = new URL(url).pathname;
      calls.push({ path, body: options?.body ? JSON.parse(String(options.body)) : null });
      if (path === hang) return new Promise<Response>(() => {});
      if (path === "/v1/workspace/push-unsubscribe") msal.order.push("revoke");
      return Response.json(answers[path]);
    }),
  );
  vi.stubEnv("NEXT_PUBLIC_WARD_TENANT_ID", "11111111-1111-4111-8111-111111111111");
  vi.stubEnv("NEXT_PUBLIC_WARD_CLIENT_ID", "22222222-2222-4222-8222-222222222222");
  vi.stubEnv("NEXT_PUBLIC_WARD_API_BASE_URL", "https://ward-api.example/");
  vi.stubEnv("NEXT_PUBLIC_WARD_API_SCOPE", "api://ward-flow-synthetic/WardFlow.Access");
  return calls;
}

async function signedInShared() {
  const view = renderHook(() => useWardShared(true));
  await waitFor(() => expect(view.result.current.status).toBe("ready"));
  return view;
}

describe("shared connection phone alerts", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    msal.order.length = 0;
    msal.logoutRedirect.mockClear();
  });

  it("sends each phone alert call to the signed-in workspace", async () => {
    const calls = sharedServer();
    const { result, unmount } = await signedInShared();
    const { pushApi } = result.current;
    expect(await pushApi.pushKey()).toEqual({ enabled: true, publicKey: SERVER_KEY });
    expect(await pushApi.pushStatus("https://fcm.googleapis.com/fcm/send/device")).toBe(true);
    await pushApi.pushSubscribe({ endpoint: "https://fcm.googleapis.com/fcm/send/device", keys: { p256dh: "p" } });
    expect(await pushApi.pushUnsubscribe("https://fcm.googleapis.com/fcm/send/device")).toBe(true);
    expect(calls.slice(1)).toEqual([
      { path: "/v1/workspace/push-key", body: null },
      { path: "/v1/workspace/push-status", body: { endpoint: "https://fcm.googleapis.com/fcm/send/device" } },
      {
        path: "/v1/workspace/push-subscribe",
        body: { subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/device", keys: { p256dh: "p" } } },
      },
      { path: "/v1/workspace/push-unsubscribe", body: { endpoint: "https://fcm.googleapis.com/fcm/send/device" } },
    ]);
    unmount();
    await expect(pushApi.pushKey()).rejects.toThrow("not connected");
  });

  it("sign-out releases this device's phone alerts first, then signs out", async () => {
    sharedServer();
    const browser = installBrowser({ permission: "granted", subscribed: true });
    const { result, unmount } = await signedInShared();
    act(() => result.current.signOut());
    await waitFor(() => expect(msal.logoutRedirect).toHaveBeenCalledTimes(1));
    expect(msal.order).toEqual(["revoke", "sign-out"]);
    expect(browser.subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(result.current.signedIn).toBe(false);
    unmount();
  });

  it("sign-out never waits more than two seconds on the server", async () => {
    sharedServer("/v1/workspace/push-unsubscribe");
    installBrowser({ permission: "granted", subscribed: true });
    const { result, unmount } = await signedInShared();
    vi.useFakeTimers();
    act(() => result.current.signOut());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1900);
    });
    expect(msal.logoutRedirect).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(msal.logoutRedirect).toHaveBeenCalledTimes(1);
    unmount();
  });
});

/* The service worker ------------------------------------------------------------------------ */

function loadWorker(openWindows: string[]) {
  const listeners: Record<string, (event: unknown) => void> = {};
  const focused: string[] = [];
  const opened: string[] = [];
  const shown: unknown[] = [];
  const windows = openWindows.map((url) => ({
    url,
    focus: async () => {
      focused.push(url);
      return { navigate: async (target: string) => opened.push(`navigate ${target}`) };
    },
  }));
  const self = {
    location: { origin: "https://ward.example" },
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners[type] = listener;
    },
    skipWaiting: () => {},
    clients: {
      claim: async () => {},
      matchAll: async () => windows,
      openWindow: async (url: string) => opened.push(`open ${url}`),
    },
    registration: { showNotification: async (title: string, options: unknown) => shown.push({ title, options }) },
  };
  runInNewContext(readFileSync(join(process.cwd(), "public/ward-flow-push-sw.js"), "utf8"), { self, URL });
  async function fire(type: string, event: Record<string, unknown>) {
    let work: Promise<unknown> = Promise.resolve();
    listeners[type]({ ...event, waitUntil: (promise: Promise<unknown>) => (work = promise) });
    await work;
  }
  return { fire, focused, opened, shown };
}

describe("phone alert service worker", () => {
  const click = (url: string) => ({ notification: { close: () => {}, data: { url } } });

  it("a sibling path such as ward-flow-digest is not Ward Flow: Alerts opens in a new window", async () => {
    const worker = loadWorker(["https://ward.example/mockups/ward-flow-digest"]);
    await worker.fire("notificationclick", click("/mockups/ward-flow-digest"));
    expect(worker.focused).toEqual([]);
    expect(worker.opened).toEqual(["open /mockups/ward-flow/alerts"]);
  });

  it("an open Ward Flow window is focused and taken to the alert's page", async () => {
    const worker = loadWorker(["https://ward.example/mockups/ward-flow/beds"]);
    await worker.fire("notificationclick", click("/mockups/ward-flow/alerts"));
    expect(worker.focused).toEqual(["https://ward.example/mockups/ward-flow/beds"]);
    expect(worker.opened).toEqual(["navigate /mockups/ward-flow/alerts"]);
  });

  it("shows the server's words, and links only inside Ward Flow", async () => {
    const worker = loadWorker([]);
    const data = { json: () => ({ title: "Ward Flow: 2 act-now items", url: "/mockups/ward-flow-digest" }) };
    await worker.fire("push", { data });
    expect(worker.shown).toEqual([
      {
        title: "Ward Flow: 2 act-now items",
        options: expect.objectContaining({ tag: "ward-flow-act-now", data: { url: "/mockups/ward-flow/alerts" } }),
      },
    ]);
  });
});

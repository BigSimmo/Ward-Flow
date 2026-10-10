import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  usePhonePush,
  type PhonePushAccess,
  type PhonePushApi,
  type PhonePushState,
} from "@/components/ward-management/shell/ward-phone-push";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

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
    for (const state of [...UNAVAILABLE, "off", "on", "error"] as PhonePushState[]) {
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
    pushSubscribe: vi.fn(async () => {}),
    pushUnsubscribe: vi.fn(async () => {}),
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

  it("reads an existing subscription on this device as on", async () => {
    installBrowser({ permission: "granted", subscribed: true });
    const { result } = hook({ kind: "connected", api: fakeApi() });
    await waitFor(() => expect(result.current[0]).toBe("on"));
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
});

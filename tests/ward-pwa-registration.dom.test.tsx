import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { SettingsInstallHint } from "@/components/ward-management/settings/settings-install-hint";
import { PHONE_PUSH_SCOPE, PHONE_PUSH_WORKER_URL } from "@/components/ward-management/shell/ward-phone-push";
import { listenForInstallPrompt } from "@/components/ward-management/shell/ward-pwa-install";
import {
  LEGACY_PWA_SCOPE,
  WardPwaRegistration,
  wardPwaOpenTarget,
} from "@/components/ward-management/shell/ward-pwa-registration";
import { ToastProvider } from "@/components/wf";

/** PWA plan items 5, 6 and 11 and F-11 (Oct 2026): one worker registration, the update notice, install. */

type Listener = (event?: unknown) => void;

function fakeWorker(state = "installed") {
  const listeners: Listener[] = [];
  return {
    state,
    postMessage: vi.fn(),
    addEventListener: (_type: string, listener: Listener) => listeners.push(listener),
    change(next: string) {
      this.state = next;
      for (const listener of listeners) listener();
    },
  };
}

function installServiceWorker({
  active = {} as object | null,
  waiting = null as ReturnType<typeof fakeWorker> | null,
  legacy = false,
} = {}) {
  const origin = window.location.origin;
  const containerListeners: Record<string, Listener[]> = {};
  const registrationListeners: Record<string, Listener[]> = {};
  const registration = {
    scope: `${origin}${PHONE_PUSH_SCOPE}`,
    active,
    waiting,
    installing: null as ReturnType<typeof fakeWorker> | null,
    addEventListener: (type: string, listener: Listener) => (registrationListeners[type] ??= []).push(listener),
  };
  const legacyRegistration = { scope: `${origin}${LEGACY_PWA_SCOPE}`, unregister: vi.fn(async () => true) };
  const other = { scope: `${origin}/somewhere-else/`, unregister: vi.fn(async () => true) };
  const container = {
    controller: active ? {} : null,
    register: vi.fn(async () => registration),
    getRegistrations: vi.fn(async () => (legacy ? [legacyRegistration, other] : [other])),
    addEventListener: (type: string, listener: Listener) => (containerListeners[type] ??= []).push(listener),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(navigator, "serviceWorker", { value: container, configurable: true });
  return {
    container,
    registration,
    legacyRegistration,
    other,
    emit: (type: string, event?: unknown) => containerListeners[type]?.forEach((listener) => listener(event)),
    updateFound: (worker: ReturnType<typeof fakeWorker>) => {
      registration.installing = worker;
      registrationListeners.updatefound?.forEach((listener) => listener());
    },
  };
}

function renderRegistration() {
  return render(
    <ToastProvider>
      <WardPwaRegistration />
    </ToastProvider>,
  );
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "serviceWorker");
  vi.restoreAllMocks();
  push.mockReset();
});

describe("WardPwaRegistration", () => {
  it("registers the one Ward Flow worker on load, with the phone alerts scope that covers Home", async () => {
    const browser = installServiceWorker();
    renderRegistration();
    await waitFor(() => expect(browser.container.register).toHaveBeenCalledTimes(1));
    expect(browser.container.register).toHaveBeenCalledWith(PHONE_PUSH_WORKER_URL, {
      scope: "/mockups/ward-flow",
      updateViaCache: "none",
    });
    expect(browser.other.unregister).not.toHaveBeenCalled();
  });

  it("removes the old /mockups/ward-flow/ registration, and nothing else", async () => {
    const browser = installServiceWorker({ legacy: true });
    renderRegistration();
    await waitFor(() => expect(browser.container.register).toHaveBeenCalled());
    expect(browser.legacyRegistration.unregister).toHaveBeenCalledTimes(1);
    expect(browser.other.unregister).not.toHaveBeenCalled();
  });

  it("does nothing in a browser without service workers", () => {
    expect(() => renderRegistration()).not.toThrow();
  });

  it("offers Reload for a waiting version, and reloads only after the new worker takes over", async () => {
    const waiting = fakeWorker();
    const browser = installServiceWorker({ waiting });
    const reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload } as Location);
    renderRegistration();
    const button = await screen.findByRole("button", { name: "Reload" });
    expect(screen.getByText("New version of Ward Flow ready")).toBeInTheDocument();
    expect(waiting.postMessage).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(reload).not.toHaveBeenCalled();
    act(() => browser.emit("controllerchange"));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("offers Reload when an update finishes installing while the page is open", async () => {
    const browser = installServiceWorker();
    renderRegistration();
    await waitFor(() => expect(browser.container.register).toHaveBeenCalled());
    const update = fakeWorker("installing");
    act(() => browser.updateFound(update));
    expect(screen.queryByRole("button", { name: "Reload" })).not.toBeInTheDocument();
    act(() => update.change("installed"));
    expect(await screen.findByRole("button", { name: "Reload" })).toBeInTheDocument();
  });

  it("never offers Reload on a first install, which takes over without asking", async () => {
    const browser = installServiceWorker({ active: null });
    renderRegistration();
    await waitFor(() => expect(browser.container.register).toHaveBeenCalled());
    const first = fakeWorker("installing");
    act(() => browser.updateFound(first));
    act(() => first.change("installed"));
    // A controllerchange with no tap does not reload either.
    act(() => browser.emit("controllerchange"));
    expect(screen.queryByRole("button", { name: "Reload" })).not.toBeInTheDocument();
  });

  it("opens the Ward Flow page a tapped alert asks for, and nothing outside Ward Flow", async () => {
    const browser = installServiceWorker();
    renderRegistration();
    await waitFor(() => expect(browser.container.register).toHaveBeenCalled());
    act(() => browser.emit("message", { data: { type: "ward-flow-open", url: "/mockups/ward-flow/alerts" } }));
    expect(push).toHaveBeenCalledWith("/mockups/ward-flow/alerts");
    act(() =>
      browser.emit("message", { data: { type: "ward-flow-open", url: "https://evil.example/mockups/ward-flow" } }),
    );
    act(() => browser.emit("message", { data: { type: "ward-flow-open", url: "/mockups/ward-flow-digest" } }));
    act(() => browser.emit("message", { data: { type: "other", url: "/mockups/ward-flow/alerts" } }));
    expect(push).toHaveBeenCalledTimes(1);
  });
});

describe("wardPwaOpenTarget", () => {
  const origin = "https://ward.example";
  it("accepts only a same-site Ward Flow path", () => {
    expect(wardPwaOpenTarget({ type: "ward-flow-open", url: "/mockups/ward-flow" }, origin)).toBe("/mockups/ward-flow");
    expect(wardPwaOpenTarget({ type: "ward-flow-open", url: "/mockups/ward-flow/beds?x=1" }, origin)).toBe(
      "/mockups/ward-flow/beds",
    );
    expect(wardPwaOpenTarget({ type: "ward-flow-open", url: "/settings" }, origin)).toBeNull();
    expect(wardPwaOpenTarget({ type: "ward-flow-open", url: 42 }, origin)).toBeNull();
    expect(wardPwaOpenTarget("ward-flow-open", origin)).toBeNull();
  });
});

describe("Settings install hint", () => {
  const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

  it("shows nothing where the browser offers no install and it is not an iPhone", () => {
    const { container } = render(<SettingsInstallHint />);
    expect(container).toBeEmptyDOMElement();
  });

  it("gives the Add to Home Screen steps on an iPhone browser tab", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE);
    render(<SettingsInstallHint />);
    expect(screen.getByTestId("setting-install-row")).toHaveTextContent("Tap Share, then Add to Home Screen");
  });

  it("is hidden once Ward Flow runs from the Home Screen", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE);
    Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    try {
      const { container } = render(<SettingsInstallHint />);
      expect(container).toBeEmptyDOMElement();
    } finally {
      Reflect.deleteProperty(navigator, "standalone");
    }
  });

  it("offers Install where the browser kept an install sheet, and opens it on tap", async () => {
    listenForInstallPrompt();
    render(<SettingsInstallHint />);
    expect(screen.queryByTestId("setting-install-row")).not.toBeInTheDocument();
    const prompt = vi.fn(async () => {});
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(prompt).toHaveBeenCalledTimes(1);
    // The browser's event works once: the button goes once it is used.
    await waitFor(() => expect(screen.queryByTestId("setting-install-row")).not.toBeInTheDocument());
  });
});

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  WARD_OFFLINE_LINK_NOTICE,
  WardOfflineLinks,
  watchServerAwayNavigations,
} from "@/components/ward-management/shell/ward-offline-links";
import { ToastProvider } from "@/components/wf";

/*
 * Audit 4 A4-05 (13 Nov 2026): with the server away but the network up, the browser still reports a
 * connection, so a menu tap went through, the router's page fetch failed and its full page load
 * landed on the browser's own error page. A full page load to another Ward Flow page is now held for
 * a server check (Navigation API, faked here): the page stays and shows the offline note.
 */
class FakeNavigation extends EventTarget {}

function navigateEvent(url: string, navigationType = "push") {
  const event = new Event("navigate", { cancelable: true });
  Object.assign(event, {
    navigationType,
    hashChange: false,
    downloadRequest: null,
    formData: null,
    destination: { url: new URL(url, window.location.href).href, sameDocument: false },
  });
  return event;
}

let navigation: FakeNavigation;
let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  navigation = new FakeNavigation();
  Object.defineProperty(window, "navigation", { configurable: true, value: navigation });
  assign = vi.fn();
  vi.spyOn(window, "location", "get").mockReturnValue({
    ...window.location,
    origin: window.location.origin,
    href: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    assign,
    replace: vi.fn(),
  } as Location);
});

afterEach(() => {
  Reflect.deleteProperty(window, "navigation");
  vi.restoreAllMocks();
});

const flush = () => act(async () => {});

describe("server away, network up (A4-05)", () => {
  it("stays on the page and shows the offline note when the server does not answer", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    render(
      <ToastProvider>
        <WardOfflineLinks />
        <a href="/ward-flow/capacity">Capacity</a>
      </ToastProvider>,
    );
    const event = navigateEvent("/ward-flow/capacity");
    act(() => {
      navigation.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    await flush();
    expect(fetch).toHaveBeenCalledWith("/api/health", expect.objectContaining({ cache: "no-store" }));
    expect(await screen.findByText(WARD_OFFLINE_LINK_NOTICE)).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();

    // While the server is known to be away, the next in-app tap stays here too, as offline.
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    act(() => {
      screen.getByRole("link", { name: "Capacity" }).dispatchEvent(click);
    });
    expect(click.defaultPrevented).toBe(true);
  });

  it("lets the page load go ahead once the server answers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const stop = watchServerAwayNavigations(() => {
      throw new Error("not away");
    });
    const event = navigateEvent("/ward-flow/capacity");
    navigation.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await flush();
    expect(assign).toHaveBeenCalledWith(new URL("/ward-flow/capacity", window.location.href).href);

    // The repeated load it starts is not held a second time.
    const again = navigateEvent("/ward-flow/capacity");
    navigation.dispatchEvent(again);
    expect(again.defaultPrevented).toBe(false);
    stop();
  });

  it("counts a proxy error page (502) as the server away", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 502 }));
    const away = vi.fn();
    const stop = watchServerAwayNavigations(away);
    navigation.dispatchEvent(navigateEvent("/ward-flow/ed"));
    await flush();
    expect(away).toHaveBeenCalledOnce();
    expect(assign).not.toHaveBeenCalled();
    stop();
  });

  it("leaves router moves, reloads, other sites and downloads alone", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const stop = watchServerAwayNavigations(() => {});
    const sameDocument = navigateEvent("/ward-flow/ed");
    Object.assign(sameDocument, {
      destination: { url: new URL("/ward-flow/ed", window.location.href).href, sameDocument: true },
    });
    const reload = navigateEvent("/ward-flow/ed", "reload");
    const elsewhere = navigateEvent("https://example.org/page");
    const download = navigateEvent("/ward-flow/export.csv");
    Object.assign(download, { downloadRequest: "export.csv" });
    for (const event of [sameDocument, reload, elsewhere, download]) {
      navigation.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(fetch).not.toHaveBeenCalled();
    stop();
  });

  it("does nothing where the browser has no Navigation API", () => {
    Reflect.deleteProperty(window, "navigation");
    expect(() => watchServerAwayNavigations(() => {})()).not.toThrow();
  });
});

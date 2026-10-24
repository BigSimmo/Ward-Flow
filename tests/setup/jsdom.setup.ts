// Setup for the vitest `jsdom` project (see vitest.config.mts). Registers the
// jest-dom matchers (toBeInTheDocument, toHaveAttribute, …) on vitest's expect,
// unmounts any React tree rendered by @testing-library/react after each test so
// DOM state never leaks between cases, and polyfills the two browser APIs jsdom
// omits that our components touch (matchMedia, Element.scrollIntoView). Tests
// that care about a specific matchMedia result override window.matchMedia
// themselves; the default here just keeps components that probe it from throwing.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// next/dynamic stand-in: starts the import when dynamic() is called and renders the loaded
// component synchronously once it has resolved (the loading placeholder until then), so code-split
// panes behave like static imports in jsdom tests.
const pendingDynamicLoads: Promise<unknown>[] = [];

// The demo save's read, and the typed-text copy it writes, load on demand in the browser (Josh,
// 21 Oct 2026: no phone script budget raises). Preloaded here so a provider mount restores and saves
// in the same render, as a later mount does.
await import("@/components/ward-management/ward-flow-demo-storage").then((module) =>
  Promise.all([module.loadDemoRestore(), module.loadTypedTextScrub()]),
);
let forceDynamicLoading = false;

export function setForceDynamicLoading(force: boolean) {
  forceDynamicLoading = force;
}

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: React.forwardRef<
      HTMLAnchorElement,
      Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
        href?: string | { pathname?: string };
        prefetch?: boolean;
      }
    >(function Link(props, ref) {
      const { href, prefetch: _, children, ...rest } = props;
      void _;
      const resolvedHref = typeof href === "string" ? href : href?.pathname;
      return React.createElement("a", { ref, href: resolvedHref, ...rest }, children);
    }),
  };
});

vi.mock("next/dynamic", async () => {
  const React = await import("react");
  return {
    default: (
      loader: () => Promise<unknown>,
      options?: { loading?: () => React.ReactNode },
    ): React.ComponentType<Record<string, unknown>> => {
      let loaded: React.ComponentType<Record<string, unknown>> | null = null;
      const started = loader().then((mod) => {
        loaded = ((mod as { default?: unknown }).default ?? mod) as React.ComponentType<Record<string, unknown>>;
      });
      pendingDynamicLoads.push(started);
      function DynamicStandIn(props: Record<string, unknown>) {
        const [, rerender] = React.useReducer((n: number) => n + 1, 0);
        React.useEffect(() => {
          if (!loaded && !forceDynamicLoading) void started.then(rerender);
        }, []);
        if (loaded && !forceDynamicLoading) return React.createElement(loaded, props);
        return options?.loading ? React.createElement(React.Fragment, null, options.loading()) : null;
      }
      return DynamicStandIn;
    },
  };
});

export function installMatchMediaStub(matches = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(), // deprecated, kept for older consumers
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(async () => {
  // Every code-split pane has finished loading before the test renders, so it mounts synchronously.
  // A loaded chunk can itself call dynamic() (the phone menu's sheets load its search results), so
  // wait until no new load has started.
  for (let settled = -1; settled !== pendingDynamicLoads.length;) {
    settled = pendingDynamicLoads.length;
    await Promise.all(pendingDynamicLoads);
  }
  installMatchMediaStub(false);
  // jsdom does not implement scrollIntoView; components call it on focus/expand.
  // Ensure a base impl exists, then re-spy each test so the mock's call history is
  // reset every time — vi.restoreAllMocks() only restores vi.spyOn spies, not a
  // one-time plain vi.fn() assignment.
  if (typeof Element.prototype.scrollIntoView !== "function") {
    Element.prototype.scrollIntoView = () => {};
  }
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
});

afterEach(() => {
  forceDynamicLoading = false;
  cleanup();
  vi.restoreAllMocks();
  try {
    window.sessionStorage.clear();
    window.localStorage.clear();
  } catch {
    // ignore in environments without web storage
  }
  // DA-15: screens keep their filters in the web address, so each test starts from a clean one too.
  window.history.replaceState(null, "", window.location.pathname);
});

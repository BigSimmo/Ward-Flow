import { act, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/governance",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { WardRail } from "@/components/ward-management/shell/ward-rail";
import { RAIL_OPEN_STORAGE_KEY, WARD_RAIL_EARLY_SCRIPT } from "@/components/ward-management/shell/ward-rail-early";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { Hero } from "@/components/wf";

/**
 * Load-time flash and layout shift (13 Oct 2026). Measured on the production build before the fix:
 * the desktop header showed light glass for a frame (or faded from it) before settling in band ink,
 * and Governance shifted by 0.21 at 1440px (0.55 with the rail pinned closed). Three causes:
 * - the band hero's first measure wrote a transient `data-band="off"`, which ended the header's
 *   pre-hydration ink rule mid-load;
 * - the server band assumed 16px page insets, but the mode workspace pads 8px and 24px;
 * - the rail's server render depended on widths and a stored preference only the browser knows.
 */

const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//gu, "");

function mockViewport(matching: (query: string) => boolean) {
  return vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches: matching(query),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.removeItem(RAIL_OPEN_STORAGE_KEY);
  document.documentElement.removeAttribute("data-rail");
  document.body.innerHTML = "";
  delete (window as unknown as Record<string, unknown>).__wfRailEarly;
});

describe("header: no light flash on load", () => {
  it("never marks a band hero off while it is only being measured", () => {
    const scroller = document.createElement("div");
    scroller.setAttribute("data-wf-scroller", "");
    document.body.append(scroller);
    const observer = new MutationObserver(() => {});
    observer.observe(scroller, {
      attributes: true,
      attributeFilter: ["data-band"],
      attributeOldValue: true,
      subtree: true,
    });
    const { getByTestId } = render(<Hero title="Governance" testId="band-hero" />, { container: scroller });
    const records = observer.takeRecords();
    observer.disconnect();
    const final = getByTestId("band-hero").getAttribute("data-band");
    // Every value the hero carried, in order: each record's old value after the first, then the last.
    const written = [...records.slice(1).map((record) => record.oldValue), final];
    expect(final).toMatch(/^(on|off)$/u);
    expect(written[0]).toBe("measuring");
    expect(written.slice(0, -1)).not.toContain("off");
  });

  it("keeps the header in band ink until a band hero is measured off", () => {
    const css = strip(readFileSync("src/components/ward-management/shell/ward-bar.module.css", "utf8"));
    const arms = css.match(/:has\(\[data-wf-hero="band"\][^)]*\)\)/gu) ?? [];
    expect(arms.length).toBeGreaterThan(0);
    for (const arm of arms) expect(arm).toBe(':has([data-wf-hero="band"]:not([data-band="off"]))');
  });

  // Batch 5 (13 Oct 2026): the phone bar flashed light on slow loads, because only desktop had the
  // pre-band arm. The phone ink face now takes it too, except once the bar has scrolled.
  it("paints the phone bar ink before it has its own data-band, but not once it has scrolled", () => {
    const css = strip(readFileSync("src/components/ward-management/shell/ward-bar.module.css", "utf8"));
    // The arm that skips a scrolled bar is the phone one; desktop has no data-scrolled face.
    const inkRule =
      /\.bar\.bar:is\(\s*\[data-band="ink"\],\s*:where\(([^{]*:not\(\[data-band\]\):not\(\[data-scrolled\]\))\s*\)\s*\)\s*\{[^}]*background:\s*var\(--wf-hero-1\)/u.exec(
        css,
      );
    expect(inkRule, "the phone ink face has no pre-band arm").not.toBeNull();
    expect(inkRule![1]).toContain(':has([data-wf-hero="band"]:not([data-band="off"]))');
  });
});

describe("Governance: the server band sits where the measure will put it", () => {
  it("takes the page insets from the mode workspace", () => {
    const hero = strip(readFileSync("src/components/wf/hero.module.css", "utf8"));
    const serverBand =
      /:global\(\[data-wf-scroller\]\)\s*\.hero\[data-wf-hero="band"\]:not\(\[data-band\]\)\s*\{([^}]*)\}/u.exec(
        hero,
      )?.[1];
    expect(serverBand).toMatch(/--wf-band-top:\s*var\(--wf-band-page-top,\s*var\(--wf-s-4\)\)/u);
    expect(serverBand).toMatch(/--wf-band-left:\s*var\(--wf-band-page-x,\s*var\(--wf-s-4\)\)/u);
    expect(serverBand).toMatch(/--wf-band-right:\s*var\(--wf-band-page-x,\s*var\(--wf-s-4\)\)/u);

    const modes = strip(readFileSync("src/components/ward-management/ward-management-modes.module.css", "utf8"));
    const content = /\n\.thirdEditionModeShell \.modeContent \{([^}]*)\}/u.exec(modes)?.[1];
    expect(content).toMatch(/--wf-band-page-top:\s*0\.5rem/u);
    expect(content).toMatch(/--wf-band-page-x:\s*1\.5rem/u);
    // The published insets are the padding itself, so they cannot drift apart.
    expect(content).toMatch(/padding:\s*var\(--wf-band-page-top\)\s+var\(--wf-band-page-x\)\s+1\.5rem/u);
  });
});

describe("phone Home: the hero paints as the band before it is measured", () => {
  it("uses the Home page's phone insets and the phone band's own spacing", () => {
    const home = strip(readFileSync("src/components/ward-management/coordinator/home.module.css", "utf8"));
    const serverBand =
      /:global\(\[data-wf-scroller\]\)\s*\.homeHero\[data-wf-hero="band"\]:not\(\[data-band\]\)\s*\{([^}]*)\}/u.exec(
        home,
      )?.[1];
    // The Home body pads 12px on top and 16px at the sides on a phone; the measure pulls the band
    // out by exactly that, so the server band does the same (layout shift 0.18 to 0.001, 390px).
    expect(home).toMatch(/\.body\s*\{\s*padding:\s*var\(--wf-s-3\)\s+var\(--wf-s-4\);/u);
    expect(serverBand).toMatch(/margin:\s*calc\(-1 \* var\(--wf-s-3\)\)\s+calc\(-1 \* var\(--wf-s-4\)\)\s+-10px;/u);
    // The same padding as the phone `.hero[data-band="on"]` rule in hero.module.css.
    expect(serverBand).toMatch(/padding:\s*6px var\(--wf-s-4\) calc\(18px \+ var\(--wf-band-lip\)\);/u);
    const hero = strip(readFileSync("src/components/wf/hero.module.css", "utf8"));
    expect(hero).toMatch(
      /padding-top:\s*6px;\s*padding-right:\s*16px;\s*padding-bottom:\s*calc\(18px \+ var\(--wf-band-lip\)\);/u,
    );
  });
});

describe("desktop rail: the server render is the settled render", () => {
  function railItemClasses(container: ParentNode) {
    return [...container.querySelectorAll('[data-testid="ward-rail"] [aria-label="Ward Flow views"] li')].map(
      (item) => `${item.querySelector("a")?.getAttribute("href")} ${item.className}`,
    );
  }

  it("marks the same rail entries as narrow-only on the server and on a desktop browser", () => {
    const tree = (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardRail />
      </WardFlowProvider>
    );
    const host = document.createElement("div");
    host.innerHTML = renderToString(tree);
    const server = railItemClasses(host);
    mockViewport((query) => query === "(min-width: 1001px)");
    const { container } = render(tree);
    expect(server.length).toBeGreaterThan(0);
    expect(railItemClasses(container)).toEqual(server);
  });

  it("hides narrow-only entries at 1000px and below only", () => {
    const css = strip(readFileSync("src/components/ward-management/shell/ward-rail.module.css", "utf8"));
    const desktop = [...css.matchAll(/@media \(min-width: 1001px\) \{([\s\S]*?)\n\}/gu)].map((m) => m[1]).join("");
    expect(desktop).not.toMatch(/compactExtra/u);
  });
});

describe("rail early script", () => {
  function runWith({
    query,
    stored,
    storageThrows = false,
  }: {
    query: (q: string) => boolean;
    stored?: string;
    storageThrows?: boolean;
  }) {
    document.body.innerHTML = '<nav data-testid="ward-rail" data-rail="open"></nav>';
    mockViewport(query);
    if (stored) window.localStorage.setItem(RAIL_OPEN_STORAGE_KEY, stored);
    if (storageThrows) {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
    }
    new Function(WARD_RAIL_EARLY_SCRIPT)();
    const rail = document.querySelector('[data-testid="ward-rail"]')!;
    return {
      rail: rail.getAttribute("data-rail"),
      tablet: rail.getAttribute("data-tablet"),
      root: document.documentElement.getAttribute("data-rail"),
    };
  }
  const desktop = (q: string) => q === "(min-width: 1001px)";
  const tablet = (q: string) => q === "(min-width: 1001px)" || q === "(max-width: 1200px)";
  const narrow = (q: string) => q === "(max-width: 1200px)";

  it("draws a stored closed rail closed on desktop before the app loads", () => {
    expect(runWith({ query: desktop, stored: "closed" })).toEqual({ rail: "closed", tablet: null, root: "closed" });
  });

  it("leaves the open rail alone on desktop", () => {
    expect(runWith({ query: desktop, stored: "open" })).toEqual({ rail: "open", tablet: null, root: null });
    expect(runWith({ query: desktop })).toEqual({ rail: "open", tablet: null, root: null });
  });

  it("draws the tablet landscape icon rail, whatever is stored", () => {
    expect(runWith({ query: tablet, stored: "open" })).toEqual({ rail: "closed", tablet: "landscape", root: null });
    expect(runWith({ query: tablet, storageThrows: true })).toEqual({
      rail: "closed",
      tablet: "landscape",
      root: null,
    });
  });

  it("does nothing at 1000px and below, so phone and tablet portrait are unchanged", () => {
    expect(runWith({ query: narrow, stored: "closed" })).toEqual({ rail: "open", tablet: null, root: null });
  });
});

describe("rail early script and hydration", () => {
  it("hydrates over a rail the script closed without a mismatch, then stays closed", async () => {
    const tree = (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardRail />
      </WardFlowProvider>
    );
    const host = document.createElement("div");
    host.innerHTML = renderToString(tree);
    document.body.append(host);
    expect(host.querySelector('[data-testid="ward-rail"]')).toHaveAttribute("data-rail", "open");

    mockViewport((query) => query === "(min-width: 1001px)" || query === "(min-width: 1201px)");
    window.localStorage.setItem(RAIL_OPEN_STORAGE_KEY, "closed");
    new Function(WARD_RAIL_EARLY_SCRIPT)();
    expect(host.querySelector('[data-testid="ward-rail"]')).toHaveAttribute("data-rail", "closed");

    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const recoverable: unknown[] = [];
    await act(async () => {
      hydrateRoot(host, tree, { onRecoverableError: (error) => recoverable.push(error) });
    });
    const mismatch = errors.mock.calls.filter((call) => /hydrat|did(n't| not) match/iu.test(String(call[0])));
    expect(mismatch).toEqual([]);
    expect(recoverable).toEqual([]);
    expect(host.querySelector('[data-testid="ward-rail"]')).toHaveAttribute("data-rail", "closed");
  });
});

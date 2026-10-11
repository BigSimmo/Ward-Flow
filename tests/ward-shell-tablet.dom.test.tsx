import { readFileSync } from "node:fs";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const route = { pathname: "/mockups/ward-flow" };
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import { TABLET_LANDSCAPE_RAIL_QUERY, WardRail } from "@/components/ward-management/shell/ward-rail";
import { RAIL_GROUPS } from "@/components/ward-management/shell/ward-rail-entries";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * v10 shell, tablet (10 Oct 2026). Landscape 1180: the 64px icon rail with Today and Where, then
 * More, which opens the full sidebar over the page. Portrait 820: no sidebar; Menu at the left of
 * the header opens the full sidebar as a 280px sheet over a scrim. Desktop above 1200px keeps the
 * stored open or closed rail (tests/ward-shell-third-edition.dom.test.tsx); the 1000px wrapping-row
 * block those tests pin stays in the stylesheet and is overridden for 769px to 1000px only.
 */

function mockViewport(matching: readonly string[]) {
  return vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches: matching.includes(query),
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

function renderShell() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardLiveRegion />
      <WardRail />
      <WardBar />
    </WardFlowProvider>,
  );
}

beforeEach(() => {
  route.pathname = "/mockups/ward-flow";
  if (typeof window.requestAnimationFrame !== "function") {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame;
  }
});

afterEach(() => {
  resetWardLiveRegionForTests();
  window.localStorage.removeItem("ward-flow-rail");
  document.body.style.overflow = "";
  document.documentElement.removeAttribute("data-rail");
});

describe("tablet landscape (1001px to 1200px)", () => {
  it("draws the icon rail even when the stored preference is open, with Today and Where, then More", async () => {
    const media = mockViewport(["(min-width: 1001px)", TABLET_LANDSCAPE_RAIL_QUERY]);
    window.localStorage.setItem("ward-flow-rail", "open");
    try {
      renderShell();
      const rail = screen.getByTestId("ward-rail");
      await waitFor(() => expect(rail).toHaveAttribute("data-tablet", "landscape"));
      expect(rail).toHaveAttribute("data-rail", "closed");
      const views = within(rail).getByRole("navigation", { name: "Ward Flow views" });
      const groups = Array.from(views.querySelectorAll(":scope > section")).map((section) =>
        section.getAttribute("aria-label"),
      );
      expect(groups).toEqual(RAIL_GROUPS.slice(0, 2).map((group) => group.label));
      expect(groups).toEqual(["Today", "Where"]);

      const more = within(rail).getByTestId("ward-rail-tablet-more");
      expect(more).toHaveAccessibleName("More pages");
      fireEvent.click(more);
      const sheet = await screen.findByTestId("ward-rail-more-pages");
      // The full sidebar: every group, Work and Checks included.
      for (const group of RAIL_GROUPS) {
        expect(within(sheet).getByRole("region", { name: group.label })).toBeInTheDocument();
      }
    } finally {
      media.mockRestore();
    }
  });

  it("opens the full sidebar from the mark and from [, never changing the stored preference", async () => {
    const media = mockViewport(["(min-width: 1001px)", TABLET_LANDSCAPE_RAIL_QUERY]);
    window.localStorage.setItem("ward-flow-rail", "closed");
    try {
      renderShell();
      const mark = await screen.findByTestId("ward-rail-brand-open");
      fireEvent.click(mark);
      expect(await screen.findByTestId("ward-rail-more-pages")).toBeInTheDocument();
      expect(window.localStorage.getItem("ward-flow-rail")).toBe("closed");
    } finally {
      media.mockRestore();
    }
  });

  it("leaves desktop above 1200px on the stored preference with every group", async () => {
    const media = mockViewport(["(min-width: 1001px)"]);
    window.localStorage.setItem("ward-flow-rail", "open");
    try {
      renderShell();
      const rail = screen.getByTestId("ward-rail");
      expect(rail).not.toHaveAttribute("data-tablet");
      expect(rail).toHaveAttribute("data-rail", "open");
      expect(within(rail).queryByTestId("ward-rail-tablet-more")).toBeNull();
      const views = within(rail).getByRole("navigation", { name: "Ward Flow views" });
      expect(views.querySelectorAll(":scope > section")).toHaveLength(RAIL_GROUPS.length);
    } finally {
      media.mockRestore();
    }
  });
});

describe("tablet portrait (769px to 1000px)", () => {
  const css = (path: string) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//gu, "");

  it("drops the sidebar and shows the bar's Menu, both after the rules they override", () => {
    const rail = css("src/components/ward-management/shell/ward-rail.module.css");
    const portrait = rail.lastIndexOf("@media (min-width: 48.0625rem) and (max-width: 1000px)");
    expect(portrait).toBeGreaterThan(rail.lastIndexOf("@media (max-width: 1000px)"));
    expect(rail.slice(portrait)).toMatch(/\.rail,\s*\.rail\[data-rail="closed"\] \{\s*display: none;/u);

    const bar = css("src/components/ward-management/shell/ward-bar.module.css");
    const barPortrait = bar.lastIndexOf("@media (min-width: 48.0625rem) and (max-width: 1000px)");
    expect(barPortrait).toBeGreaterThan(bar.indexOf(".phoneOnly {\n  display: none;"));
    expect(bar.slice(barPortrait)).toMatch(/\.phoneOnly \{\s*display: inline-flex;[^}]*width: var\(--wf-touch\);/u);
  });

  it("opens the rail's full sidebar from the left, 280px wide, when the bar's Menu is pressed above the phone", async () => {
    const media = mockViewport([]);
    try {
      renderShell();
      fireEvent.click(screen.getByTestId("ward-bar-phone-menu"));
      const sheet = await screen.findByTestId("ward-rail-more-pages");
      const panel = sheet.closest("[style]") as HTMLElement | null;
      expect(panel?.style.maxWidth).toContain("17.5rem");
      for (const group of RAIL_GROUPS) {
        expect(within(sheet).getByRole("region", { name: group.label })).toBeInTheDocument();
      }
    } finally {
      media.mockRestore();
    }
  });
});

describe("header titles for the report pages (v10 pass 2)", () => {
  it.each([
    ["/mockups/ward-flow/reports/downtime", "Downtime pack"],
    ["/mockups/ward-flow/reports/chronology", "Patient chronology"],
  ])("titles %s as %s", (pathname, title) => {
    route.pathname = pathname;
    renderShell();
    expect(screen.getByTestId("ward-bar-route-title")).toHaveTextContent(title);
  });
});

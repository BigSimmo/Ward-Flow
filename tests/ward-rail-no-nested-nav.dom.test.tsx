import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const route = { pathname: "/ward-flow" };
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import { WardRail } from "@/components/ward-management/shell/ward-rail";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

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
    </WardFlowProvider>,
  );
}

beforeEach(() => {
  route.pathname = "/ward-flow";
});

afterEach(() => {
  resetWardLiveRegionForTests();
});

/**
 * P084: a navigation landmark must not sit inside another navigation landmark. The rail is a
 * labelled complementary region ("Ward Flow sections") holding the one "Ward Flow views" nav.
 */
describe("ward rail landmarks (P084)", () => {
  it("has no navigation landmark nested inside another", () => {
    const media = mockViewport(["(min-width: 1001px)"]);
    try {
      renderShell();
      const rail = screen.getByTestId("ward-rail");
      expect(rail.tagName).toBe("ASIDE");
      expect(rail).toHaveAccessibleName("Ward Flow sections");
      expect(within(rail).getByRole("navigation", { name: "Ward Flow views" })).toBeInTheDocument();
      expect(document.querySelectorAll("nav nav")).toHaveLength(0);
    } finally {
      media.mockRestore();
    }
  });
});

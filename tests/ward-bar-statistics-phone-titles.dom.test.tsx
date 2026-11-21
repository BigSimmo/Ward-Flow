// Phone review F-12 (Oct 2026): the lean phone bar names each statistics page by its tab's own
// word, so it never mixes "Statistics" with "EDs". Wider screens say "Statistics" on every tab.
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: "/bedchart/statistics/compare" }));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { NextBar as WardBar } from "@/components/ward-management/shell-next/next-bar";
import { resetServiceScopeForTests } from "@/components/ward-management/shell/ward-service-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

function titleOn(pathname: string, phone: boolean) {
  route.pathname = pathname;
  installMatchMediaStub(phone);
  const view = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardBar />
    </WardFlowProvider>,
  );
  const text = screen.getByTestId("ward-bar-route-title").textContent;
  view.unmount();
  return text;
}

afterEach(() => {
  installMatchMediaStub(false);
  resetServiceScopeForTests();
});

describe("statistics titles in the phone bar", () => {
  it("uses the tab words on a phone", () => {
    expect(titleOn("/bedchart/statistics/overview", true)).toBe("Overview");
    expect(titleOn("/bedchart/statistics/compare", true)).toBe("Compare");
    expect(titleOn("/bedchart/statistics/eds", true)).toBe("EDs");
  });

  // UX review 20 Nov 2026 (pattern A): the wider bar carries the page's short name on every tab.
  it("says Statistics on every statistics tab on wider screens", () => {
    expect(titleOn("/bedchart/statistics/overview", false)).toBe("Statistics");
    expect(titleOn("/bedchart/statistics/compare", false)).toBe("Statistics");
    expect(titleOn("/bedchart/statistics/wards", false)).toBe("Statistics");
    expect(titleOn("/bedchart/statistics/eds", false)).toBe("Statistics");
  });

  it("names Today's review and Leave instead of BedChart", () => {
    expect(titleOn("/bedchart/review", false)).toBe("Today's review");
    expect(titleOn("/bedchart/leave", false)).toBe("Leave");
  });
});

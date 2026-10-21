import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * My wards (fix plan item 14, 21 Oct 2026): a person pins wards on this device and reaches them from
 * the rail or the phone menu. The store holds ward ids only, survives a reload, and is forgotten at
 * sign-out with the rest of the person's browser data.
 */

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

import { WardMyWards, wardIdFromPath } from "@/components/ward-management/shell/ward-my-wards";
import {
  MY_WARDS_LIMIT,
  MY_WARDS_STORAGE_KEY,
  parseMyWards,
  resetMyWardsForTests,
  toggleMyWard,
} from "@/components/ward-management/shell/ward-my-wards-store";
import { endWardFlowBrowserSession } from "@/components/ward-management/ward-browser-data";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

const units = seedWardFlowState().units;
const [first, second] = units;

function renderSection() {
  return render(
    <WardFlowProvider>
      <WardMyWards variant="rail" />
    </WardFlowProvider>,
  );
}

beforeEach(() => {
  route.pathname = "/ward-flow";
  resetMyWardsForTests();
});

afterEach(() => {
  resetMyWardsForTests();
});

describe("My wards store", () => {
  it("keeps valid ward ids only, without repeats, up to the limit", () => {
    expect(parseMyWards(null)).toEqual([]);
    expect(parseMyWards("not json")).toEqual([]);
    expect(parseMyWards('{"a":1}')).toEqual([]);
    expect(parseMyWards('["alb-adult-open","Typed Name","alb-adult-open",3]')).toEqual(["alb-adult-open"]);
    const many = Array.from({ length: MY_WARDS_LIMIT + 3 }, (_, index) => `w-${index}`);
    expect(parseMyWards(JSON.stringify(many))).toHaveLength(MY_WARDS_LIMIT);
  });

  it("refuses anything that is not a ward id and stops at the limit", () => {
    expect(toggleMyWard("Jane Citizen")).toBe("refused");
    for (let index = 0; index < MY_WARDS_LIMIT; index++) expect(toggleMyWard(`w-${index}`)).toBe("pinned");
    expect(toggleMyWard("w-extra")).toBe("full");
    expect(toggleMyWard("w-0")).toBe("unpinned");
  });

  it("is forgotten when the signed-in session ends", () => {
    toggleMyWard(first.id);
    expect(window.localStorage.getItem(MY_WARDS_STORAGE_KEY)).toBe(JSON.stringify([first.id]));
    endWardFlowBrowserSession();
    expect(window.localStorage.getItem(MY_WARDS_STORAGE_KEY)).toBeNull();
  });

  it("reads the ward from a ward page address only", () => {
    expect(wardIdFromPath(`/ward-flow/ward/${first.id}/answer`)).toBe(first.id);
    expect(wardIdFromPath("/ward-flow/wards")).toBeUndefined();
  });
});

describe("My wards section", () => {
  it("lets the phone menu pin a ward from a list, since its menu is not reachable on a ward page", () => {
    render(
      <WardFlowProvider>
        <WardMyWards variant="sheet" />
      </WardFlowProvider>,
    );
    fireEvent.change(screen.getByTestId("ward-my-wards-add"), { target: { value: first!.id } });
    expect(screen.getAllByTestId("ward-my-wards-link").map((link) => link.textContent)).toEqual([first!.name]);
  });

  it("renders nothing away from a ward page until a ward is pinned", () => {
    renderSection();
    expect(screen.queryByTestId("ward-my-wards")).toBeNull();
  });

  it("offers Pin this ward on a ward page, then lists the ward with a remove button", () => {
    route.pathname = `/ward-flow/ward/${first.id}`;
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: `Pin ${first.name} to My wards` }));
    const link = screen.getByRole("link", { name: first.name });
    expect(link.getAttribute("href")).toBe(`/ward-flow/ward/${first.id}`);
    expect(link.getAttribute("aria-current")).toBe("page");
    expect(screen.queryByTestId("ward-my-wards-pin")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `Remove ${first.name} from My wards` }));
    expect(screen.queryByRole("link", { name: first.name })).toBeNull();
  });

  it("lists pins in pinned order on any page and skips a ward not in today's network", () => {
    act(() => {
      toggleMyWard(second.id);
      toggleMyWard("not-in-network");
      toggleMyWard(first.id);
    });
    renderSection();
    const names = screen.getAllByTestId("ward-my-wards-link").map((node) => node.textContent);
    expect(names).toEqual([second.name, first.name]);
  });
});

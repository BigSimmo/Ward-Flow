// shell-10 (13 Oct 2026): a route-level loading placeholder inside the Ward Flow shell, so a tap on
// slow signal shows at once that a page is on its way.
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/ward-flow/delays" as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

import WardFlowLoading from "@/app/ward-flow/loading";

afterEach(() => {
  navigation.pathname = "/ward-flow/delays";
});

describe("Ward Flow route loading state", () => {
  it("announces the page is loading and keeps the main landmark the skip link targets", () => {
    render(<WardFlowLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading page");
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("aria-busy", "true");
  });

  // pop-state-loading (Josh, 31 Oct 2026): the blocks take the shape of the page on its way.
  it.each([
    ["/ward-flow", "home"],
    ["/ward-flow/", "home"],
    ["/ward-flow/capacity", "capacity"],
    ["/ward-flow/waiting", "waiting"],
    ["/ward-flow/delays", "plain"],
    [null, "plain"],
  ])("draws the %s placeholder in the %s shape, hidden from screen readers", (pathname, shape) => {
    navigation.pathname = pathname;
    const { container } = render(<WardFlowLoading />);
    const blocks = container.querySelector(`[data-shape="${shape}"]`);
    expect(blocks).not.toBeNull();
    expect(blocks).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the synthetic prototype footer while the page loads", () => {
    render(<WardFlowLoading />);
    expect(screen.getByRole("main")).toHaveTextContent("Synthetic prototype");
  });
});

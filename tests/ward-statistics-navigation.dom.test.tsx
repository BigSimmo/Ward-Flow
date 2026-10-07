import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { StatisticsNav } from "@/components/ward-management/statistics/statistics-nav";

const routing = vi.hoisted(() => ({ pathname: "/mockups/ward-flow/statistics", push: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => routing.pathname, useRouter: () => ({ push: routing.push }) }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => <a {...props}>{children}</a>,
}));

describe("one shared statistics navigation", () => {
  it.each([
    ["", "Summary"],
    ["/overview", "Overview"],
    ["/compare", "Compare"],
    ["/service/North%20Metro", "Services"],
    ["/ward/scgh-adult-open", "Wards"],
    ["/ed/scgh", "EDs"],
    ["/community/bentley", "Teams"],
  ])("keeps the same destinations and exactly one current page on %s", (suffix, label) => {
    routing.pathname = `/mockups/ward-flow/statistics${suffix}`;
    render(<StatisticsNav />);
    const nav = within(screen.getByRole("navigation", { name: "Ward Flow statistics sections" }));
    const links = nav.getAllByRole("link");
    // v6 hero track (7 Oct 2026): short labels, the four unit kinds carrying their counts.
    expect(links.map((link) => link.textContent?.replace(/\d+$/, ""))).toEqual([
      "Summary",
      "Overview",
      "Compare",
      "Services",
      "Wards",
      "EDs",
      "Teams",
    ]);
    expect(links.filter((link) => link.getAttribute("aria-current") === "page")).toHaveLength(1);
    const current = nav.getByRole("link", { name: new RegExp(`^${label}(\\s*\\d+)?$`) });
    expect(current).toHaveAttribute("aria-current", "page");
    if (suffix.includes("/ward/")) expect(current).toHaveAttribute("href", routing.pathname);
  });

  it("uses the same destinations from the compact mobile selector", () => {
    routing.pathname = "/mockups/ward-flow/statistics";
    render(<StatisticsNav />);
    fireEvent.change(screen.getByLabelText("Statistics section"), { target: { value: "overview" } });
    expect(routing.push).toHaveBeenCalledWith("/mockups/ward-flow/statistics/overview");
    fireEvent.change(screen.getByLabelText("Statistics section"), { target: { value: "service" } });
    expect(routing.push).toHaveBeenCalledWith("/mockups/ward-flow/statistics#choose-a-health-service");
  });
});

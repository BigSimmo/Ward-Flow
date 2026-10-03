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
    ["/overview", "Network overview"],
    ["/compare", "Compare"],
    ["/service/North%20Metro", "Health services"],
    ["/ward/scgh-adult-open", "Wards"],
    ["/ed/scgh", "Emergency departments"],
    ["/community/bentley", "Community teams"],
  ])("keeps the same destinations and exactly one current page on %s", (suffix, label) => {
    routing.pathname = `/mockups/ward-flow/statistics${suffix}`;
    render(<StatisticsNav />);
    const nav = within(screen.getByRole("navigation", { name: "Ward Flow statistics sections" }));
    const links = nav.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Summary",
      "Network overview",
      "Compare",
      "Health services",
      "Wards",
      "Emergency departments",
      "Community teams",
    ]);
    expect(links.filter((link) => link.getAttribute("aria-current") === "page")).toHaveLength(1);
    expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    if (suffix.includes("/ward/"))
      expect(nav.getByRole("link", { name: label })).toHaveAttribute("href", routing.pathname);
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

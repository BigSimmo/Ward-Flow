import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { StatisticsNav } from "@/components/ward-management/statistics/statistics-nav";

const routing = vi.hoisted(() => ({ pathname: "/ward-flow/statistics", push: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => routing.pathname, useRouter: () => ({ push: routing.push }) }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => <a {...props}>{children}</a>,
}));

describe("one shared statistics navigation", () => {
  it.each([
    ["", "Summary"],
    ["/overview", "Overview"],
    ["/compare", "Compare"],
    ["/services", "Services"],
    ["/service/North%20Metro", "Services"],
    ["/wards", "Wards"],
    ["/ward/scgh-adult-open", "Wards"],
    ["/eds", "EDs"],
    ["/ed/scgh", "EDs"],
    ["/teams", "Teams"],
    ["/community/bentley", "Teams"],
    ["/weekly", "Weekly"],
  ])("keeps the same destinations and exactly one current page on %s", (suffix, label) => {
    routing.pathname = `/ward-flow/statistics${suffix}`;
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
      "Weekly",
    ]);
    expect(links.filter((link) => link.getAttribute("aria-current") === "page")).toHaveLength(1);
    const current = nav.getByRole("link", { name: new RegExp(`^${label}(\\s*\\d+)?$`) });
    expect(current).toHaveAttribute("aria-current", "page");
    // Each unit kind's tab opens its index page (Statistics A, 9 Oct 2026), from a detail page too.
    if (suffix.includes("/ward")) expect(current).toHaveAttribute("href", "/ward-flow/statistics/wards");
  });

  it.each([
    ["", undefined, "Summary"],
    ["/teams", undefined, "Teams"],
    ["/weekly", undefined, "Weekly"],
    ["/service/North%20Metro", "North Metro", "Services"],
  ])("shows the same eight phone chips on %s (phone review F-12)", (suffix, slug, label) => {
    routing.pathname = `/ward-flow/statistics${suffix}`;
    render(<StatisticsNav variant="chips" activeSlug={slug} withSamples={false} />);
    const nav = within(screen.getByRole("navigation", { name: "Ward Flow statistics sections" }));
    const links = nav.getAllByRole("link");
    expect(links.map((link) => link.textContent?.replace(/\d+$/, ""))).toEqual([
      "Summary",
      "Overview",
      "Compare",
      "Services",
      "Wards",
      "EDs",
      "Teams",
      "Weekly",
    ]);
    const current = links.filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]!.textContent).toMatch(new RegExp(`^${label}`));
    // One unit's page: its kind's chip is the way back to that kind's index, not an extra chip.
    expect(nav.queryAllByTestId("ward-statistics-nav-back")).toHaveLength(slug ? 1 : 0);
  });

  it("uses the same destinations from the compact mobile selector", () => {
    routing.pathname = "/ward-flow/statistics";
    render(<StatisticsNav />);
    fireEvent.change(screen.getByLabelText("Statistics section"), { target: { value: "overview" } });
    expect(routing.push).toHaveBeenCalledWith("/ward-flow/statistics/overview");
    fireEvent.change(screen.getByLabelText("Statistics section"), { target: { value: "service" } });
    expect(routing.push).toHaveBeenCalledWith("/ward-flow/statistics/services");
  });
});

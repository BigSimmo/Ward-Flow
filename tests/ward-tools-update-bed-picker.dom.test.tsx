import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardToolsSheet } from "@/components/ward-management/tools/ward-tools-sheet";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/capacity",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

/**
 * Audit P023 (Josh, 9:57 PM 27 Oct 2026): "Update a bed" no longer drops a coordinator on the
 * statewide Wards list with no next step. It opens a "Choose a ward" list in the sheet, and each
 * ward opens that ward's page. A ward desk still goes straight to its own ward.
 */
describe("Tools > Update a bed (audit P023)", () => {
  it("opens a Choose a ward list in the sheet, each ward linking to its own page", () => {
    const onNavigate = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardToolsSheet isPhone={false} roleLabel="Bed coordinator" onNavigate={onNavigate} onNewReferral={vi.fn()} />
      </WardFlowProvider>,
    );
    expect(screen.queryByRole("link", { name: /Update a bed/u })).toBeNull();
    // The Suggested row may also offer Update a bed, so the row is found by its own toggle.
    const toggle = screen.getByTestId("ward-tools-toggle-update-bed");
    expect(toggle).toHaveAccessibleName(/Update a bed/u);
    fireEvent.click(toggle);
    const list = screen.getByRole("list", { name: "Choose a ward" });
    const links = within(list).getAllByRole("link");
    expect(links.length).toBeGreaterThan(1);
    for (const link of links) expect(link.getAttribute("href")).toMatch(/^\/ward-flow\/ward\/[^/?]+$/u);
    // Find a ward narrows the list to the typed ward, which still links to its own page.
    const first = links[0]!;
    const name = first.textContent ?? "";
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a ward" }), { target: { value: name } });
    const narrowed = within(screen.getByRole("list", { name: "Choose a ward" })).getAllByRole("link");
    expect(narrowed.length).toBeGreaterThanOrEqual(1);
    for (const link of narrowed) expect(link.textContent?.toLowerCase()).toContain(name.toLowerCase());
    expect(narrowed.map((link) => link.getAttribute("href"))).toContain(first.getAttribute("href"));
    fireEvent.click(narrowed[0]!);
    expect(onNavigate).toHaveBeenCalled();
  });
});

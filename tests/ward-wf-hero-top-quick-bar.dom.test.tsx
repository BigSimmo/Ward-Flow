import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { HeroFootSlotProvider, HeroQuickChips, HeroTop } from "@/components/wf";

// The desk home's Quick bar reaches a page top through the hero foot slot. HeroTop draws it as the
// chip row, a page's own chips replace it, and `quickBar={false}` leaves it out (Capacity, All wards).
function renderTop(top: ReactNode) {
  return render(
    <HeroFootSlotProvider value={<p data-testid="shell-quick-bar">Quick bar</p>}>{top}</HeroFootSlotProvider>,
  );
}

const ownChips = (
  <HeroQuickChips label="Page actions" items={[{ id: "find", label: "Find a bed", onClick: () => {} }]} />
);

describe("HeroTop and the shell Quick bar", () => {
  it("draws the Quick bar as the chip row when the page passes no chips", () => {
    renderTop(<HeroTop figures={<p>figures</p>} />);
    expect(screen.getByTestId("shell-quick-bar")).toBeInTheDocument();
  });

  it("lets the page's own chips replace the Quick bar", () => {
    renderTop(<HeroTop figures={<p>figures</p>} chips={ownChips} />);
    expect(screen.queryByTestId("shell-quick-bar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Find a bed" })).toBeInTheDocument();
  });

  it("leaves the Quick bar out with quickBar={false}, with or without the page's chips", () => {
    const { unmount } = renderTop(<HeroTop figures={<p>figures</p>} quickBar={false} />);
    expect(screen.queryByTestId("shell-quick-bar")).not.toBeInTheDocument();
    unmount();
    renderTop(<HeroTop figures={<p>figures</p>} pill={<p>pill</p>} chips={ownChips} quickBar={false} />);
    expect(screen.queryByTestId("shell-quick-bar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Find a bed" })).toBeInTheDocument();
  });
});

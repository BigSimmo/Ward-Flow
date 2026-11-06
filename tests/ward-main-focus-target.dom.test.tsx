import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WardMainFocusTarget } from "@/components/ward-management/shell/ward-main-focus-target";

afterEach(cleanup);

/**
 * P073 (Alerts accessibility audit): "Skip to main content" jumped to `#main-content`, but a `<main>`
 * is not focusable, so focus stayed on the link and the next Tab went back through the sidebar.
 * The skip link now makes the page's main focusable (tabindex -1, out of the Tab order) and moves
 * focus there. No visible change.
 */
describe("Skip to main content moves focus to the page's main (P073)", () => {
  it("focuses #main-content, kept out of the Tab order", () => {
    render(
      <>
        <WardMainFocusTarget />
        <a href="#main-content">Skip to main content</a>
        <main id="main-content">
          <h1>Alerts</h1>
        </main>
      </>,
    );
    const main = screen.getByRole("main");
    expect(main).not.toHaveAttribute("tabindex");
    fireEvent.click(screen.getByRole("link", { name: "Skip to main content" }));
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(main).toHaveFocus();
  });

  it("leaves a main that already sets its own tabindex alone", () => {
    render(
      <>
        <WardMainFocusTarget />
        <a href="#main-content">Skip to main content</a>
        <main id="main-content" tabIndex={0}>
          <h1>Home</h1>
        </main>
      </>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Skip to main content" }));
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("main")).toHaveFocus();
  });

  // BA-4 (front-end audit, 5 Nov 2026): on the bed meeting TV at desktop a hidden phone-only card
  // also carries id="main-content" ahead of the route, so the skip link focused nothing.
  it("skips a hidden #main-content and focuses the main that is shown", () => {
    render(
      <>
        <WardMainFocusTarget />
        <a href="#main-content">Skip to main content</a>
        <main id="main-content" data-testid="hidden-card" />
        <main id="main-content" data-testid="route-main">
          <h1>Bed meeting</h1>
        </main>
      </>,
    );
    const hidden = screen.getByTestId("hidden-card");
    const route = screen.getByTestId("route-main");
    Object.defineProperty(hidden, "checkVisibility", { configurable: true, value: () => false });
    Object.defineProperty(route, "checkVisibility", { configurable: true, value: () => true });
    const notPrevented = fireEvent.click(screen.getByRole("link", { name: "Skip to main content" }));
    expect(route).toHaveFocus();
    expect(route).toHaveAttribute("tabindex", "-1");
    expect(hidden).not.toHaveAttribute("tabindex");
    expect(notPrevented).toBe(false);
  });
});

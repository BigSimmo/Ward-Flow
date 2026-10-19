import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Design audit DA-26 (19 October 2026): at 1280 to 1440 px the Delays table is wider than its card.
// While it scrolls sideways it must be a keyboard tab stop with a name, and mark the edge that still
// hides columns (the CSS fades that edge). jsdom has no layout, so the widths are set by hand.

const observers: Array<() => void> = [];

afterEach(() => {
  cleanup();
  observers.length = 0;
  vi.unstubAllGlobals();
});

function renderDelays() {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: () => void) {
        observers.push(() => this.callback());
      }
      observe() {}
      disconnect() {}
    },
  );
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DelaysScreen />
    </WardFlowProvider>,
  );
  return screen.getByTestId("delays-waiting-list").parentElement!;
}

function layOut(wrap: HTMLElement, { client, scroll, left }: { client: number; scroll: number; left: number }) {
  Object.defineProperty(wrap, "clientWidth", { configurable: true, value: client });
  Object.defineProperty(wrap, "scrollWidth", { configurable: true, value: scroll });
  wrap.scrollLeft = left;
  act(() => observers.forEach((report) => report()));
}

describe("Delays table sideways scroll (DA-26)", () => {
  it("is a named tab stop that marks its hidden edge only while it overflows", () => {
    const wrap = renderDelays();

    layOut(wrap, { client: 1168, scroll: 1168, left: 0 });
    expect(wrap).not.toHaveAttribute("tabindex");
    expect(wrap).not.toHaveAttribute("role");
    expect(wrap).not.toHaveAttribute("data-more-after");

    layOut(wrap, { client: 818, scroll: 884, left: 0 });
    expect(wrap).toHaveAttribute("tabindex", "0");
    expect(wrap).toHaveAttribute("role", "region");
    expect(wrap).toHaveAccessibleName("Waiting list, scrolls sideways");
    expect(wrap).toHaveAttribute("data-more-after");
    expect(wrap).not.toHaveAttribute("data-more-before");

    wrap.scrollLeft = 66;
    act(() => {
      fireEvent.scroll(wrap);
    });
    expect(wrap).toHaveAttribute("data-more-before");
    expect(wrap).not.toHaveAttribute("data-more-after");
    expect(wrap).toHaveAttribute("tabindex", "0");
  });
});

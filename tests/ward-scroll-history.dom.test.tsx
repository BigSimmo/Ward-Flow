import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let pathname = "/mockups/ward-flow/search";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
import { WardGround } from "@/components/ward-management/ward-shell";

afterEach(() => {
  pathname = "/mockups/ward-flow/search";
  window.history.replaceState(null, "", pathname);
});

describe("Ward desktop scroll history", () => {
  it("starts new pages at the top and returns to the old offset on Back", () => {
    window.history.replaceState(null, "", pathname);
    const view = () => (
      <div data-wf-scroller="">
        <WardGround>
          <p>{pathname}</p>
        </WardGround>
      </div>
    );
    const { container, rerender } = render(view());
    const column = container.firstElementChild as HTMLElement;
    // jsdom does not fire `scroll` for a scrollTop write; a browser does for the user's scroll.
    column.scrollTop = 420;
    fireEvent.scroll(column);
    // A shorter destination can clamp the old column during the route commit.
    column.scrollTop = 0;
    pathname = "/mockups/ward-flow/wards";
    window.history.pushState(null, "", pathname);
    rerender(view());
    expect(column.scrollTop).toBe(0);
    column.scrollTop = 75;
    fireEvent.scroll(column);
    pathname = "/mockups/ward-flow/search";
    window.history.replaceState(null, "", pathname);
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    rerender(view());
    expect(column.scrollTop).toBe(420);
  });

  it("does not treat same-page drawer history as a later route restoration", () => {
    window.history.replaceState(null, "", pathname);
    const view = () => (
      <div>
        <WardGround>
          <p>{pathname}</p>
        </WardGround>
      </div>
    );
    const { container, rerender } = render(view());
    const column = container.firstElementChild as HTMLElement;
    column.scrollTop = 420;
    fireEvent(window, new PopStateEvent("popstate"));
    pathname = "/mockups/ward-flow/wards";
    rerender(view());
    expect(column.scrollTop).toBe(0);
    pathname = "/mockups/ward-flow/search";
    rerender(view());
    expect(column.scrollTop).toBe(0);
  });
});

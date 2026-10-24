import { act, fireEvent, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

let pathname = "/ward-flow/search";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
import { WardGround } from "@/components/ward-management/ward-shell";

afterEach(() => {
  pathname = "/ward-flow/search";
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
    pathname = "/ward-flow/wards";
    window.history.pushState(null, "", pathname);
    rerender(view());
    expect(column.scrollTop).toBe(0);
    column.scrollTop = 75;
    fireEvent.scroll(column);
    pathname = "/ward-flow/search";
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
    pathname = "/ward-flow/wards";
    rerender(view());
    expect(column.scrollTop).toBe(0);
    pathname = "/ward-flow/search";
    rerender(view());
    expect(column.scrollTop).toBe(0);
  });

  // Usability review, 24 Oct 2026: Back puts focus on the link the user opened, not on <body>.
  describe("focus on the opened link after Back", () => {
    const LIST = "/ward-flow/search";
    const RECORD = "/ward-flow/patients/synthetic-p1";
    const afterFrames = () =>
      act(
        () =>
          new Promise<void>((resolve) =>
            window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())),
          ),
      );

    function renderAt(listContent: () => ReactNode) {
      pathname = LIST;
      window.history.replaceState(null, "", pathname);
      const view = () => (
        <div>
          <WardGround>{pathname === LIST ? listContent() : <p>record</p>}</WardGround>
        </div>
      );
      const result = render(view());
      return { ...result, view };
    }

    function goToRecordAndBack(rerender: (ui: ReactElement) => void, view: () => ReactElement) {
      pathname = RECORD;
      window.history.pushState(null, "", pathname);
      rerender(view());
      (document.activeElement as HTMLElement | null)?.blur();
      pathname = LIST;
      window.history.replaceState(null, "", pathname);
      act(() => window.dispatchEvent(new PopStateEvent("popstate")));
      rerender(view());
    }

    it("returns focus to the link that was opened", async () => {
      const { getByRole, rerender, view } = renderAt(() => (
        <>
          <a href="/ward-flow/patients/synthetic-p0">First</a>
          <a href={RECORD}>Second</a>
        </>
      ));
      fireEvent.click(getByRole("link", { name: "Second" }));
      goToRecordAndBack(rerender, view);
      expect(document.activeElement).toBe(document.body);
      await afterFrames();
      expect(getByRole("link", { name: "Second" })).toHaveFocus();
    });

    it("leaves focus on <body> without throwing when the link is no longer there", async () => {
      let showLink = true;
      const { getByRole, rerender, view } = renderAt(() => (showLink ? <a href={RECORD}>Second</a> : <p>no rows</p>));
      fireEvent.click(getByRole("link", { name: "Second" }));
      showLink = false;
      goToRecordAndBack(rerender, view);
      await afterFrames();
      expect(document.activeElement).toBe(document.body);
    });

    it("does not take focus from a control that already holds it", async () => {
      const { getByRole, rerender, view } = renderAt(() => (
        <>
          <button type="button">Filter</button>
          <a href={RECORD}>Second</a>
        </>
      ));
      fireEvent.click(getByRole("link", { name: "Second" }));
      goToRecordAndBack(rerender, view);
      getByRole("button", { name: "Filter" }).focus();
      await afterFrames();
      expect(getByRole("button", { name: "Filter" })).toHaveFocus();
    });
  });
});

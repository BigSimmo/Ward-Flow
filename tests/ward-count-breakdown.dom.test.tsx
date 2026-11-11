import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The panel is fetched on first use; here it renders at once (first call: the pop-up body, second: the sheet).
vi.mock("next/dynamic", async () => {
  const panel = await import("@/components/ward-management/count-breakdown-panel");
  let calls = 0;
  return {
    default: () => {
      calls += 1;
      return calls % 2 === 1 ? panel.CountBreakdownPanel : panel.CountBreakdownSheet;
    },
  };
});

import { CountBreakdown } from "@/components/ward-management/count-breakdown";
import type { BreakdownRow } from "@/components/ward-management/count-breakdown-model";
import { WF_PHONE_QUERY } from "@/components/wf/use-is-phone";

const rows: BreakdownRow[] = [
  { id: "m-1", label: "SYNTHETIC, Alex", detail: "Example ED", href: "/ward-flow/movements/m-1" },
  { id: "m-2", label: "SYNTHETIC, Billie", href: "/ward-flow/movements/m-2" },
  { id: "m-3", label: "Name not recorded" },
];

/** Feature plan item 5: the figure is a button; opening it lists exactly the figure's people. */
describe("count breakdown", () => {
  afterEach(() => cleanup());

  it("opens with one row per person counted, and Escape returns focus to the figure", () => {
    render(
      <CountBreakdown value={3} noun="open ED movements" countedAt={14 * 60 + 32} rows={() => rows} testId="fig">
        3 open ED movements
      </CountBreakdown>,
    );
    const button = screen.getByRole("button", { name: "3 open ED movements" });
    // Named by its own visible words, so a voice user can say what they see (WCAG 2.5.3).
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    act(() => {
      fireEvent.click(button);
    });
    expect(screen.getByText("3 open ED movements. Counted 14:32.")).toBeInTheDocument();
    expect(screen.getAllByTestId("count-breakdown-row")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /SYNTHETIC, Alex/ })).toHaveAttribute("href", "/ward-flow/movements/m-1");
    const dialog = screen.getByRole("dialog");
    act(() => {
      fireEvent.keyDown(dialog, { key: "Escape" });
    });
    expect(screen.queryByTestId("count-breakdown-panel")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("shows no list when the rows do not add up to the figure", () => {
    render(
      <CountBreakdown value={4} noun="open ED movements" countedAt={0} rows={() => rows}>
        open ED movements
      </CountBreakdown>,
    );
    act(() => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(screen.queryAllByTestId("count-breakdown-row")).toHaveLength(0);
    expect(screen.getByTestId("count-breakdown-mismatch")).toBeInTheDocument();
  });

  it("keeps names back under the small number line in an aggregate view", () => {
    render(
      <CountBreakdown value={3} noun="waiting" scope="aggregate" countedAt={0} rows={() => rows}>
        waiting
      </CountBreakdown>,
    );
    act(() => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(screen.queryAllByTestId("count-breakdown-row")).toHaveLength(0);
    expect(screen.getByTestId("count-breakdown-withheld")).toHaveTextContent(/Names are not listed in this view/);
  });

  describe("on a phone (bottom sheet)", () => {
    afterEach(() => vi.restoreAllMocks());

    function renderOnPhone() {
      vi.spyOn(window, "matchMedia").mockImplementation(
        (query) =>
          ({
            matches: query === WF_PHONE_QUERY,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as unknown as MediaQueryList,
      );
      render(
        <CountBreakdown value={3} noun="open ED movements" countedAt={0} rows={() => rows}>
          3 open ED movements
        </CountBreakdown>,
      );
      const button = screen.getByRole("button", { name: "3 open ED movements" });
      act(() => {
        fireEvent.click(button);
      });
      const sheet = screen.getByTestId("count-breakdown-sheet");
      expect(within(sheet).getAllByTestId("count-breakdown-row")).toHaveLength(3);
      return { button, sheet };
    }

    it("returns focus to the figure after Escape", async () => {
      const { button, sheet } = renderOnPhone();
      act(() => {
        fireEvent.keyDown(sheet, { key: "Escape" });
      });
      expect(screen.queryByTestId("count-breakdown-sheet")).not.toBeInTheDocument();
      await waitFor(() => expect(button).toHaveFocus());
    });

    it("returns focus to the figure after the close button", async () => {
      const { button, sheet } = renderOnPhone();
      act(() => {
        fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
      });
      expect(screen.queryByTestId("count-breakdown-sheet")).not.toBeInTheDocument();
      await waitFor(() => expect(button).toHaveFocus());
    });
  });
});

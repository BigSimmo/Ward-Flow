import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import {
  BarList,
  DeltaTwin,
  PhoneHero,
  RowSpark,
  RowTrend,
  SinceYouLooked,
  ToastProvider,
  trendDelta,
  useIsTabletLandscape,
  useIsTabletPortrait,
  useMediaQuery,
  useOptionalToast,
  WF_TABLET_LANDSCAPE_QUERY,
  WF_TABLET_PORTRAIT_QUERY,
} from "@/components/wf";

/**
 * Design system v10 shared parts, pass 4 (10 Oct 2026): the parts page agents built locally and
 * asked to share. These pin what each one says and the rules a page relies on.
 */

describe("useOptionalToast", () => {
  it("is null without a provider and never throws", () => {
    const { result } = renderHook(() => useOptionalToast());
    expect(result.current).toBeNull();
  });

  it("pushes through the layout's provider, and keeps the same api across renders", () => {
    const { result, rerender } = renderHook(() => useOptionalToast(), { wrapper: ToastProvider });
    const first = result.current;
    expect(first).not.toBeNull();
    rerender();
    expect(result.current).toBe(first);
    act(() => {
      first?.push({ tone: "info", title: "Saved" });
    });
    expect(screen.getByTestId("toast")).toHaveTextContent("Saved");
  });
});

describe("useMediaQuery and the tablet hooks", () => {
  const listeners = new Map<string, () => void>();
  let matching = new Set<string>();
  afterEach(() => {
    vi.unstubAllGlobals();
    listeners.clear();
  });

  function stubMatchMedia() {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        get matches() {
          return matching.has(query);
        },
        media: query,
        addEventListener: (_: string, listener: () => void) => listeners.set(query, listener),
        removeEventListener: () => listeners.delete(query),
      })),
    );
  }

  it("reads the shell's tablet ranges and follows a change", () => {
    matching = new Set([WF_TABLET_PORTRAIT_QUERY]);
    stubMatchMedia();
    const { result } = renderHook(() => ({
      portrait: useIsTabletPortrait(),
      landscape: useIsTabletLandscape(),
      custom: useMediaQuery("(min-width: 1px)"),
    }));
    expect(result.current).toEqual({ portrait: true, landscape: false, custom: false });
    matching = new Set([WF_TABLET_LANDSCAPE_QUERY]);
    act(() => {
      for (const listener of listeners.values()) listener();
    });
    expect(result.current).toEqual({ portrait: false, landscape: true, custom: false });
  });

  it("uses the 769 to 1000px and 1001 to 1200px ranges", () => {
    expect(WF_TABLET_PORTRAIT_QUERY).toBe("(min-width: 48.0625rem) and (max-width: 62.5rem)");
    expect(WF_TABLET_LANDSCAPE_QUERY).toBe("(min-width: 62.5625rem) and (max-width: 75rem)");
  });
});

describe("BarList onPick", () => {
  const rows = [
    { id: "north", label: "North", value: 4, testId: "bar-north" },
    { id: "south", label: "South", value: 2, testId: "bar-south" },
  ];

  it("makes each row a named button that highlights it and dims the others by colour", () => {
    const onPick = vi.fn();
    const { rerender } = render(<BarList label="Highlight a service" rows={rows} onPick={onPick} picked={null} />);
    const group = screen.getByRole("group", { name: "Highlight a service" });
    const north = within(group).getByRole("button", { name: "North: 4" });
    expect(north).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(north);
    expect(onPick).toHaveBeenCalledWith("north");

    rerender(<BarList label="Highlight a service" rows={rows} onPick={onPick} picked="north" />);
    expect(screen.getByTestId("bar-north")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("bar-north")).not.toHaveAttribute("data-dim");
    expect(screen.getByTestId("bar-south")).toHaveAttribute("data-dim", "true");
    // Nothing is hidden: both rows stay.
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("stays a picture with a list when it has no onPick", () => {
    render(<BarList label="Waiting" rows={rows} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("North: 4", { exact: false })).toBeInTheDocument();
  });
});

describe("SinceYouLooked since", () => {
  it("draws a clock time mono and words as plain text", () => {
    const { container, rerender } = render(<SinceYouLooked since="07:12" items={[]} />);
    expect(container.querySelector("b")).toHaveTextContent("07:12");
    rerender(<SinceYouLooked since="the start of this shift" items={[]} />);
    expect(screen.getByRole("region", { name: "Since you looked at the start of this shift" })).toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText("Nothing has changed since the start of this shift.")).toBeInTheDocument();
  });
});

describe("PhoneHero", () => {
  it("shows an optional eyebrow and makes a figure with onPress a button", () => {
    const onPress = vi.fn();
    render(
      <PhoneHero
        eyebrow="Statewide · Day shift"
        title="Settings"
        figures={[
          { id: "rules", value: "Standard", label: "Rules" },
          { id: "unsaved", value: 2, label: "Unsaved", onPress, actionLabel: "Open Rules, 2 unsaved" },
        ]}
      />,
    );
    expect(screen.getByText("Statewide · Day shift")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Open Rules, 2 unsaved" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("gives a pressable figure a 44px touch target", () => {
    const css = readFileSync("src/components/wf/phone.module.css", "utf8");
    expect(css).toMatch(/\.heroFigureButton \{[^}]*min-height: var\(--wf-touch, 44px\)/);
  });
});

describe("RowSpark and DeltaTwin", () => {
  it("reads the series and its change", () => {
    render(<RowTrend values={[2, 3, 5]} name="Peel" testId="spark" />);
    expect(screen.getByTestId("spark")).toHaveAttribute("aria-label", "Peel, waiting over 12 hours: 2, 3, 5, up 3");
    expect(trendDelta([5, 3])).toBe("−2");
    expect(trendDelta([3, 3])).toBe("±0");
  });

  it("draws nothing for fewer than two points", () => {
    const { container } = render(<RowSpark values={[4]} name="Peel" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names then and now in the caller's words and says no change in words", () => {
    render(<DeltaTwin was={4} now={4} label="4 at the 08:30 bed meeting, 4 now" surface="hero" />);
    const twin = screen.getByRole("img", { name: "4 at the 08:30 bed meeting, 4 now" });
    expect(twin).toHaveTextContent("no change");
    expect(twin).toHaveAttribute("data-surface", "hero");
  });
});

describe("Prototype footer note", () => {
  it("wraps below the desktop width so no page scrolls sideways at 820px", () => {
    const css = readFileSync("src/components/ward-management/shell/ward-prototype-footer.module.css", "utf8");
    const tablet = css.slice(css.indexOf("@media (max-width: 75rem)"));
    expect(tablet).toMatch(/\.footer \{\s*flex-wrap: wrap;/);
    expect(tablet).toMatch(/\.footerNote \{[^}]*white-space: normal;/);
  });
});

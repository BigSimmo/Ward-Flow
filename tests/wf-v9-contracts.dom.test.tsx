/** @vitest-environment jsdom */

import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Tooltip } from "@/components/ui/tooltip";
import {
  CardFoot,
  CardHead,
  DataRow,
  Donut,
  FilterChip,
  LiveChip,
  Meter,
  Segmented,
  Sheet,
  StatusGlyph,
  Tabs,
  TierTile,
  type ChoiceItem,
} from "@/components/wf";
import { present } from "@/components/wf/cx";

/**
 * Design system v9, sections 8 to 10: the shared-part contracts. The v8 contracts carry over (v9
 * section 10); each case names the rule it pins. Ported from the 9 October v8 branch and adjusted to
 * the v9 values (T1 neutral, butt-capped donuts that draw nothing at 0%, hoverable tips).
 */

afterEach(() => {
  vi.useRealTimers();
});

const ITEMS: ChoiceItem<"a" | "b" | "c">[] = [
  { id: "a", label: "Home" },
  { id: "b", label: "Decisions" },
  { id: "c", label: "Stay" },
];

describe("v9 component contracts", () => {
  it("the pause control keeps one name and reports its state with aria-pressed", () => {
    const { rerender } = render(<LiveChip state="live" onTogglePause={() => undefined} />);
    const pause = screen.getByRole("button", { name: "Pause live updates" });
    expect(pause.getAttribute("aria-pressed")).toBe("false");

    rerender(<LiveChip state="paused" onTogglePause={() => undefined} />);
    expect(screen.getByRole("button", { name: "Pause live updates" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: /resume/i }), "the name swapped as well").toBeNull();
  });

  it("one item in every tab list holds the tab stop, even when no item matches the value", () => {
    const stale = "z" as "a";
    render(
      <>
        <Tabs items={ITEMS} value={stale} onChange={() => undefined} label="Page" />
        <Segmented items={ITEMS} value={stale} onChange={() => undefined} label="View" />
      </>,
    );
    for (const group of [screen.getByRole("tablist"), screen.getByRole("radiogroup")]) {
      const stops = [...group.querySelectorAll("button")].filter((b) => b.tabIndex === 0);
      expect(stops, `${group.getAttribute("role")} dropped out of the tab order`).toHaveLength(1);
      expect(stops[0]?.textContent).toContain("Home");
    }
  });

  it("the tab stop follows the selected item", () => {
    render(<Tabs items={ITEMS} value="c" onChange={() => undefined} label="Page" />);
    const stops = screen.getAllByRole("tab").filter((tab) => tab.tabIndex === 0);
    expect(stops.map((tab) => tab.textContent)).toEqual(["Stay"]);
  });

  it("tab and chip counts sit inside the control", () => {
    render(
      <>
        <Tabs items={[{ id: "a", label: "Waiting", count: 0 }]} value="a" onChange={() => undefined} label="Page" />
        <FilterChip pressed={false} onPressedChange={() => undefined} count={3}>
          Tier 1
        </FilterChip>
      </>,
    );
    expect(screen.getByRole("tab", { name: /Waiting/ }).textContent).toContain("0");
    expect(screen.getByRole("button", { name: /Tier 1/ }).textContent).toContain("3");
  });

  it("Escape closes a tooltip without closing the sheet around it", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Bed 04">
        <Tooltip content="No bed free on this ward">
          <button type="button">Allocate bed</button>
        </Tooltip>
      </Sheet>,
    );
    await user.hover(screen.getByRole("button", { name: "Allocate bed" }));
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(onClose, "Escape on the tip also closed the sheet").not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a tip stays for a 120ms grace so the pointer can move onto it, then closes", () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="No bed free on this ward">
        <button type="button">Allocate bed</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Allocate bed" });
    fireEvent.mouseEnter(trigger);
    expect(screen.getByTestId("tooltip")).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByTestId("tooltip"), "the tip closed before the pointer could reach it").not.toBeNull();

    fireEvent.mouseEnter(screen.getByTestId("tooltip"));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByTestId("tooltip"), "the tip closed under the pointer").not.toBeNull();

    fireEvent.mouseLeave(screen.getByTestId("tooltip"));
    act(() => {
      vi.advanceTimersByTime(130);
    });
    expect(screen.queryByTestId("tooltip")).toBeNull();
  });

  it("a tip dismissed with Escape stays hidden until the next hover", () => {
    render(
      <Tooltip content="No bed free on this ward">
        <button type="button">Allocate bed</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Allocate bed" });
    fireEvent.mouseEnter(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("tooltip")).toBeNull();

    fireEvent.mouseLeave(trigger);
    fireEvent.mouseEnter(trigger);
    expect(screen.queryByTestId("tooltip")).not.toBeNull();
  });

  it("a sheet removed while open returns focus to the control that opened it", async () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open bed 04
          </button>
          {open ? (
            <Sheet open onClose={() => setOpen(false)} title="Bed 04">
              <button type="button" onClick={() => setOpen(false)}>
                Done
              </button>
            </Sheet>
          ) : null}
        </>
      );
    }
    const user = userEvent.setup();
    render(<Host />);
    const opener = screen.getByRole("button", { name: "Open bed 04" });
    await user.click(opener);
    await user.click(await screen.findByRole("button", { name: "Done" }));
    expect(document.activeElement, "focus fell to the page body").toBe(opener);
  });

  it("a sheet with nothing focusable takes focus on the panel itself", async () => {
    render(
      <Sheet open onClose={() => undefined} ariaLabel="Referrals" headerHidden>
        <p>No focusable content</p>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Referrals" });
    expect(dialog.tabIndex).toBe(-1);
    await vi.waitFor(() => expect(document.activeElement).toBe(dialog));
  });

  it("a titled sheet with its header hidden skips the inert close button and focuses the panel", async () => {
    render(
      <Sheet open onClose={() => undefined} title="Referrals" headerHidden>
        <p>No focusable content</p>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Referrals" });
    await vi.waitFor(() => expect(document.activeElement).toBe(dialog));
  });

  it("a donut draws its arc with butt caps, and 0% draws no arc", () => {
    const { container, rerender } = render(<Donut value={0.5} label="North Metro occupancy" />);
    expect(container.querySelectorAll("circle")[1]?.getAttribute("stroke-linecap")).toBe("butt");

    rerender(<Donut value={0} label="North Metro occupancy" />);
    expect(container.querySelectorAll("circle"), "0% drew a dot").toHaveLength(1);
  });

  it("zero renders as 0, never blank", () => {
    render(
      <>
        <CardHead title="Referrals" aside={0} meta={0} />
        <CardFoot meta={0} />
      </>,
    );
    const head = screen.getByRole("heading", { name: "Referrals" }).closest("div")!.parentElement!;
    expect(head.textContent).toBe("Referrals00");
    expect(present(0)).toBe(true);
    for (const empty of [null, undefined, false, ""]) expect(present(empty)).toBe(false);
  });

  it("a meter reports a value inside its own range", () => {
    const { rerender } = render(<Meter value={120} max={100} label="Metro occupancy" />);
    expect(screen.getByRole("meter").getAttribute("aria-valuenow")).toBe("100");
    rerender(<Meter value={-3} max={100} label="Metro occupancy" />);
    expect(screen.getByRole("meter").getAttribute("aria-valuenow")).toBe("0");
  });

  it("tier reads as a T1 rank pill and keeps its spoken name", () => {
    const { container } = render(<TierTile tier={1} />);
    expect(screen.getByText("T1").getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("Tier 1")).toBeInTheDocument();
    expect(container.firstElementChild?.className).not.toMatch(/danger/i);
  });

  it("an act-now row takes its own class and keeps selection", () => {
    const { container } = render(
      <DataRow columns="1fr" actNow selected role="row">
        <span role="cell">Bed 04</span>
      </DataRow>,
    );
    const row = container.firstElementChild!;
    expect(row.className).toMatch(/actNow/);
    expect(row.className).toMatch(/selected/);
    expect(row.getAttribute("aria-selected")).toBe("true");
  });

  it("moving has its own shape: a capsule, not the at-risk circle", () => {
    const { container } = render(
      <>
        <StatusGlyph tone="info" />
        <StatusGlyph tone="warning" />
      </>,
    );
    const [info, warning] = [...container.querySelectorAll("svg")];
    expect(info?.querySelector("rect")).not.toBeNull();
    expect(warning?.querySelector("circle")).not.toBeNull();
  });
});

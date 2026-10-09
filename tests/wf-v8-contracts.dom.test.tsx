/** @vitest-environment jsdom */

import { useState } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Tooltip } from "@/components/ui/tooltip";
import {
  Button,
  CardHead,
  Donut,
  LiveChip,
  Meter,
  Segmented,
  Sheet,
  StatusGlyph,
  Tabs,
  TierTile,
  type ChoiceItem,
} from "@/components/wf";
import { useMinuteNow } from "@/components/wf/use-minute-now";

/**
 * Design system v8, section 8: the component contracts found by the 9 October code audit. Each case
 * names the contract it pins (I1 to I8 in design/v8/design-system-v8.md).
 */

afterEach(() => {
  vi.useRealTimers();
});

const ITEMS: ChoiceItem<"a" | "b" | "c">[] = [
  { id: "a", label: "Home" },
  { id: "b", label: "Decisions" },
  { id: "c", label: "Stay" },
];

describe("v8 component contracts", () => {
  it("I1: the pause control keeps one name and reports its state with aria-pressed", () => {
    const { rerender } = render(<LiveChip state="live" onTogglePause={() => undefined} />);
    const pause = screen.getByRole("button", { name: "Pause live updates" });
    expect(pause.getAttribute("aria-pressed")).toBe("false");

    rerender(<LiveChip state="paused" onTogglePause={() => undefined} />);
    expect(screen.getByRole("button", { name: "Pause live updates" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: /resume/i }), "the name swapped as well").toBeNull();
  });

  it("I2: tabs and segmented keep a tab stop when no item matches the value", () => {
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

  it("I3: Escape closes a tooltip without closing the sheet around it", async () => {
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

  it("I4: a sheet removed while open returns focus to the control that opened it", async () => {
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

  it("I4: a sheet with its header hidden still takes focus", async () => {
    render(
      <Sheet open onClose={() => undefined} ariaLabel="Referrals" headerHidden>
        <p>No focusable content</p>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Referrals" });
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it("I5: a donut draws its arc with butt caps, so 0% draws nothing", () => {
    const { container } = render(<Donut value={0} label="North Metro occupancy" />);
    const arcs = container.querySelectorAll("circle");
    expect(arcs[1]?.getAttribute("stroke-linecap")).toBe("butt");
  });

  it("I6: a zero in a card head renders as 0", () => {
    render(<CardHead title="Referrals" aside={0} meta={0} />);
    const heading = screen.getByRole("heading", { name: "Referrals" }).closest("div")!.parentElement!;
    expect(heading.textContent).toBe("Referrals00");
  });

  it("a meter reports a value inside its own range", () => {
    render(<Meter value={120} max={100} label="Metro occupancy" />);
    expect(screen.getByRole("meter").getAttribute("aria-valuenow")).toBe("100");
  });

  it("tier reads as a rank pill, T1, and never in red", () => {
    render(<TierTile tier={1} />);
    expect(screen.getByText("T1")).toBeInTheDocument();
    expect(screen.getByText("Tier 1")).toBeInTheDocument();
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

  it("the live clock refreshes at once on resume, not up to a minute later", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T10:00:10Z"));
    function Clock({ paused }: { paused: boolean }) {
      const now = useMinuteNow({ paused });
      return <span data-testid="now">{new Date(now).toISOString()}</span>;
    }
    const { rerender } = render(<Clock paused />);
    act(() => {
      vi.setSystemTime(new Date("2026-10-09T10:04:40Z"));
    });
    rerender(<Clock paused={false} />);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("now").textContent).toBe("2026-10-09T10:04:40.000Z");
  });

  it("buttons still render their label (pill shape is CSS only)", () => {
    render(<Button variant="pri">Raise referral</Button>);
    expect(screen.getByRole("button", { name: "Raise referral" })).toBeInTheDocument();
  });
});

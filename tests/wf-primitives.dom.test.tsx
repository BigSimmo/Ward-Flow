/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { createRef, useState } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoreHorizontal } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import {
  BarList,
  Button,
  Card,
  Checkbox,
  Donut,
  Drawer,
  Hero,
  LiveChip,
  Menu,
  type MenuItem,
  Segmented,
  Stepper,
  Switch,
  Tabs,
  Timer,
  clk,
  dur,
  durMinutes,
  type ChoiceItem,
} from "@/components/wf";

const MIN = 60_000;

describe("v6 time formats", () => {
  it("formats durations with units and no colon", () => {
    expect(dur(43_000)).toBe("43s");
    expect(dur(5 * MIN + 3_000)).toBe("5m 03s");
    expect(dur(52 * MIN)).toBe("52m");
    expect(dur(7 * 60 * MIN)).toBe("7h 00m");
    expect(dur(26 * 60 * MIN)).toBe("1d 2h");
    expect(dur(-18 * MIN)).toBe("18m");
    expect(durMinutes(257)).toBe("4h 17m");
  });

  it("formats clock time as 24 hour HH:MM", () => {
    expect(clk(new Date(2026, 9, 7, 9, 5))).toBe("09:05");
    expect(clk(new Date(2026, 9, 7, 22, 42).getTime())).toBe("22:42");
  });
});

describe("Button", () => {
  it("keeps a disabled reason reachable: aria-disabled, described by the visible reason, click ignored", async () => {
    const onClick = vi.fn();
    render(
      <Button variant="sec" disabledReason="Needs an accepted bed" onClick={onClick}>
        Book transport
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Book transport" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
    expect(button).toHaveAccessibleDescription("Needs an accepted bed");
    expect(screen.getByText("Needs an accepted bed")).toBeVisible();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("marks loading with aria-busy and names icon-only buttons", () => {
    render(
      <>
        <Button variant="pri" loading>
          Accept
        </Button>
        <Button iconOnly icon={MoreHorizontal} aria-label="More actions" onClick={() => {}} />
      </>,
    );
    expect(screen.getByRole("button", { name: "Accept" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "More actions" })).toBeInTheDocument();
  });
});

describe("Tabs", () => {
  function Harness() {
    const items: ChoiceItem<"now" | "history" | "documents">[] = [
      { id: "now", label: "Now", count: 3 },
      { id: "history", label: "History" },
      { id: "documents", label: "Documents" },
    ];
    const [value, setValue] = useState<"now" | "history" | "documents">("now");
    return <Tabs items={items} value={value} onChange={setValue} label="Patient views" />;
  }

  it("moves selection and focus with arrow keys, Home and End, using a roving tabindex", async () => {
    render(<Harness />);
    const now = screen.getByRole("tab", { name: /Now/ });
    expect(screen.getByRole("tablist", { name: "Patient views" })).toBeInTheDocument();
    expect(now).toHaveAttribute("aria-selected", "true");
    expect(now).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("tabindex", "-1");

    now.focus();
    await userEvent.keyboard("{ArrowRight}");
    const history = screen.getByRole("tab", { name: "History" });
    expect(history).toHaveAttribute("aria-selected", "true");
    expect(history).toHaveFocus();

    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Documents" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Now/ })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Documents" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("Segmented", () => {
  it("is a radiogroup with aria-checked and arrow-key selection", async () => {
    function Harness() {
      const [value, setValue] = useState("clinical");
      return (
        <Segmented
          label="Escort"
          value={value}
          onChange={setValue}
          items={[
            { id: "clinical", label: "Clinical" },
            { id: "ward", label: "Ward" },
            { id: "none", label: "None" },
          ]}
        />
      );
    }
    render(<Harness />);
    const clinical = screen.getByRole("radio", { name: "Clinical" });
    expect(screen.getByRole("radiogroup", { name: "Escort" })).toBeInTheDocument();
    expect(clinical).toHaveAttribute("aria-checked", "true");
    clinical.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Ward" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Ward" })).toHaveFocus();
  });
});

describe("Switch", () => {
  it("uses role switch with aria-checked and a visible On or Off word", async () => {
    function Harness() {
      const [on, setOn] = useState(false);
      return <Switch checked={on} onCheckedChange={setOn} label="Alert me when a bed opens" />;
    }
    render(<Harness />);
    const control = screen.getByRole("switch", { name: "Alert me when a bed opens" });
    expect(control).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Off")).toBeInTheDocument();
    await userEvent.click(control);
    expect(control).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("On")).toBeInTheDocument();
  });
});

describe("Stepper", () => {
  it("exposes a spinbutton with min, max, now and valuetext, and named buttons", async () => {
    function Harness() {
      const [value, setValue] = useState(2);
      return <Stepper value={value} onChange={setValue} min={0} max={4} noun="escorts" />;
    }
    render(<Harness />);
    const spin = screen.getByRole("spinbutton", { name: "Escorts" });
    expect(spin).toHaveAttribute("aria-valuenow", "2");
    expect(spin).toHaveAttribute("aria-valuemax", "4");
    expect(spin).toHaveAttribute("aria-valuetext", "2 escorts");
    await userEvent.click(screen.getByRole("button", { name: "Increase escorts" }));
    expect(spin).toHaveAttribute("aria-valuenow", "3");
    spin.focus();
    await userEvent.keyboard("{End}");
    expect(spin).toHaveAttribute("aria-valuenow", "4");
    expect(screen.getByRole("button", { name: "Increase escorts" })).toHaveAttribute("aria-disabled", "true");
  });
});

describe("Timer", () => {
  it("uses role timer with no aria-live, a direction word, and a threshold word while the value stays plain", () => {
    const now = new Date(2026, 9, 7, 10, 42).getTime();
    render(
      <>
        <Timer at={now - (118 * MIN + 30_000)} now={now} direction="waiting" />
        <Timer
          at={now - 5 * 60 * MIN}
          now={now}
          direction="waiting"
          thresholds={{ dueSoon: 2 * 60 * MIN, overdue: 4 * 60 * MIN }}
        />
        <Timer at={now + 257 * MIN} now={now} direction="in" />
      </>,
    );
    const timers = screen.getAllByRole("timer");
    expect(timers).toHaveLength(3);
    for (const timer of timers) expect(timer).not.toHaveAttribute("aria-live");
    expect(timers[0]).toHaveTextContent("1h 58mwaiting");
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(timers[1]).toHaveTextContent("5h 00m");
    expect(timers[2]).toHaveTextContent("in4h 17m");
  });

  it("shows seconds only under 10 minutes", () => {
    const now = Date.now();
    render(<Timer at={now - (4 * MIN + 29_000)} now={now} direction="left" />);
    expect(screen.getByRole("timer")).toHaveTextContent("4m 29s");
  });
});

describe("LiveChip", () => {
  it("announces state, not the ticking age, and offers a named pause control", async () => {
    const onTogglePause = vi.fn();
    const { rerender } = render(<LiveChip state="live" age="1s" onTogglePause={onTogglePause} />);
    expect(screen.getByRole("status")).toHaveTextContent(/^Live$/);
    await userEvent.click(screen.getByRole("button", { name: "Pause live updates" }));
    expect(onTogglePause).toHaveBeenCalledOnce();
    rerender(<LiveChip state="paused" onTogglePause={onTogglePause} />);
    expect(screen.getByRole("button", { name: "Pause live updates" })).toHaveAttribute("aria-pressed", "true");
    rerender(<LiveChip state="stale" asAt={new Date(2026, 9, 7, 10, 26)} />);
    expect(screen.getByRole("status")).toHaveTextContent("Stale, as at 10:26");
  });
});

describe("Donut", () => {
  it("draws no arc at 0% and a closed ring only at 100%", () => {
    const arcs = (value: number) => {
      const { container, unmount } = render(<Donut value={value} label="Occupancy" />);
      const circles = Array.from(container.querySelectorAll("circle"));
      unmount();
      return circles;
    };
    expect(arcs(0)).toHaveLength(1);
    expect(arcs(Number.NaN)).toHaveLength(1);
    // v9: butt caps throughout, so the arc ends exactly at its value and 97% still shows a gap.
    const dash = (circle: Element) => (circle.getAttribute("stroke-dasharray") ?? "").split(" ").map(Number);
    const nearlyFull = arcs(0.97)[1];
    expect(nearlyFull.getAttribute("stroke-linecap")).toBe("butt");
    const [nearlyDash, nearlyGap] = dash(nearlyFull);
    expect(nearlyDash).toBeLessThan(nearlyGap);
    const full = arcs(1)[1];
    expect(full.getAttribute("stroke-linecap")).toBe("butt");
    const [fullDash, fullGap] = dash(full);
    expect(fullDash).toBeCloseTo(fullGap);
  });
});

describe("Menu", () => {
  it("opens from the trigger with ArrowDown, moves with arrows, and Escape returns focus", async () => {
    const onSelect = vi.fn();
    render(
      <Menu
        label="Referral options"
        items={[
          { id: "ed", label: "From an ED", onSelect },
          { id: "community", label: "From community", onSelect },
        ]}
        trigger={(props) => (
          <button {...props} type="button">
            Options
          </button>
        )}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Options" });
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menu", { name: "Referral options" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "From an ED" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "From community" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await act(async () => {});
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("Checkbox", () => {
  it("forwards its ref and still sets the mixed state", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Checkbox ref={ref} label="Select all" indeterminate />);
    const box = screen.getByRole("checkbox", { name: "Select all" });
    expect(ref.current).toBe(box);
    expect((box as HTMLInputElement).indeterminate).toBe(true);
  });
});

describe("Refs", () => {
  it("forwards a ref to the real button and to the card element, whatever `as` is", () => {
    const buttonRef = createRef<HTMLButtonElement>();
    const cardRef = createRef<HTMLElement>();
    render(
      <Card as="article" ref={cardRef} aria-label="Bed map">
        <Button ref={buttonRef}>Accept</Button>
      </Card>,
    );
    expect(buttonRef.current).toBe(screen.getByRole("button", { name: "Accept" }));
    expect(cardRef.current).toBe(screen.getByRole("article", { name: "Bed map" }));
  });
});

describe("Hero", () => {
  it("passes a test id onto the hero section itself", () => {
    render(<Hero title="26 beds ready" testId="ward-capacity-hero" level={1} />);
    const hero = screen.getByTestId("ward-capacity-hero");
    expect(hero.tagName).toBe("SECTION");
    expect(hero).toHaveAccessibleName("26 beds ready");
  });
});

describe("Menu checkable items", () => {
  function Harness() {
    const [shown, setShown] = useState<string[]>(["ready"]);
    const [sort, setSort] = useState<"waiting" | "tier">("waiting");
    const toggle = (id: string) =>
      setShown((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
    const items: MenuItem[] = [
      { kind: "heading", id: "h-show", label: "Show" },
      { id: "ready", label: "Ready beds", checked: shown.includes("ready"), onSelect: () => toggle("ready") },
      { id: "held", label: "Held beds", checked: shown.includes("held"), onSelect: () => toggle("held") },
      { kind: "separator", id: "sep" },
      {
        id: "waiting",
        label: "Sort by waiting",
        checkable: "radio",
        checked: sort === "waiting",
        onSelect: () => setSort("waiting"),
      },
      {
        id: "tier",
        label: "Sort by tier",
        checkable: "radio",
        checked: sort === "tier",
        onSelect: () => setSort("tier"),
      },
    ];
    return (
      <Menu
        label="View options"
        items={items}
        trigger={(props) => (
          <button {...props} type="button">
            View
          </button>
        )}
      />
    );
  }

  it("exposes menuitemcheckbox and menuitemradio with aria-checked; checkboxes stay open, radios close", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "View" }));
    const ready = screen.getByRole("menuitemcheckbox", { name: "Ready beds" });
    const held = screen.getByRole("menuitemcheckbox", { name: "Held beds" });
    expect(ready).toHaveAttribute("aria-checked", "true");
    expect(held).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("menuitemradio", { name: "Sort by waiting" })).toHaveAttribute("aria-checked", "true");

    await userEvent.click(held);
    expect(screen.getByRole("menu", { name: "View options" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemcheckbox", { name: "Held beds" })).toHaveAttribute("aria-checked", "true");

    await userEvent.click(screen.getByRole("menuitemradio", { name: "Sort by tier" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View" }));
    expect(screen.getByRole("menuitemradio", { name: "Sort by tier" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "Sort by waiting" })).toHaveAttribute("aria-checked", "false");
  });

  it("keeps plain items as menuitem with no aria-checked", async () => {
    render(
      <Menu
        label="Card actions"
        items={[{ id: "open", label: "Open ward", onSelect: () => {} }]}
        trigger={(props) => (
          <button {...props} type="button">
            Actions
          </button>
        )}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("menuitem", { name: "Open ward" })).not.toHaveAttribute("aria-checked");
  });
});

describe("Drawer", () => {
  it("keeps Tab inside the shared sheet in both directions, and Escape closes it", async () => {
    // jsdom has no layout; the shared trap only cycles through controls that have client rects.
    const rects = vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
      length: 1,
      item: () => null,
      [Symbol.iterator]: function* () {
        yield {} as DOMRect;
      },
    } as DOMRectList);
    const onClose = vi.fn();
    try {
      render(
        <>
          <button type="button">Outside</button>
          <Drawer open onClose={onClose} title="Tasks" portal>
            <button type="button">First task</button>
            <button type="button">Last task</button>
          </Drawer>
        </>,
      );
      const dialog = screen.getByRole("dialog", { name: "Tasks" });
      await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

      const last = screen.getByRole("button", { name: "Last task" });
      last.focus();
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
      });
      // Tab from the last control wraps to the first one inside, never out to the page.
      const wrapped = document.activeElement as HTMLElement;
      expect(dialog.contains(wrapped)).toBe(true);
      expect(wrapped).not.toBe(last);

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }),
        );
      });
      expect(document.activeElement).toBe(last);

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      });
      expect(onClose).toHaveBeenCalledOnce();
    } finally {
      rects.mockRestore();
    }
  });
});

describe("BarList", () => {
  it("ends an auto-scaled axis at or past the largest value, so 7 and 6 are not drawn level", () => {
    const { container } = render(
      <BarList
        label="Declines by reason"
        axis
        rows={[
          { id: "a", label: "No bed", value: 7 },
          { id: "b", label: "Acuity", value: 6 },
          { id: "c", label: "Gender", value: 0 },
        ]}
      />,
    );
    const widths = Array.from(container.querySelectorAll<HTMLElement>("[style*='width']")).map(
      (node) => node.style.width,
    );
    expect(widths).toEqual(["87.5%", "75%"]);
    expect(screen.getByText("none")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("draws at most four gridlines, zero being the bars' own baseline", () => {
    const { container } = render(<BarList label="Waiting" axis rows={[{ id: "a", label: "Ward 1", value: 8 }]} />);
    const lefts = Array.from(container.querySelectorAll<HTMLElement>("[style*='left']")).map((node) => node.style.left);
    // Five tick labels (0 to 8) plus four gridlines (2 to 8); only the zero label sits at 0%.
    expect(lefts).toHaveLength(9);
    expect(lefts.filter((left) => left === "0%")).toHaveLength(1);
  });
});

describe("Kit CSS", () => {
  const css = (name: string) => readFileSync(`src/components/wf/${name}`, "utf8");
  const block = (source: string, selector: string) => {
    const start = source.indexOf(`${selector} {`);
    expect(start, `${selector} block`).toBeGreaterThanOrEqual(0);
    return source.slice(start, source.indexOf("}", start));
  };
  const phone = (source: string) => source.slice(source.indexOf("@media (max-width: 48rem)"));

  it("anchors the Timer's absolutely positioned screen-reader words on its root", () => {
    expect(block(css("live.module.css"), ".timer")).toMatch(/position:\s*relative/);
  });

  it("lifts buttons, segmented options and hero track items to the 48px tap floor on a phone", () => {
    const button = css("button.module.css");
    const choice = css("choice.module.css");
    expect(button).toContain("@media (max-width: 48rem)");
    expect(choice).toContain("@media (max-width: 48rem)");
    expect(block(phone(button), ".b")).toContain("min-height: var(--spacing-tap, 3rem)");
    expect(phone(choice)).toMatch(/\.segItem,\s*\.trk \.segItem \{\s*min-height: var\(--spacing-tap, 3rem\)/);
  });

  it("gives segmented options a visible focus ring from the focus token", () => {
    expect(block(css("choice.module.css"), ".segItem:focus-visible")).toContain("var(--wf-focus-ring)");
  });
});

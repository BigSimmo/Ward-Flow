/** @vitest-environment jsdom */

import { createRef, useState } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoreHorizontal } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import {
  Button,
  Checkbox,
  LiveChip,
  Menu,
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
    rerender(<LiveChip state="stale" asAt={new Date(2026, 9, 7, 10, 26)} />);
    expect(screen.getByRole("status")).toHaveTextContent("Stale, as at 10:26");
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

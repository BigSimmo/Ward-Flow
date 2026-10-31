/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  SearchField,
  ShowMoreRow,
  TimePresets,
  phoneRows,
  timePresetClockText,
  type SearchFieldProps,
} from "@/components/wf";

describe("kit standard parts (lane C, from the #1118 mock-ups)", () => {
  it("ShowMoreRow keeps the caller's words and reports the list's open state", () => {
    const onClick = vi.fn();
    render(
      <ShowMoreRow onClick={onClick} expanded={false} controls="list-1">
        Show 6 more
      </ShowMoreRow>,
    );
    const row = screen.getByRole("button", { name: "Show 6 more" });
    expect(row).toHaveAttribute("type", "button");
    expect(row).toHaveAttribute("aria-expanded", "false");
    expect(row).toHaveAttribute("aria-controls", "list-1");
    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("SearchField counts, clears and hands focus back to the box", () => {
    function Harness() {
      const [query, setQuery] = useState("");
      // A page passes the kit's own prop type through, as a wrapper would.
      const props: SearchFieldProps = {
        id: "find-ward",
        label: "Find a ward",
        placeholder: "Ward or hospital",
        value: query,
        onValueChange: setQuery,
        count: { shown: query ? 3 : 40, total: 40, noun: "wards" },
        shortcut: true,
      };
      return <SearchField {...props} />;
    }
    render(<Harness />);
    const box = screen.getByRole("searchbox", { name: "Find a ward" });
    expect(screen.getByText("40 wards")).toBeInTheDocument();
    expect(box).toHaveAttribute("aria-describedby", "find-ward-count");
    // Nothing typed: the "/" hint shows and there is no Clear.
    expect(screen.getByText("/")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();

    fireEvent.change(box, { target: { value: "Ward 5" } });
    expect(screen.getByText("3 of 40 wards")).toBeInTheDocument();
    expect(screen.queryByText("/")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(box).toHaveValue("");
    expect(box).toHaveFocus();
  });

  it("TimePresets fills HH:MM from the board minute and wraps past midnight", () => {
    const onPick = vi.fn();
    render(<TimePresets label="Expected arrival" boardMinuteOfDay={23 * 60 + 50} onPick={onPick} />);
    const group = screen.getByRole("group", { name: "Expected arrival: quick times" });
    const buttons = Array.from(group.querySelectorAll("button"));
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Now, sets 23:50",
      "+15m, sets 00:05",
      "+30m, sets 00:20",
      "+1h, sets 00:50",
    ]);
    fireEvent.click(buttons[1]!);
    expect(onPick).toHaveBeenCalledWith("00:05");
    expect(timePresetClockText(-10)).toBe("23:50");
  });

  it("TimePresets offers Now only on a legal-form time, and never an expiry or countdown", () => {
    render(<TimePresets label="Form 1A written" boardMinuteOfDay={10 * 60 + 42} onPick={() => undefined} legal />);
    const group = screen.getByRole("group", { name: "Form 1A written: quick times" });
    expect(group.querySelectorAll("button")).toHaveLength(1);
    expect(group).toHaveTextContent("Now, sets 10:42");
    expect(group.textContent).not.toMatch(/expir|remaining|left|due|\+/i);
  });

  it("phoneRows exposes every class name", () => {
    for (const name of ["chipRow", "chip", "zero", "heroPills", "heroPill"] as const) {
      expect(typeof phoneRows[name]).toBe("string");
    }
  });
});

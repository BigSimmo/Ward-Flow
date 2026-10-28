/** @vitest-environment jsdom */
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RadioGroup } from "@/components/wf/radio-group";

function Choices({
  initial,
  onChange = () => {},
  disabled = [],
}: {
  initial?: string;
  onChange?: (id: string) => void;
  disabled?: string[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <RadioGroup aria-label="Choice">
      {["One", "Two", "Three"].map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          disabled={disabled.includes(id)}
          onClick={() => {
            setValue(id);
            onChange(id);
          }}
        >
          {id}
        </button>
      ))}
    </RadioGroup>
  );
}

describe("styled button radio groups", () => {
  it("gives an unanswered group one Tab stop without inventing an answer", () => {
    const onChange = vi.fn();
    render(<Choices onChange={onChange} />);
    const radios = screen.getAllByRole("radio");
    expect(radios.map((e) => e.tabIndex)).toEqual([0, -1, -1]);
    expect(radios.every((e) => e.getAttribute("aria-checked") === "false")).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("enters through the selected radio, then leaves the group on Tab", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Choices initial="Two" />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole("radio", { name: "Two" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("moves focus and selection with all four arrows, wrapping at either end", () => {
    const onChange = vi.fn();
    render(<Choices initial="One" onChange={onChange} />);
    const one = screen.getByRole("radio", { name: "One" });
    one.focus();
    fireEvent.keyDown(one, { key: "ArrowLeft" });
    const three = screen.getByRole("radio", { name: "Three" });
    expect(three).toHaveFocus();
    expect(three).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(three, { key: "ArrowRight" });
    expect(one).toHaveFocus();
    fireEvent.keyDown(one, { key: "ArrowDown" });
    const two = screen.getByRole("radio", { name: "Two" });
    expect(two).toHaveFocus();
    fireEvent.keyDown(two, { key: "ArrowUp" });
    expect(one).toHaveFocus();
    expect(onChange.mock.calls.map(([id]) => id)).toEqual(["Three", "One", "Two", "One"]);
    expect(screen.getAllByRole("radio").map((e) => e.tabIndex)).toEqual([0, -1, -1]);
  });

  it("skips native and ARIA-disabled radios for arrows and Home/End", () => {
    const pick = vi.fn();
    render(
      <RadioGroup aria-label="Availability">
        <button type="button" role="radio" aria-checked="false" disabled>
          Disabled first
        </button>
        <button type="button" role="radio" aria-checked="true" onClick={() => pick("First")}>
          First
        </button>
        <button type="button" role="radio" aria-checked="false" aria-disabled="true" onClick={pick}>
          Unavailable
        </button>
        <button type="button" role="radio" aria-checked="false" onClick={() => pick("Last")}>
          Last
        </button>
      </RadioGroup>,
    );
    const first = screen.getByRole("radio", { name: "First" });
    const last = screen.getByRole("radio", { name: "Last" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Home" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "End" });
    expect(last).toHaveFocus();
    expect(pick.mock.calls.map(([id]) => id)).toEqual(["Last", "First", "Last"]);
    expect(screen.getByRole("radio", { name: "Unavailable" })).toHaveAttribute("tabindex", "-1");
  });

  it("restores a first enabled entry when the selected choice disappears", () => {
    const view = render(
      <RadioGroup aria-label="Changing">
        <button type="button" role="radio" aria-checked="false">
          Remain
        </button>
        <button type="button" role="radio" aria-checked="true">
          Removed
        </button>
      </RadioGroup>,
    );
    expect(screen.getByRole("radio", { name: "Removed" })).toHaveAttribute("tabindex", "0");
    view.rerender(
      <RadioGroup aria-label="Changing">
        <button type="button" role="radio" aria-checked="false">
          Remain
        </button>
      </RadioGroup>,
    );
    expect(screen.getByRole("radio", { name: "Remain" })).toHaveAttribute("tabindex", "0");
  });

  it("does not activate a neighbouring group or a non-radio descendant", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <RadioGroup aria-label="Outer">
        <button type="button" role="radio" aria-checked="true" onClick={outer}>
          Outer choice
        </button>
        <RadioGroup aria-label="Inner">
          <button type="button" role="radio" aria-checked="true" onClick={inner}>
            Inner one
          </button>
          <button type="button" role="radio" aria-checked="false" onClick={inner}>
            Inner two
          </button>
        </RadioGroup>
        <button type="button">Help</button>
      </RadioGroup>,
    );
    fireEvent.keyDown(screen.getByRole("radio", { name: "Inner one" }), { key: "ArrowDown" });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: "Inner two" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("button", { name: "Help" }), { key: "Home" });
    expect(outer).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole("radiogroup", { name: "Inner" })).getByRole("radio", { name: "Inner one" }),
    ).toHaveAttribute("tabindex", "0");
  });

  it("preserves native Enter and Space activation and ignores modified arrow keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Choices onChange={onChange} />);
    const one = screen.getByRole("radio", { name: "One" });
    one.focus();
    fireEvent.keyDown(one, { key: "ArrowDown", ctrlKey: true });
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard("{Enter} ");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(one).toHaveAttribute("aria-checked", "true");
  });
  it("falls back from a disabled selected answer and safely handles all-disabled groups", () => {
    const view = render(<Choices initial="One" disabled={["One"]} />);
    expect(screen.getAllByRole("radio").map((e) => e.tabIndex)).toEqual([-1, 0, -1]);
    view.rerender(<Choices initial="One" disabled={["One", "Two", "Three"]} />);
    expect(screen.getAllByRole("radio").every((e) => e.tabIndex === -1)).toBe(true);
    expect(() => fireEvent.keyDown(screen.getByRole("radio", { name: "One" }), { key: "End" })).not.toThrow();
  });

  it("honours a caller's cancelled key event", () => {
    const click = vi.fn();
    render(
      <RadioGroup aria-label="Cancelled" onKeyDown={(e) => e.preventDefault()}>
        <button type="button" role="radio" aria-checked="true">
          First
        </button>
        <button type="button" role="radio" aria-checked="false" onClick={click}>
          Second
        </button>
      </RadioGroup>,
    );
    const first = screen.getByRole("radio", { name: "First" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(first).toHaveFocus();
    expect(click).not.toHaveBeenCalled();
  });
});

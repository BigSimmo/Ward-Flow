import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GLOSSARY } from "@/components/ward-management/help/ward-help-content";
import { typeAheadHelp, type HelpSuggestion } from "@/components/ward-management/help/ward-help-suggest";
import {
  GhostCompletion,
  HelpSuggestList,
  helpSuggestionId,
} from "@/components/ward-management/help/ward-help-suggest-list";

/** The suggestion rows and ghost completion (2 Nov 2026), drawn from `typeAheadHelp`'s answer. */

const pull = typeAheadHelp("how do i pu", "coordinator", GLOSSARY);

describe("HelpSuggestList", () => {
  afterEach(() => vi.restoreAllMocks());

  it("draws each suggestion as an option, the active one selected", () => {
    render(<HelpSuggestList suggestions={pull.suggestions} activeIndex={1} onPick={() => {}} idPrefix="help-s" />);
    const list = screen.getByRole("listbox", { name: "Suggestions" });
    expect(list.id).toBe("help-s-list");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(pull.suggestions.length);
    expect(options[0].id).toBe(helpSuggestionId("help-s", 0));
    expect(options[0].getAttribute("aria-selected")).toBe("false");
    expect(options[1].getAttribute("aria-selected")).toBe("true");
    expect(options[0].textContent).toContain("How do I pull the bed for a patient?");
    expect(options[0].textContent).toContain("How to");
  });

  it("bolds the matched parts of the text", () => {
    render(<HelpSuggestList suggestions={pull.suggestions} activeIndex={-1} onPick={() => {}} idPrefix="help-s" />);
    const first = screen.getAllByRole("option")[0];
    expect([...first.querySelectorAll("b")].map((bold) => bold.textContent)).toEqual(["How do I pu"]);
  });

  it("shows a quiet hint for each kind", () => {
    const rows: HelpSuggestion[] = [
      { key: "a", text: "Show me around Capacity", kind: "walk", matched: [] },
      { key: "b", text: "What does Held up mean?", kind: "word", matched: [] },
      { key: "c", text: "Capacity", kind: "screen", matched: [[0, 3]] },
    ];
    render(<HelpSuggestList suggestions={rows} activeIndex={0} onPick={() => {}} idPrefix="x" />);
    const options = screen.getAllByRole("option");
    expect(options[0].textContent).toContain("Show me");
    expect(options[1].textContent).toContain("Meaning");
    expect(options[2].textContent).toContain("Go to");
  });

  it("calls onPick with the row, and keeps focus in the field on press", () => {
    const onPick = vi.fn();
    render(<HelpSuggestList suggestions={pull.suggestions} activeIndex={0} onPick={onPick} idPrefix="p" />);
    const option = screen.getAllByRole("option")[2];
    const pressed = fireEvent.mouseDown(option);
    expect(pressed).toBe(false);
    fireEvent.click(option);
    expect(onPick).toHaveBeenCalledWith(pull.suggestions[2]);
  });

  it("draws nothing for no suggestions", () => {
    const { container } = render(<HelpSuggestList suggestions={[]} activeIndex={-1} onPick={() => {}} idPrefix="n" />);
    expect(container.innerHTML).toBe("");
  });

  it("writes nothing to browser storage", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(<HelpSuggestList suggestions={pull.suggestions} activeIndex={0} onPick={() => {}} idPrefix="s" />);
    typeAheadHelp("how do i book", "coordinator", GLOSSARY);
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe("GhostCompletion", () => {
  it("draws the rest after the typed letters, hidden from assistive technology", () => {
    render(<GhostCompletion typed="pul" completion="Pull the bed for a patient" />);
    const ghost = screen.getByTestId("help-ghost");
    expect(ghost.getAttribute("aria-hidden")).toBe("true");
    expect(ghost.textContent).toBe("pull the bed for a patient");
    expect(ghost.lastChild?.textContent).toBe("l the bed for a patient");
  });

  it("draws nothing when the completion does not continue the typed text", () => {
    const { container } = render(<GhostCompletion typed="dark" completion="Use dark mode" />);
    expect(container.innerHTML).toBe("");
    const none = render(<GhostCompletion typed="pul" completion={undefined} />);
    expect(none.container.innerHTML).toBe("");
  });
});

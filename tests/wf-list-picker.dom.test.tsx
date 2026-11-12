import { useState } from "react";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ListPicker, WF_PHONE_QUERY, type ListPickerOption, type ListPickerProps } from "@/components/wf";
import { OverlayRoot } from "@/components/wf/overlay-root";

// Synthetic sites only.
const SITES: ListPickerOption[] = [
  { value: "alpha", label: "Alpha Hospital ED", group: "North", hint: "AHX" },
  { value: "birch", label: "Birch Health Campus", group: "North" },
  { value: "cedar", label: "Cedar General", group: "South", hint: "Coastal" },
  { value: "delta", label: "Delta Clinic", group: "South" },
  { value: "elm", label: "Elm Street Hospital", group: "East" },
  { value: "fern", label: "Fern Valley ED", group: "East" },
  { value: "grove", label: "Grove Medical Centre", group: "North" },
  { value: "harbour", label: "Harbour Hospital", group: "South" },
  { value: "iris", label: "Iris Community Health", group: "East" },
];

const SHORT: ListPickerOption[] = [
  { value: "one", label: "Option one" },
  { value: "two", label: "Option two" },
  { value: "three", label: "Option three" },
];

function Harness({
  options = SITES,
  initial = null,
  required,
}: {
  options?: ListPickerProps["options"];
  initial?: string | null;
  required?: ListPickerProps["required"];
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <form aria-label="Test form">
      <ListPicker
        label="Emergency department"
        value={value}
        onChange={setValue}
        options={options}
        name="site"
        required={required}
        testId="site-picker"
      />
      <button type="button">After</button>
    </form>
  );
}

const field = () => screen.getByRole("combobox", { name: "Emergency department" });
const hidden = () => document.querySelector<HTMLInputElement>('input[type="hidden"][name="site"]');

describe("ListPicker", () => {
  it("shows the placeholder with nothing chosen and an empty hidden value", () => {
    render(<Harness />);
    expect(field()).toHaveTextContent("Choose");
    expect(field()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("site-picker")).toBe(field());
    expect(hidden()?.value).toBe("");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("opens a listbox with group headings and a search box for a long list", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(field());
    expect(field()).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("listbox");
    expect(field()).toHaveAttribute("aria-controls", list.id);
    const north = screen.getByRole("group", { name: "North" });
    expect(
      within(north)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Alpha Hospital EDAHX", "Birch Health Campus", "Grove Medical Centre"]);
    expect(screen.getByRole("group", { name: "South" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "East" })).toBeInTheDocument();
    const search = screen.getByRole("combobox", { name: "Search Emergency department" });
    expect(search).toHaveFocus();
    expect(search).toHaveAttribute("aria-controls", list.id);
  });

  it("filters by label and hint, ignoring case", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(field());
    const search = screen.getByRole("combobox", { name: "Search Emergency department" });
    await user.type(search, "hOsPiTaL");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Alpha Hospital EDAHX",
      "Harbour Hospital",
      "Elm Street Hospital",
    ]);
    // Headings keep their full-list order while filtering.
    expect(screen.getAllByRole("group").map((group) => group.firstChild?.textContent)).toEqual([
      "North",
      "South",
      "East",
    ]);
    await user.clear(search);
    await user.type(search, "coastal");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Cedar GeneralCoastal"]);
    await user.clear(search);
    await user.type(search, "zzz");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("moves with arrows, Home and End, and Enter chooses", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(field());
    const search = screen.getByRole("combobox", { name: "Search Emergency department" });
    const activeText = () => document.getElementById(search.getAttribute("aria-activedescendant") ?? "")?.textContent;
    expect(activeText()).toBe("Alpha Hospital EDAHX");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(activeText()).toBe("Grove Medical Centre");
    await user.keyboard("{End}");
    expect(activeText()).toBe("Iris Community Health");
    await user.keyboard("{Home}{ArrowDown}");
    expect(activeText()).toBe("Birch Health Campus");
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(field()).toHaveTextContent("Birch Health Campus");
    expect(field()).toHaveFocus();
    expect(hidden()?.value).toBe("birch");
  });

  it("keeps focus on the field for a short list and marks the chosen option", async () => {
    const user = userEvent.setup();
    render(<Harness options={SHORT} initial="two" />);
    expect(field()).toHaveTextContent("Option two");
    field().focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.queryByRole("combobox", { name: /Search/u })).toBeNull();
    expect(field()).toHaveFocus();
    const activeId = field().getAttribute("aria-activedescendant");
    expect(document.getElementById(activeId ?? "")).toHaveTextContent("Option two");
    expect(screen.getByRole("option", { name: "Option two" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Option one" })).toHaveAttribute("aria-selected", "false");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(field()).toHaveTextContent("Option three");
    expect(hidden()?.value).toBe("three");
  });

  it("closes on Escape and returns focus to the field", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(field());
    expect(screen.getByRole("combobox", { name: "Search Emergency department" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(field()).toHaveAttribute("aria-expanded", "false");
    expect(field()).toHaveFocus();
    expect(field()).toHaveTextContent("Choose");
  });

  it("closes on Tab from the search box and moves on from the field", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(field());
    expect(screen.getByRole("combobox", { name: "Search Emergency department" })).toHaveFocus();
    await user.tab();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("closes on a press outside", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(field());
    await user.click(screen.getByRole("button", { name: "After" }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("chooses by click and clears with the Clear row when not required", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(field());
    expect(screen.queryByRole("option", { name: "Clear" })).toBeNull();
    await user.click(screen.getByRole("option", { name: "Delta Clinic" }));
    expect(field()).toHaveTextContent("Delta Clinic");
    expect(hidden()?.value).toBe("delta");
    await user.click(field());
    await user.click(screen.getByRole("option", { name: "Clear" }));
    expect(field()).toHaveTextContent("Choose");
    expect(hidden()?.value).toBe("");
  });

  it("offers no Clear row when required", async () => {
    const user = userEvent.setup();
    render(<Harness initial="cedar" required />);
    expect(field()).toHaveAttribute("aria-required", "true");
    await user.click(field());
    expect(screen.queryByRole("option", { name: "Clear" })).toBeNull();
  });

  describe("on a phone", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("opens a sheet, chooses an option and closes", async () => {
      vi.stubGlobal(
        "matchMedia",
        (query: string) =>
          ({
            matches: query === WF_PHONE_QUERY,
            media: query,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
          }) as unknown as MediaQueryList,
      );
      const user = userEvent.setup();
      render(
        <>
          <OverlayRoot />
          <Harness />
        </>,
      );
      await user.click(field());
      const sheet = await screen.findByRole("dialog", { name: "Emergency department" });
      const search = within(sheet).getByRole("combobox", { name: "Search Emergency department" });
      await waitFor(() => expect(search).toHaveFocus());
      await user.type(search, "fern");
      await user.keyboard("{Enter}");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(field()).toHaveTextContent("Fern Valley ED");
      expect(hidden()?.value).toBe("fern");
    });
  });
});

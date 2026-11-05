import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardHelpChecklistView } from "@/components/ward-management/help/ward-help-checklist-view";
import { CHECKLIST_TICKS_STORAGE_KEY } from "@/components/ward-management/help/ward-help-checklists";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderView(id = "start-of-shift") {
  const onBack = vi.fn();
  const onClose = vi.fn();
  const onShowMe = vi.fn();
  const view = render(
    <WardHelpChecklistView
      id={id}
      role="coordinator"
      home="/ward-flow"
      onBack={onBack}
      onClose={onClose}
      onShowMe={onShowMe}
    />,
  );
  return { ...view, onBack, onClose, onShowMe };
}

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe("a guided checklist in Help", () => {
  it("shows the title, the reminder line and every step as a labelled tick box", () => {
    renderView();
    expect(screen.getByRole("heading", { name: "Start of shift" })).toBeInTheDocument();
    expect(screen.getByText("Reminders only. Ticking a step records nothing.")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    expect(
      screen.getByRole("checkbox", { name: "On Capacity, ask for an update when a ward's figure is old." }),
    ).not.toBeChecked();
    expect(screen.getByText("Each row opens the record it is about.")).toBeInTheDocument();
  });

  it("ticks and unticks, shows the count (not announced: each box says its state), and stores fixed ids only", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderView();
    const status = screen.getByTestId("ward-help-checklist-count");
    expect(status).not.toHaveAttribute("role");
    expect(status).not.toHaveAttribute("aria-live");
    expect(status).toHaveTextContent("0 of 5 ticked");
    fireEvent.click(screen.getByTestId("ward-help-checklist-tick-start-of-shift:0"));
    fireEvent.click(screen.getByTestId("ward-help-checklist-tick-start-of-shift:2"));
    expect(status).toHaveTextContent("2 of 5 ticked");
    expect(screen.getByTestId("ward-help-checklist-tick-start-of-shift:2")).toBeChecked();
    fireEvent.click(screen.getByTestId("ward-help-checklist-tick-start-of-shift:2"));
    expect(status).toHaveTextContent("1 of 5 ticked");
    const writes = setItem.mock.calls.filter(([key]) => key === CHECKLIST_TICKS_STORAGE_KEY);
    expect(writes.length).toBeGreaterThan(0);
    for (const [, value] of writes) expect(value).toMatch(/^([a-z-]+:\d+)(,[a-z-]+:\d+)*$|^$/);
    expect(window.sessionStorage.getItem(CHECKLIST_TICKS_STORAGE_KEY)).toBe("start-of-shift:0");
    expect(window.localStorage.getItem(CHECKLIST_TICKS_STORAGE_KEY)).toBeNull();
  });

  it("reads back known ticks only, and Clear ticks clears this checklist", () => {
    window.sessionStorage.setItem(CHECKLIST_TICKS_STORAGE_KEY, "start-of-shift:1,typed words,handover:0");
    renderView();
    expect(screen.getByTestId("ward-help-checklist-count")).toHaveTextContent("1 of 5 ticked");
    fireEvent.click(screen.getByTestId("ward-help-checklist-clear"));
    expect(screen.getByTestId("ward-help-checklist-count")).toHaveTextContent("0 of 5 ticked");
    expect(screen.getByTestId("ward-help-checklist-clear")).toBeDisabled();
    // Another checklist's tick is left alone.
    expect(window.sessionStorage.getItem(CHECKLIST_TICKS_STORAGE_KEY)).toBe("handover:0");
  });

  it("offers Show me and Go to where the step names them, and Back to Help", () => {
    const { onShowMe, onClose, onBack } = renderView();
    fireEvent.click(screen.getByTestId("ward-help-checklist-show-start-of-shift:2"));
    expect(onShowMe).toHaveBeenCalledWith("around-capacity");
    const go = screen.getByTestId("ward-help-checklist-go-start-of-shift:2");
    expect(go).toHaveAttribute("href", "/ward-flow/capacity");
    expect(go).toHaveTextContent("Go to Capacity");
    fireEvent.click(go);
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByTestId("ward-help-checklist-go-start-of-shift:0")).toHaveAttribute("href", "/ward-flow");
    expect(screen.queryByTestId("ward-help-checklist-show-start-of-shift:4")).toBeNull();
    expect(screen.queryByTestId("ward-help-checklist-go-start-of-shift:4")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back to Help" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("shows a desk's Getting started list with its first-week line and links (5 Nov 2026)", () => {
    const onShowMe = vi.fn();
    render(
      <WardHelpChecklistView
        id="getting-started-coordinator"
        role="coordinator"
        home="/ward-flow"
        onBack={vi.fn()}
        onClose={vi.fn()}
        onShowMe={onShowMe}
      />,
    );
    expect(screen.getByRole("heading", { name: "Getting started" })).toBeInTheDocument();
    expect(
      screen.getByText("For your first week. Reminders only. Ticking a step records nothing."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
    expect(screen.getByTestId("ward-help-checklist-go-getting-started-coordinator:3")).toHaveAttribute(
      "href",
      "/ward-flow/movements",
    );
    fireEvent.click(screen.getByTestId("ward-help-checklist-show-getting-started-coordinator:2"));
    expect(onShowMe).toHaveBeenCalledWith("around-capacity");
    fireEvent.click(screen.getByTestId("ward-help-checklist-tick-getting-started-coordinator:0"));
    expect(window.sessionStorage.getItem(CHECKLIST_TICKS_STORAGE_KEY)).toBe("getting-started-coordinator:0");
  });

  it("says so for a checklist that is not this desk's", () => {
    render(
      <WardHelpChecklistView
        id="bed-meeting"
        role="ward"
        home="/ward-flow"
        onBack={vi.fn()}
        onClose={vi.fn()}
        onShowMe={vi.fn()}
      />,
    );
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getByText("This checklist is not for this desk.")).toBeInTheDocument();
  });
});

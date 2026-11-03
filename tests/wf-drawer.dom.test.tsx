/** @vitest-environment jsdom */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { DrawerFacts, DrawerFootRow, PanelDrawer } from "@/components/wf";
import { OverlayRoot } from "@/components/wf/overlay-root";

/**
 * Plan item 2c (Josh, 3 Nov 2026): the kit drawer promoted from Home's Placement drawer. Close takes
 * focus on open, Escape and an outside click close it, focus goes back to the opener, the status tag
 * sits in the head, tabs sit inside, and the foot is pinned outside the one scroll area.
 */

function Harness({ withTabs = false }: { withTabs?: boolean }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"summary" | "history">("summary");
  return (
    <>
      <OverlayRoot />
      <button type="button" onClick={() => setOpen(true)}>
        Open drawer
      </button>
      <PanelDrawer
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Placement"
        title="CITIZEN, Alex"
        subtitle="UMRN 0000000"
        tag={<span data-testid="drawer-tag">T2</span>}
        closeLabel="Close the drawer"
        testId="kit-drawer"
        region={{ label: "Placement", testId: "kit-drawer-region", "data-subject": "m-1" }}
        tabs={
          withTabs
            ? [
                { id: "summary", label: "Summary" },
                { id: "history", label: "History", count: 3 },
              ]
            : undefined
        }
        tab={tab}
        onTabChange={setTab}
        foot={
          <DrawerFootRow>
            <button type="button">Decide</button>
          </DrawerFootRow>
        }
      >
        {tab === "summary" ? (
          <DrawerFacts
            items={[
              { label: "From", value: "Synthetic ED" },
              { label: "To", value: "No destination yet" },
            ]}
          />
        ) : (
          <p>Three synthetic events</p>
        )}
      </PanelDrawer>
    </>
  );
}

async function openDrawer() {
  const opener = screen.getByRole("button", { name: "Open drawer" });
  opener.focus();
  fireEvent.click(opener);
  const dialog = await screen.findByRole("dialog", { name: "CITIZEN, Alex" });
  return { opener, dialog };
}

describe("kit PanelDrawer", () => {
  it("names the dialog by its title, shows the status tag in the head and focuses Close", async () => {
    render(<Harness />);
    const { dialog } = await openDrawer();
    expect(dialog).toHaveAttribute("data-testid", "kit-drawer");
    expect(within(dialog).getByRole("heading", { level: 2 })).toHaveTextContent("Placement");
    const head = dialog.querySelector("[data-drawer-head]");
    expect(head).not.toBeNull();
    expect(within(head as HTMLElement).getByTestId("drawer-tag")).toHaveTextContent("T2");
    expect(within(head as HTMLElement).getByText("UMRN 0000000")).toBeInTheDocument();
    const region = screen.getByTestId("kit-drawer-region");
    expect(region.tagName).toBe("ASIDE");
    expect(region).toHaveAttribute("aria-label", "Placement");
    expect(region).toHaveAttribute("data-subject", "m-1");
    await waitFor(() => expect(screen.getByRole("button", { name: "Close the drawer" })).toHaveFocus());
  });

  it("renders the fact grid in the scroll area and pins the foot outside it", async () => {
    render(<Harness />);
    const { dialog } = await openDrawer();
    const scroll = dialog.querySelector("[data-drawer-scroll]") as HTMLElement;
    const foot = dialog.querySelector("[data-drawer-foot]") as HTMLElement;
    expect(scroll).not.toBeNull();
    expect(foot).not.toBeNull();
    expect(scroll.contains(foot)).toBe(false);
    expect(within(scroll).getByText("From").tagName).toBe("DT");
    expect(within(scroll).getByText("Synthetic ED").tagName).toBe("DD");
    expect(within(foot).getByRole("button", { name: "Decide" })).toBeInTheDocument();
    // Head, then scroll, then foot, in that order inside the frame.
    const frame = screen.getByTestId("kit-drawer-region");
    const order = Array.from(frame.children).map((child) =>
      child.hasAttribute("data-drawer-head")
        ? "head"
        : child.hasAttribute("data-drawer-scroll")
          ? "scroll"
          : child.hasAttribute("data-drawer-foot")
            ? "foot"
            : "other",
    );
    expect(order).toEqual(["head", "scroll", "foot"]);
  });

  it("closes on Escape and returns focus to the opener", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<Harness />);
      const { opener } = await openDrawer();
      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      await waitFor(() => expect(opener).toHaveFocus());
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes on a click outside the panel but not on a click inside it", async () => {
    render(<Harness />);
    const { dialog } = await openDrawer();
    fireEvent.pointerDown(dialog);
    fireEvent.click(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const backdrop = dialog.parentElement as HTMLElement;
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes from the Close button", async () => {
    render(<Harness />);
    await openDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Close the drawer" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows tabs inside the drawer and switches the body's panel", async () => {
    render(<Harness withTabs />);
    const { dialog } = await openDrawer();
    const tablist = within(dialog).getByRole("tablist", { name: "Sections" });
    const summary = within(tablist).getByRole("tab", { name: "Summary" });
    const history = within(tablist).getByRole("tab", { name: /History/ });
    expect(summary).toHaveAttribute("aria-selected", "true");
    const panel = within(dialog).getByRole("tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", summary.id);
    expect(within(panel).getByText("Synthetic ED")).toBeInTheDocument();
    // The tabs sit outside the scroll area, so they stay in view.
    const scroll = dialog.querySelector("[data-drawer-scroll]") as HTMLElement;
    expect(scroll.contains(tablist)).toBe(false);
    fireEvent.click(history);
    expect(history).toHaveAttribute("aria-selected", "true");
    const next = within(dialog).getByRole("tabpanel");
    expect(next).toHaveAttribute("aria-labelledby", history.id);
    expect(within(next).getByText("Three synthetic events")).toBeInTheDocument();
  });

  it("uses the title as the h2 when there is no eyebrow and renders no tabs or foot by default", () => {
    render(
      <>
        <OverlayRoot />
        <PanelDrawer open onClose={() => {}} title="Transport job">
          <p>Body</p>
        </PanelDrawer>
      </>,
    );
    const dialog = screen.getByRole("dialog", { name: "Transport job" });
    expect(within(dialog).getByRole("heading", { level: 2, name: "Transport job" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("tablist")).not.toBeInTheDocument();
    expect(dialog.querySelector("[data-drawer-foot]")).toBeNull();
  });
});

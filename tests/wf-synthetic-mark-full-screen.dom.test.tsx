// Shared design parts item 7 (Josh, 13 Nov 2026; F-39): every full-screen or enlarged view shows
// the synthetic-data mark in its top row, through one frame that always draws it.
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { FullScreenFrame, FullScreenMarkSlot } from "@/components/wf/full-screen-frame";
import { SyntheticMark } from "@/components/wf/synthetic-mark";

const FULL = "Synthetic data, not a medical record";

function marksIn(root: ParentNode) {
  return root.querySelectorAll("[data-wf-synthetic-mark]");
}

describe("SyntheticMark", () => {
  it("says Synthetic data, with the full words on hover and for screen readers", () => {
    const { container } = render(<SyntheticMark />);
    const mark = container.querySelector("[data-wf-synthetic-mark]");
    expect(mark).toHaveAttribute("title", FULL);
    expect(mark).toHaveTextContent("Synthetic data");
    expect(within(mark as HTMLElement).getByText(FULL)).toBeInTheDocument();
    expect(within(mark as HTMLElement).getByText("Synthetic data")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("FullScreenFrame", () => {
  it("draws nothing extra while the view is in the page", () => {
    const { container } = render(
      <FullScreenFrame enlarged={false}>
        <FullScreenMarkSlot />
      </FullScreenFrame>,
    );
    expect(marksIn(container)).toHaveLength(0);
  });

  it("puts the mark in the view's own slot when it has one, once", () => {
    const { container } = render(
      <FullScreenFrame enlarged>
        <div data-testid="row">
          <FullScreenMarkSlot />
        </div>
      </FullScreenFrame>,
    );
    expect(marksIn(container)).toHaveLength(1);
    expect(marksIn(screen.getByTestId("row"))).toHaveLength(1);
    expect(container.firstElementChild).toHaveAttribute("data-wf-full-screen", "true");
  });

  it("still draws the mark at the top when a view forgot the slot", () => {
    const { container } = render(
      <FullScreenFrame enlarged as="section" aria-label="Enlarged view">
        <p>Table</p>
      </FullScreenFrame>,
    );
    const frame = screen.getByRole("region", { name: "Enlarged view" });
    expect(frame.tagName).toBe("SECTION");
    expect(marksIn(container)).toHaveLength(1);
    expect(frame.firstElementChild).toHaveAttribute("data-wf-full-screen-mark");
  });
});

describe("enlarged views carry the mark", () => {
  it("the full-screen movement timeline", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MovementsScreen />
      </WardFlowProvider>,
    );
    const timelineSwitch = screen.getByRole("switch", { name: "Show timeline" });
    if (timelineSwitch.getAttribute("aria-checked") !== "true") fireEvent.click(timelineSwitch);
    const traffic = screen.getByRole("region", { name: "Today’s traffic" });
    const horizon = traffic.querySelector("[data-testid='ward-movement-horizon']") as HTMLElement;
    expect(marksIn(horizon)).toHaveLength(0);
    fireEvent.click(within(traffic).getByRole("button", { name: "Enlarge" }));
    const dialog = screen.getByRole("dialog", { name: "Full screen movement timeline" });
    expect(marksIn(dialog)).toHaveLength(1);
    expect(within(dialog).getByTitle(FULL)).toBeInTheDocument();
  });

  it("the enlarged ED handover table", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="rph-ed" />
      </WardFlowProvider>,
    );
    const board = screen.getByRole("region", { name: "This department's patients" });
    expect(marksIn(board)).toHaveLength(0);
    fireEvent.click(within(board).getByRole("button", { name: "Enlarge" }));
    expect(board).toHaveAttribute("data-enlarged", "true");
    expect(marksIn(board)).toHaveLength(1);
    expect(within(board).getByTitle(FULL)).toBeInTheDocument();
  });
});

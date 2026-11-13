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

  it("puts the timeline's mark on the title row up to 1100px, beside the head's controls", () => {
    // Design parts item 7 (approved 820 and 390 pictures): there the controls wrap under the title, so
    // the title row (on a phone, the Service row, by CSS) holds the mark, not the legend row.
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === "(max-width: 68.75rem)",
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <MovementsScreen />
        </WardFlowProvider>,
      );
      const timelineSwitch = screen.queryByRole("switch", { name: "Show timeline" });
      if (timelineSwitch && timelineSwitch.getAttribute("aria-checked") !== "true") fireEvent.click(timelineSwitch);
      fireEvent.click(screen.getAllByRole("button", { name: "Enlarge" })[0]);
      const dialog = screen.getByRole("dialog", { name: "Full screen movement timeline" });
      expect(marksIn(dialog)).toHaveLength(1);
      const heading = within(dialog).getByRole("heading", { name: /hour timeline$/u });
      const head = heading.parentElement?.parentElement as HTMLElement;
      expect(marksIn(head)).toHaveLength(1);
      expect(
        marksIn(within(dialog).getByRole("list", { name: "Movement horizon legend" }).parentElement!),
      ).toHaveLength(0);
    } finally {
      window.matchMedia = original;
    }
  });

  // The ED handover board waits for PR C (avoid list); this case returns when the mark is wired there.
  it.todo("the enlarged ED handover table");
});

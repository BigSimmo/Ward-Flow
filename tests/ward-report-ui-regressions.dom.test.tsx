// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HighlightStat } from "@/components/ward-management/movements/movements-stage-row";
import { StagePipeline } from "@/components/ward-management/movements/stage-pipeline";
import { useFitDockLabels } from "@/components/ward-management/shell/use-fit-dock-labels";
import type { JourneyStage } from "@/components/ward-management/movements/movements-derivations";

import { screenHelpFor } from "@/components/ward-management/help/ward-help-content";
import { SCREEN_TOURS } from "@/components/ward-management/help/ward-help-screen-tours";
import { tourSteps } from "@/components/ward-management/help/ward-tour-steps";
import { tourSteps as previewTourSteps } from "@/components/ward-redesign/pop-tour/tour-steps";

afterEach(() => vi.unstubAllGlobals());

it("names the current discharge controls in Help and both tour implementations", () => {
  expect(screenHelpFor("/ward-flow/board/synthetic-ward", [])?.actions.join(" ")).toContain("Record hold-up");
  expect(JSON.stringify(SCREEN_TOURS)).toContain("Held up by reason");
  expect(JSON.stringify(SCREEN_TOURS)).not.toMatch(/Held up by barrier|counted by barrier/u);
  for (const steps of [tourSteps("ward", "desk", {}), previewTourSteps("ward", "desk", {})]) {
    expect(JSON.stringify(steps)).toContain("Record hold-up");
    expect(JSON.stringify(steps)).not.toContain("record a blocker");
  }
});

describe("people-list triggers", () => {
  it("exposes the highlighted figure as a dialog trigger and preserves its visual marker", () => {
    const open = vi.fn();
    render(<HighlightStat label="Tier 1" value={2} pressed onToggle={open} />);
    const button = screen.getByRole("button", { name: /^Tier 1\s*2$/u });
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).not.toHaveAttribute("aria-pressed");
    expect(button).toHaveAttribute("data-highlighted", "true");
    expect(button).toHaveAccessibleDescription("Highlighted in worklist");
    fireEvent.click(button);
    expect(open).toHaveBeenCalledOnce();
  });

  it("exposes the selected stage as a dialog trigger", () => {
    const open = vi.fn();
    const stage = {
      id: "placement_requested",
      label: "Placement requested",
      blurb: "Waiting for placement",
      movements: [],
    } as JourneyStage;
    render(
      <StagePipeline
        stages={[stage]}
        now={10}
        accessTarget={100}
        highlight="stage:placement_requested"
        onToggle={open}
      />,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).not.toHaveAttribute("aria-pressed");
    expect(button).toHaveAttribute("data-highlighted", "true");
    expect(button).toHaveAccessibleDescription(/Highlighted in worklist/u);
    fireEvent.click(button);
    expect(open).toHaveBeenCalledWith("placement_requested");
  });
});

function Dock({ text = "Home", visible = true, count = 0 }: { text?: string; visible?: boolean; count?: number }) {
  const ref = useRef<HTMLElement>(null);
  useFitDockLabels(ref, ".dock-label");
  return visible ? (
    <nav ref={ref}>
      <span className="dock-label">{text}</span>
      <span>{count}</span>
    </nav>
  ) : null;
}

it("retains dock observers across count renders and refits changed labels and newly mounted docks", async () => {
  const observe = vi.fn();
  const disconnect = vi.fn();
  let resize: ResizeObserverCallback | undefined;
  const observer = vi.fn(function (callback: ResizeObserverCallback) {
    resize = callback;
    return { observe, disconnect };
  });
  vi.stubGlobal("ResizeObserver", observer);
  const { rerender, unmount } = render(<Dock visible={false} />);
  rerender(<Dock />);
  expect(observer).toHaveBeenCalledOnce();
  const label = document.querySelector<HTMLElement>(".dock-label")!;
  label.style.fontSize = "13px";
  rerender(<Dock count={1} />);
  await act(async () => {});
  expect(observer).toHaveBeenCalledOnce();
  expect(label.style.fontSize).toBe("13px");
  rerender(<Dock text="Referrals" count={1} />);
  await act(async () => {});
  expect(label.style.fontSize).toBe("");
  expect(observer).toHaveBeenCalledOnce();
  label.style.fontSize = "13px";
  act(() => resize!([], {} as ResizeObserver));
  expect(label.style.fontSize).toBe("");
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});

it("lets go of a dock child once it is replaced", async () => {
  const observe = vi.fn();
  const unobserve = vi.fn();
  const observer = vi.fn(function () {
    return { observe, unobserve, disconnect: vi.fn() };
  });
  vi.stubGlobal("ResizeObserver", observer);
  function Swap({ which }: { which: string }) {
    const ref = useRef<HTMLElement>(null);
    useFitDockLabels(ref, ".dock-label");
    return (
      <nav ref={ref}>
        <span key={which} className="dock-label">
          {which}
        </span>
      </nav>
    );
  }
  const { rerender, unmount } = render(<Swap which="Home" />);
  const first = document.querySelector(".dock-label")!;
  expect(observe).toHaveBeenCalledWith(first);
  rerender(<Swap which="Referrals" />);
  await act(async () => {});
  const second = document.querySelector(".dock-label")!;
  expect(second).not.toBe(first);
  expect(unobserve).toHaveBeenCalledWith(first);
  expect(observe).toHaveBeenCalledWith(second);
  unmount();
});

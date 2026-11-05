import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { HandoverPrintSheet, DEFAULT_PRINT_OPTIONS } from "@/components/ward-management/handover/handover-print-sheet";
import { HANDOVER_COLUMNS } from "@/components/ward-management/handover/handover-columns";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { perthMidnight } from "@/components/ward-management/ward-clock";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

afterEach(cleanup);

it("keeps the Standard legal/observation column in the print preview on a wide desktop", () => {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <HandoverPage />
    </WardFlowProvider>,
  );
  fireEvent.keyDown(window, { key: "p" });
  const sheet = screen.getByTestId("ward-handover-print-sheet");
  expect(within(sheet).getAllByRole("columnheader", { name: "Legal and obs" }).length).toBeGreaterThan(0);
});

it("allocates a positive percentage width to every Full paper column including From and to", () => {
  function Sheet() {
    const [options, setOptions] = useState(DEFAULT_PRINT_OPTIONS);
    return (
      <HandoverPrintSheet
        groups={[]}
        columns={HANDOVER_COLUMNS}
        ctx={{ now: NOW_ANCHOR, cutoff: NOW_ANCHOR, readyBeds: () => 0 }}
        wards={[]}
        held={[]}
        outsideAct={[]}
        isHighlighted={() => false}
        anyHighlight={false}
        scopeLabel="Whole network"
        shiftLabel="Day"
        densityLabel="Full"
        dayZero={perthMidnight(2026, 9, 23)}
        options={options}
        onOptionsChange={setOptions}
        controls={null}
        highlightControls={null}
        onOpenPatient={() => {}}
        onBack={() => {}}
        onPrintPrepared={() => {}}
        preparedAt={null}
        now={NOW_ANCHOR}
      />
    );
  }
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Sheet />
    </WardFlowProvider>,
  );
  const first = screen.getAllByRole("article")[0]!;
  const heads = within(first).getAllByRole("columnheader");
  const widths = heads.map((head) => Number.parseFloat(head.style.width));
  expect(widths.every((width) => width > 0)).toBe(true);
  expect(widths.reduce((sum, width) => sum + width, 0)).toBeCloseTo(100);
  expect(within(first).getByRole("columnheader", { name: "From and to" }).style.width).toMatch(/%$/);
});

// Consolidation (5 Nov 2026): only a measured layout that does not fit refuses printing. Before the
// layout is measured the sheet prints its estimated pages, as the Print button always has.
it("does not refuse native browser printing before layout measurements are available", () => {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <HandoverPage />
    </WardFlowProvider>,
  );
  fireEvent.keyDown(window, { key: "p" });
  fireEvent(window, new Event("beforeprint"));
  expect(screen.getByRole("button", { name: "Print or save PDF" })).toBeEnabled();
  expect(document.querySelector("[data-wf-print-stack]")).not.toHaveAttribute("data-print-overflow");
  expect(screen.queryAllByRole("alert").some((alert) => /does not fit the paper/.test(alert.textContent ?? ""))).toBe(
    false,
  );
});

// Print journey flake (5 Nov 2026): an overflow read from pages cut by the previous measurement
// latched the refusal. On paper the refusal hides the pages, so nothing could measure them again.
describe("measured overflow", () => {
  let overflowing = true;
  let frames: FrameRequestCallback[] = [];
  const restore: (() => void)[] = [];
  function stubGetter(name: "offsetHeight" | "scrollHeight" | "clientHeight", read: (node: HTMLElement) => number) {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name);
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      get(this: HTMLElement) {
        return read(this);
      },
    });
    restore.push(() => {
      if (original) Object.defineProperty(HTMLElement.prototype, name, original);
    });
  }
  function flushFrames() {
    for (let round = 0; round < 10 && frames.length > 0; round += 1) {
      const due = frames;
      frames = [];
      act(() => due.forEach((frame) => frame(0)));
    }
  }
  function openSheet() {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <HandoverPage />
      </WardFlowProvider>,
    );
    fireEvent.keyDown(window, { key: "p" });
  }
  beforeEach(() => {
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => frames.push(frame));
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    // On paper a refused layout hides its pages (`.stack[data-print-overflow] .frame`), so they measure 0.
    const shown = (node: HTMLElement) => node.closest("[data-print-overflow]") === null;
    stubGetter("offsetHeight", (node) => (!shown(node) ? 0 : node.tagName === "ARTICLE" ? 794 : 20));
    stubGetter("clientHeight", (node) => (node.tagName === "ARTICLE" ? 794 : 20));
    stubGetter("scrollHeight", (node) => (node.tagName === "ARTICLE" && overflowing ? 900 : 794));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    restore.splice(0).forEach((undo) => undo());
  });

  it("measures the re-cut pages before refusing a layout that fits once cut again", () => {
    overflowing = true;
    openSheet();
    act(() => frames.splice(0).forEach((frame) => frame(0)));
    overflowing = false;
    flushFrames();
    expect(document.querySelector("[data-wf-print-stack]")).not.toHaveAttribute("data-print-overflow");
  });

  it("still refuses a measured layout that does not fit", () => {
    overflowing = true;
    openSheet();
    flushFrames();
    expect(document.querySelector("[data-wf-print-stack]")).toHaveAttribute("data-print-overflow");
  });
});

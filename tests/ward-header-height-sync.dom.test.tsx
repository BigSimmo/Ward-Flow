// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WardBarFrame } from "../src/components/ward-management/shell/ward-chrome-frame";

// Q297 review (2 Nov 2026): when large text makes the phone header taller than its 56px, the rows
// pinned under it stick at `--wf-header-height`, so the variable follows the header's real height.
let resize: (() => void) | null = null;
class FakeResizeObserver {
  constructor(callback: () => void) {
    resize = callback;
  }
  observe() {}
  disconnect() {}
}

function mockPhone(matches: boolean) {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function renderBar() {
  const ref = createRef<HTMLElement>();
  const view = render(
    <div data-wf-scroller="" data-testid="scroller">
      <WardBarFrame ref={ref} aria-label="Header" />
    </div>,
  );
  return { ref, scroller: view.getByTestId("scroller"), header: view.getByRole("banner", { name: "Header" }) };
}

function setHeight(element: HTMLElement, height: number) {
  element.getBoundingClientRect = () => ({ height }) as DOMRect;
}

afterEach(() => {
  vi.unstubAllGlobals();
  resize = null;
});

describe("WardBarFrame keeps the pinned-row offset in step with the phone header", () => {
  it("sets --wf-header-height on the scroller while the header is taller than 56px, and clears it after", () => {
    mockPhone(true);
    const { ref, scroller, header } = renderBar();
    expect(ref.current).toBe(header);
    expect(scroller.style.getPropertyValue("--wf-header-height")).toBe("");

    setHeight(header, 88.4);
    act(() => resize?.());
    expect(scroller.style.getPropertyValue("--wf-header-height")).toBe("89px");

    setHeight(header, 56);
    act(() => resize?.());
    expect(scroller.style.getPropertyValue("--wf-header-height")).toBe("");
  });

  it("leaves the variable alone on a desktop", () => {
    mockPhone(false);
    const { scroller, header } = renderBar();
    setHeight(header, 120);
    act(() => resize?.());
    expect(scroller.style.getPropertyValue("--wf-header-height")).toBe("");
  });
});

it("keeps the phone bar's own height off --wf-header-height, so a taller bar can shrink back", () => {
  const css = readFileSync(
    path.join(process.cwd(), "src/components/ward-management/shell/ward-bar.module.css"),
    "utf8",
  );
  expect(css).toContain("height: calc-size(auto, max(size, 3.5rem));");
  expect(css).not.toMatch(/height:\s*calc-size\([^;]*--wf-header-height/);
});

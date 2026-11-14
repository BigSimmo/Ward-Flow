/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastView } from "@/components/wf/toast";

// R-STYLE-5 / R-FIGS-20: toast text wraps to two lines, and a longer message gets a Details button.
const css = readFileSync(join(process.cwd(), "src/components/wf/overlay.module.css"), "utf8");

function overflow(on: boolean) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(on ? 60 : 20);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(20);
}

describe("toast wraps to two lines", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows no Details for a short message", () => {
    overflow(false);
    render(<ToastView title="Bed pulled" onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: "Details" })).toBeNull();
  });

  it("shows Details for a long message, opens it out and closes it again", () => {
    overflow(true);
    render(
      <ToastView tone="warning" title="Not moved. The bed is held." body="Pick another bed." onClose={() => {}} />,
    );
    const card = screen.getByText("Not moved. The bed is held.").closest<HTMLElement>("[data-clamp]");
    expect(card).not.toBeNull();
    const details = screen.getByRole("button", { name: "Details" });
    expect(details).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(details);
    expect(card).toHaveAttribute("data-expanded", "true");
    expect(screen.getByRole("button", { name: "Less" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "Less" }));
    expect(card).not.toHaveAttribute("data-expanded");
  });

  it("keeps Undo working beside Details", () => {
    overflow(true);
    const onUndo = vi.fn();
    render(<ToastView title="Bed pulled" undo={{ durationMs: 5000, onUndo }} />);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("leaves a wrap toast and an Undo-until toast unclamped", () => {
    overflow(true);
    const { container } = render(
      <>
        <ToastView title="Whole sentence" data-wrap="true" />
        <ToastView title="Bed pulled" undo={{ durationMs: 15000, until: "14:47", onUndo: () => {} }} />
      </>,
    );
    expect(container.querySelector("[data-clamp]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Details" })).toBeNull();
  });
});

describe("toast place and clamp styles", () => {
  it("clamps to two lines with no single-line ellipsis", () => {
    expect(css).toMatch(/\.toast\[data-clamp\] \.toastTitle,[\s\S]*?-webkit-line-clamp: 2;/);
    expect(css).toContain('.toast[data-clamp][data-expanded="true"]');
  });

  it("moves left of an open right drawer, not to bottom left", () => {
    expect(css).toMatch(/right: calc\(min\(32rem, 100vw\) \+ var\(--wf-s-6\)\)/);
    expect(css).not.toMatch(/left: var\(--wf-s-6\);\s*align-items: flex-start/);
  });
});

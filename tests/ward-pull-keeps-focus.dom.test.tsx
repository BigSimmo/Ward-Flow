import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import {
  focusWardArrival,
  useWardCommandCompletion,
} from "@/components/ward-management/ward/use-ward-command-completion";

afterEach(cleanup);

/**
 * Overall review (20 Oct 2026): Pull a bed from Home's Ward flow list lost keyboard focus. The pull
 * replaces the row's button with its next action, and the arrivals row that DA-11 focuses sits on a
 * hidden tab, so focus fell to the page. It now goes to the next action in the same row. Checked in
 * Chromium on a seeded ward; jsdom cannot tell a hidden tab from a shown one, so this test has no
 * arrivals row at all.
 */
function FlowRow() {
  const complete = useWardCommandCompletion();
  const [pulled, setPulled] = useState(false);
  return (
    <ul>
      <li>
        <span>Synthetic arrival</span>
        {pulled ? (
          <button type="button">Open</button>
        ) : (
          <button
            type="button"
            onClick={() =>
              complete(
                "movement:WF-TEST",
                () => undefined,
                () => {
                  setPulled(true);
                  queueMicrotask(() => focusWardArrival("WF-TEST"));
                },
              )
            }
          >
            Pull a bed
          </button>
        )}
      </li>
    </ul>
  );
}

describe("Pull a bed from Home keeps keyboard focus", () => {
  it("moves focus to the row's next action when there is no arrivals row to take it", async () => {
    render(<FlowRow />);
    const pull = screen.getByRole("button", { name: "Pull a bed" });
    pull.focus();
    fireEvent.click(pull);
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.getByRole("button", { name: "Open" })).toHaveFocus();
  });

  it("leaves focus alone when it is already somewhere", async () => {
    render(
      <>
        <FlowRow />
        <input aria-label="Elsewhere" />
      </>,
    );
    const pull = screen.getByRole("button", { name: "Pull a bed" });
    pull.focus();
    fireEvent.click(pull);
    screen.getByRole("textbox", { name: "Elsewhere" }).focus();
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.getByRole("textbox", { name: "Elsewhere" })).toHaveFocus();
  });
});

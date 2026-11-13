// Shared design parts item 6 (Josh, 13 Nov 2026): a "not yet" reason is drawn as a lock line under
// the button, right-aligned with it; a tooltip reason is drawn the same way on a phone or touch
// screen, where a tooltip never shows; "never for this desk" work gets one quiet foot line.
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/wf/button";
import { WhoDoesThis } from "@/components/wf/who-does-this";

const css = readFileSync(path.join(process.cwd(), "src/components/wf/button.module.css"), "utf8");

describe("tooltip reason on touch", () => {
  it("draws the reason as a lock line beside the tooltip, hidden from screen readers", () => {
    const { container } = render(
      <Button disabledReason="Needs the bed pulled" reasonDisplay="tooltip">
        Log booking
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Log booking" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    // Read once, from the description, not twice.
    expect(button).toHaveAccessibleDescription("Needs the bed pulled");
    const line = container.querySelector("[data-touch-reason]");
    expect(line).toHaveTextContent("Needs the bed pulled");
    expect(line).toHaveAttribute("aria-hidden", "true");
    expect(line?.querySelector("svg")).not.toBeNull();
  });

  it("shows the drawn line only on a phone width or a coarse pointer, and never the tip there", () => {
    const touch = [...css.matchAll(/@media \(max-width: 46\.4375rem\), \(pointer: coarse\) \{([\s\S]*?)\n\}/gu)]
      .map((match) => match[1])
      .join("\n");
    expect(touch).toMatch(/\.tipReason > \.touchReason \{[^}]*display: inline-flex/u);
    expect(touch).toMatch(/\.reasonTip\.reasonTip \{[^}]*display: none/u);
    expect(css).toMatch(/\n\.touchReason \{\s*display: none;/u);
    expect(css).toMatch(/\n\.tipReason \{\s*display: contents;/u);
  });
});

describe("inline reason placement", () => {
  it("sits under the button, right-aligned with it, and is read first", () => {
    const { container } = render(<Button disabledReason="Choose a bed first">Pull the bed</Button>);
    const wrap = container.firstElementChild as HTMLElement;
    expect(wrap.firstElementChild).toHaveTextContent("Choose a bed first");
    expect(wrap.lastElementChild?.tagName).toBe("BUTTON");
    const rule = /\n\.withReason \{([^}]*)\}/u.exec(css)?.[1] ?? "";
    expect(rule).toMatch(/flex-direction:\s*column-reverse/u);
    expect(rule).toMatch(/align-items:\s*flex-end/u);
  });
});

describe("WhoDoesThis", () => {
  it("is one quiet sentence naming who does the work", () => {
    render(<WhoDoesThis>Bed coordinator records clearance.</WhoDoesThis>);
    const line = screen.getByText("Bed coordinator records clearance.");
    expect(line.tagName).toBe("P");
    expect(line).toHaveAttribute("data-wf-who-does-this");
    const whoCss = readFileSync(path.join(process.cwd(), "src/components/wf/who-does-this.module.css"), "utf8");
    expect(whoCss).toMatch(/color: var\(--wf-ink-3\)/u);
  });
});

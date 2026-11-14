/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClampText } from "@/components/wf/clamp-text";
import { MissingValue } from "@/components/wf/missing-value";
import { RowLink, RowLinkRow, rowLinkActionClass } from "@/components/wf/row-link";
import { StateLine } from "@/components/wf";

describe("RowLink", () => {
  it("names the link and keeps row buttons separate and raised", () => {
    render(
      <RowLinkRow>
        <RowLink href="/people/1">Sample Person</RowLink>
        <button type="button" className={rowLinkActionClass}>
          Chase
        </button>
      </RowLinkRow>,
    );
    expect(screen.getByRole("link", { name: "Sample Person" }).getAttribute("href")).toBe("/people/1");
    expect(screen.getByRole("button", { name: "Chase" })).toBeTruthy();
  });

  it("renders a button when there is no href", () => {
    render(<RowLink>Open</RowLink>);
    expect(screen.getByRole("button", { name: "Open" }).getAttribute("type")).toBe("button");
  });
});

describe("MissingValue", () => {
  it("cell density is grey, wraps and never says undefined", () => {
    // @ts-expect-error deliberately missing reason
    render(<MissingValue reason={undefined} density="cell" />);
    const el = screen.getByTestId("missing-value");
    expect(el.textContent).toBe("Unknown");
    expect(el.className).toContain("--wf-ink-3");
    expect(el.className).toContain("whitespace-normal");
    expect(el.className).not.toMatch(/nowrap|truncate/);
  });
});

describe("ClampText", () => {
  it("is not focusable when the text fits", () => {
    render(<ClampText>Short note</ClampText>);
    expect(screen.getByText("Short note").hasAttribute("tabindex")).toBe(false);
  });

  it("becomes focusable and shows the full text on focus when cut", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 80 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 40 });
    try {
      render(<ClampText>A long detail that is cut</ClampText>);
      const el = screen.getByText("A long detail that is cut");
      expect(el.getAttribute("tabindex")).toBe("0");
      el.focus();
      expect((await screen.findByRole("tooltip")).textContent).toContain("A long detail that is cut");
    } finally {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollHeight;
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
    }
  });
});

describe("StateLine empty", () => {
  it("is one short line with no helper text by default", () => {
    render(<StateLine kind="empty" title="No patients waiting" />);
    expect(screen.getByRole("status").textContent).toBe("No patients waiting");
  });
});

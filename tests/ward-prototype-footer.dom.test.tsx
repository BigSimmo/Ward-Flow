import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

afterEach(cleanup);

describe("the prototype footer (DA-33)", () => {
  it("names Ward Flow as a prototype, never a real organisation's product", () => {
    render(<WardPrototypeFooter />);
    const footer = screen.getByTestId("ward-prototype-footer");
    expect(footer).toHaveTextContent("Ward Flow prototype · Synthetic data only");
    expect(footer.outerHTML).not.toContain("WA Health");
    expect(footer).toHaveTextContent("Not approved for clinical use");
  });

  it("keeps configurable content and attributes live while preserving the disclosure", () => {
    const { rerender } = render(
      <WardPrototypeFooter
        testId="prototype-footer-before"
        note={<strong>First synthetic note</strong>}
        extra={<span>First extra</span>}
        className="footer-before"
        style={{ opacity: 0.5 }}
      />,
    );
    const badge = screen.getByText("Synthetic prototype").outerHTML;
    const authority = screen.getByText("Ward Flow prototype · Synthetic data only").parentElement!.outerHTML;
    expect(screen.getByTestId("prototype-footer-before")).toHaveStyle({ opacity: "0.5" });

    rerender(
      <WardPrototypeFooter
        testId="prototype-footer-after"
        note={<strong>Updated synthetic note</strong>}
        extra={<em>Updated extra</em>}
        className="footer-after"
        style={{ opacity: 0.8 }}
      />,
    );
    const footer = screen.getByRole("contentinfo", { name: "Prototype disclosure" });
    expect(footer).toHaveAttribute("data-testid", "prototype-footer-after");
    expect(footer).toHaveClass("footer-after");
    expect(footer).not.toHaveClass("footer-before");
    expect(footer).toHaveStyle({ opacity: "0.8" });
    expect(footer).toHaveTextContent("Updated synthetic note");
    expect(footer).toHaveTextContent("Updated extra");
    expect(screen.queryByText("First synthetic note")).toBeNull();
    expect(screen.queryByText("First extra")).toBeNull();
    expect(screen.getByText("Synthetic prototype").outerHTML).toBe(badge);
    expect(screen.getByText("Ward Flow prototype · Synthetic data only").parentElement!.outerHTML).toBe(authority);
  });
});

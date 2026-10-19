import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

describe("the prototype footer (DA-33)", () => {
  it("names Ward Flow as a prototype, never a real organisation's product", () => {
    render(<WardPrototypeFooter />);
    const footer = screen.getByTestId("ward-prototype-footer");
    expect(footer).toHaveTextContent("Ward Flow prototype · Synthetic data only");
    expect(footer.outerHTML).not.toContain("WA Health");
    expect(footer).toHaveTextContent("Not approved for clinical use");
  });
});

// shell-10 (13 Oct 2026): a route-level loading placeholder inside the Ward Flow shell, so a tap on
// slow signal shows at once that a page is on its way.
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import WardFlowLoading from "@/app/ward-flow/loading";

describe("Ward Flow route loading state", () => {
  it("announces the page is loading and keeps the main landmark the skip link targets", () => {
    render(<WardFlowLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading page");
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("aria-busy", "true");
  });
});

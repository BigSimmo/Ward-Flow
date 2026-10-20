import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { MissedRequestsPanel } from "@/components/ward-management/coordinator/missed-requests-panel";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Overall review (20 Oct 2026): the daily check's "Checked, all accounted for" tap on screen. */
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("Daily check: Checked, all accounted for", () => {
  it("records who ticked it and when, and keeps the check itself on screen", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MissedRequestsPanel />
      </WardFlowProvider>,
    );
    const confirmation = screen.getByTestId("ward-missed-check-confirmation");
    fireEvent.click(screen.getByRole("button", { name: "Checked, all accounted for" }));

    expect(screen.queryByTestId("ward-missed-check-done")).toBeNull();
    expect(confirmation).toHaveTextContent(
      `Checked, all accounted for · Flow coordinator at ${formatInstant(NOW_ANCHOR)}`,
    );
    expect(screen.getByTestId("ward-missed-check")).toHaveTextContent("Daily check");
  });
});

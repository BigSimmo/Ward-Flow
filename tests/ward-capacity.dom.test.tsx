import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

describe("ward decisions tab keeps the compact queue and not the census form", () => {
  it("does not render the census or capacity form on #tab-return", () => {
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    const tabReturn = container.querySelector("#tab-return");
    expect(tabReturn).not.toBeNull();
    expect(within(tabReturn as HTMLElement).queryByTestId("ward-capacity-form")).not.toBeInTheDocument();
    expect(within(tabReturn as HTMLElement).queryByTestId("ward-daily-return")).not.toBeInTheDocument();
    expect(within(tabReturn as HTMLElement).queryByText(/Morning Census/i)).not.toBeInTheDocument();
    expect(within(tabReturn as HTMLElement).getByRole("button", { name: "Staffing, 07:00–09:30" })).toBeInTheDocument();
  });

  it("does not offer the allocatable stepper on the decisions queue", () => {
    const unit = unitById("rph-adult-secure");
    expect(unit).toBeDefined();

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    expect(screen.queryByTestId("ward-capacity-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-capacity-submit")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm unchanged" })).not.toBeInTheDocument();
  });

  it("shows the compact queue after switching to the Decisions tab", () => {
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    const tabBtnReturn = container.querySelector("#tabBtn-return");
    expect(tabBtnReturn).not.toBeNull();
    fireEvent.click(tabBtnReturn as HTMLElement);

    const tabReturn = container.querySelector("#tab-return");
    expect(tabReturn?.getAttribute("data-active")).toBe("true");
    expect(within(tabReturn as HTMLElement).getByRole("button", { name: "Intake, 09:30–13:00" })).toBeInTheDocument();
    expect(within(tabReturn as HTMLElement).queryByTestId("ward-capacity-input")).not.toBeInTheDocument();
  });

  it("shows the same due count on the Decisions tab as the queue", () => {
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    const heading = screen.getByRole("heading", { name: /^Decisions/ });
    const dueMatch = heading.textContent?.match(/(\d+) due/);
    const badge = container.querySelector("#badgeReturn");
    expect(badge).not.toBeNull();
    if (dueMatch) {
      expect(badge).toHaveTextContent(`${dueMatch[1]} Due`);
    } else {
      expect(heading).toHaveTextContent("Done");
      expect(badge).toHaveTextContent("Done");
    }
  });
});

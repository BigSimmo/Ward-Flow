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
import styles from "@/components/ward-management/ward/ward.module.css";

describe("ward capacity confirmation form on #tab-return", () => {
  it("renders capacityConfirmationForm visibly right below WardDecisionsCockpit on #tab-return", () => {
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    const tabReturn = container.querySelector("#tab-return");
    expect(tabReturn).not.toBeNull();

    const form = within(tabReturn as HTMLElement).getByTestId("ward-capacity-form");
    expect(form).toBeInTheDocument();

    // Verify it is NOT inside visuallyHidden
    const visuallyHiddenContainer = container.querySelector(`.${styles.visuallyHidden}`);
    if (visuallyHiddenContainer) {
      expect(visuallyHiddenContainer.contains(form)).toBe(false);
    }

    // Verify it is inside an open details disclosure
    const openDisclosure = form.closest("details");
    expect(openDisclosure).not.toBeNull();
    expect(openDisclosure?.hasAttribute("open")).toBe(true);

    const input = within(tabReturn as HTMLElement).getByTestId("ward-capacity-input");
    const submit = within(tabReturn as HTMLElement).getByTestId("ward-capacity-submit");
    expect(input).toBeInTheDocument();
    expect(submit).toBeInTheDocument();
  });

  it("allows entering a capacity count and updates the confirmed count", () => {
    const unit = unitById("rph-adult-secure");
    expect(unit).toBeDefined();

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    const input = screen.getByTestId("ward-capacity-input");
    const submit = screen.getByTestId("ward-capacity-submit");

    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.click(submit);

    expect(screen.getByText(/Currently confirmed 3 at/)).toBeInTheDocument();
  });

  it("is operable after switching to the Decisions/return tab", () => {
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

    const input = screen.getByTestId("ward-capacity-input");
    const submit = screen.getByTestId("ward-capacity-submit");

    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.click(submit);

    expect(screen.getByText(/Currently confirmed 0 at/)).toBeInTheDocument();
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

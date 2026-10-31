import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Phone referral board (from #1114, 31 Oct 2026): the open referral covers the queue, so focus moves
 * into the detail with the reader and the queue behind it leaves the Tab order until it closes.
 */

vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => true,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const originalWidth = window.innerWidth;
beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
});
afterEach(() => {
  cleanup();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
});

describe("phone referral board with a referral open", () => {
  it("moves focus into the detail and takes the queue out of the Tab order", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralBoard />
      </WardFlowProvider>,
    );
    const queue = screen.getByRole("region", { name: "Referral queues" });
    expect(queue).not.toHaveAttribute("inert");

    fireEvent.click(screen.getAllByTestId(/^ward-referral-board-row-/)[0]!);
    const detail = screen.getByRole("region", { name: "Selected referral detail" });
    expect(detail, "no referral was selected, so this proves nothing").toHaveAttribute("data-has-selection", "true");
    expect(detail).toHaveFocus();
    expect(queue).toHaveAttribute("inert");
  });
});

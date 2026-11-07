import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  // Drawer review (6 Nov 2026): the referral opens in the kit drawer (a sheet rising from the foot on
  // a phone), which moves focus in, makes the page behind it inert and returns focus on close.
  it("moves focus into the detail and takes the queue out of the Tab order", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralBoard />
      </WardFlowProvider>,
    );
    const queue = screen.getByRole("region", { name: "Referral queues" });
    expect(queue).not.toHaveAttribute("inert");

    fireEvent.click(screen.getAllByTestId(/^ward-referral-board-row-/)[0]!);
    const detail = screen.getByTestId("ward-referral-detail");
    await waitFor(() => expect(detail.contains(document.activeElement)).toBe(true));
    await waitFor(() => expect(queue.closest("[inert]")).not.toBeNull());
  });

  it("returns focus to the referral's own row when Escape closes it (A3, 2 Nov 2026)", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralBoard />
      </WardFlowProvider>,
    );
    const select = screen.getAllByTestId(/^ward-referral-board-(card-)?select-/)[0]!;
    const testId = select.getAttribute("data-testid")!;
    select.focus();
    fireEvent.click(select);
    const detail = screen.getByTestId("ward-referral-detail");
    await waitFor(() => expect(detail.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("ward-referral-detail")).toBeNull());
    await waitFor(() => expect(document.activeElement).toHaveAttribute("data-testid", testId));
  });
});

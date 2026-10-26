import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

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

/** Tracks writes to the detail panel's scrollTop, which jsdom does not keep. */
function trackScroll(element: HTMLElement) {
  let value = 0;
  const writes: number[] = [];
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    get: () => value,
    set: (next: number) => {
      value = next;
      writes.push(next);
    },
  });
  return {
    writes,
    scrollTo(next: number) {
      value = next;
    },
    get top() {
      return value;
    },
  };
}

describe("Referral board detail panel scroll (H-0369)", () => {
  it("keeps the detail panel where the reader left it when a sheet opens and closes", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralBoard />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getAllByTestId(/^ward-referral-board-row-/)[0]!);
    const detail = screen.getByRole("region", { name: "Selected referral detail" });
    expect(detail, "no referral was selected, so this proves nothing").toHaveAttribute("data-has-selection", "true");
    const scroll = trackScroll(detail);
    scroll.scrollTo(240);

    fireEvent.click(screen.getAllByRole("button", { name: "Summary" })[0]!);
    expect(scroll.top).toBe(240);
    act(() => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    });
    expect(scroll.top).toBe(240);
    expect(scroll.writes).toEqual([]);
  });
});

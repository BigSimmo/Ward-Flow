import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/referrals",
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/ui/toast";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function renderBoard() {
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralBoard />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

function queueIds() {
  return within(screen.getByTestId("ward-referral-board-queued-table"))
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.getAttribute("data-referral-id"));
}

describe("Referrals v10: Accept then Undo", () => {
  it("toasts with Undo after an accept, and Undo puts the referral back in the same place", () => {
    renderBoard();
    const before = queueIds();
    expect(before).toContain("RF-005");
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-005"));
    const list = screen.getByTestId("ward-referral-match-list");
    const accept = list.querySelector<HTMLButtonElement>('button[data-testid^="ward-referral-match-accept-"]');
    expect(accept, "RF-005 has a ward that accepts").not.toBeNull();
    fireEvent.click(accept!);

    expect(queueIds()).not.toContain("RF-005");
    const undo = screen.getByRole("button", { name: "Undo" });
    expect(undo.closest("[data-undo]")).toHaveTextContent(/^Accepted at /);

    act(() => {
      fireEvent.click(undo);
    });
    expect(queueIds()).toEqual(before);
    expect(screen.getByText("Decision undone")).toBeInTheDocument();
  });
});

describe("Referrals v10: search narrows", () => {
  it("narrows the queue to matching rows and the count line says how many are shown", () => {
    renderBoard();
    const total = queueIds().length;
    fireEvent.change(screen.getByRole("searchbox", { name: "Search referrals" }), { target: { value: "RF-005" } });
    expect(queueIds()).toEqual(["RF-005"]);
    expect(screen.getByTestId("ward-referral-search-note")).toHaveTextContent(`1 of ${total} shown`);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search referrals" }), { target: { value: "" } });
    expect(queueIds()).toHaveLength(total);
  });

  it("says no queued referral matches rather than claiming the queue is empty", () => {
    renderBoard();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search referrals" }), {
      target: { value: "zzzz-no-such" },
    });
    expect(screen.getByTestId("ward-referral-board-queued-empty")).toHaveTextContent(
      "No queued referral matches the search.",
    );
  });
});

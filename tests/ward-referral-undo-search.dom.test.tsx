import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/referrals",
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

import { ToastProvider } from "@/components/wf/toast-provider";
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

describe("Audit 1 (CS-15): a decision names the person and does not open the next one", () => {
  it("keeps the detail on the person decided, and the toast names them", () => {
    // Side by side, where the board opens the first in queue before anyone has chosen.
    const split = (query: string) => ({
      matches: query === "(min-width: 64rem)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: split });
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <ReferralBoard defaultSelectFirst />
        </WardFlowProvider>
      </ToastProvider>,
    );
    const [first, second] = queueIds();
    const name = screen.getByTestId(`ward-referral-board-select-${first}`).textContent ?? "";
    const accept = document.querySelector<HTMLButtonElement>('button[data-testid^="ward-referral-match-accept-"]');
    expect(accept, "the first in queue can be accepted").not.toBeNull();
    fireEvent.click(accept!);
    const confirm = screen.queryByRole("button", { name: /^Confirm accept/ });
    if (confirm) fireEvent.click(confirm);

    expect(queueIds()).not.toContain(first);
    expect(screen.getByTestId(`ward-referral-inspector-priority-${first}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`ward-referral-inspector-priority-${second}`)).not.toBeInTheDocument();
    const toast = screen.getByRole("button", { name: "Undo" }).closest("[data-undo]");
    expect(toast).toHaveTextContent(/^Accepted .+ · /);
    expect(name.length).toBeGreaterThan(0);
    expect(toast?.textContent).not.toMatch(/RF-\d/);
  });
});

describe("Referrals v10: search narrows", () => {
  it("narrows the queue to matching rows and the count line says how many are shown", () => {
    renderBoard();
    const total = queueIds().length;
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter referrals" }), { target: { value: "RF-005" } });
    expect(queueIds()).toEqual(["RF-005"]);
    expect(screen.getByTestId("ward-referral-search-note")).toHaveTextContent(`1 of ${total} shown`);
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter referrals" }), { target: { value: "" } });
    expect(queueIds()).toHaveLength(total);
  });

  it("says no queued referral matches rather than claiming the queue is empty", () => {
    renderBoard();
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter referrals" }), {
      target: { value: "zzzz-no-such" },
    });
    expect(screen.getByTestId("ward-referral-board-queued-empty")).toHaveTextContent(
      "No queued referral matches the search.",
    );
  });
});

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
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { REFERRAL_DECLINE_REASONS } from "@/components/ward-management/ward-model";
import { searchWardFlow } from "@/components/ward-management/search/ward-smart-search";

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
    // D-77: pick a fitting ward in the one decision list, then Accept.
    const fit = document.querySelector<HTMLButtonElement>(
      'button[data-testid^="ward-referral-match-phone-cand-"][data-kind="yes"]',
    );
    expect(fit, "RF-005 has a ward that accepts").not.toBeNull();
    fireEvent.click(fit!);
    fireEvent.click(screen.getByTestId("ward-referral-match-phone-accept"));

    expect(queueIds()).not.toContain("RF-005");
    const undo = screen.getByRole("button", { name: "Undo" });
    expect(undo.closest("[data-undo]")).toHaveTextContent(/^Accepted at /);

    act(() => {
      fireEvent.click(undo);
    });
    expect(queueIds()).toEqual(before);
    expect(screen.getByText("Decision undone")).toBeInTheDocument();
  });

  it("names the destination that declined, not the whole referral (F-109, A14-18)", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-005"));
    fireEvent.click(screen.getByTestId("ward-referral-match-decline-open"));
    fireEvent.click(screen.getByTestId(`ward-referral-match-phone-decline-${REFERRAL_DECLINE_REASONS[0]}`));
    fireEvent.click(screen.getByTestId("ward-referral-match-decline"));

    const toast = screen.getByRole("button", { name: "Undo" }).closest("[data-undo]");
    expect(toast).toHaveTextContent(/^Psychiatric ward declined · /u);
    expect(toast).not.toHaveTextContent("Referral declined");
  });
});

describe("Audit 1 (CS-15): a decision names the person and does not open the next one", () => {
  it("keeps the detail on the person decided, and the toast names them", () => {
    // Side by side (the first in queue is chosen below).
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
    // Drawer review (6 Nov 2026): nothing opens by itself, so the first in queue is chosen.
    fireEvent.click(screen.getByTestId(`ward-referral-board-select-${first}`));
    const accept = document.querySelector<HTMLButtonElement>('button[data-testid^="ward-referral-match-accept-"]');
    expect(accept, "the first in queue can be accepted").not.toBeNull();
    fireEvent.click(accept!);
    const confirm = screen.queryByRole("button", { name: /^Confirm accept/ });
    // Audit CS3-08: a confirm tap within 600 ms of opening is a double tap and is ignored.
    const later = Date.now() + 1_000;
    const clock = vi.spyOn(Date, "now").mockReturnValue(later);
    if (confirm) fireEvent.click(confirm);
    clock.mockRestore();

    expect(queueIds()).not.toContain(first);
    expect(screen.getByTestId(`ward-referral-inspector-priority-${first}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`ward-referral-inspector-priority-${second}`)).not.toBeInTheDocument();
    const toast = screen.getByRole("button", { name: "Undo" }).closest("[data-undo]");
    expect(toast).toHaveTextContent(/^Accepted .+ · /);
    expect(name.length).toBeGreaterThan(0);
    expect(toast?.textContent).not.toMatch(/RF-\d/);
  });
});

describe("Referrals: no queue filter box (search and forms review, 30 Oct 2026)", () => {
  it("lists every queued referral with no Filter queue box, and the header search finds one by id", () => {
    renderBoard();
    expect(screen.queryByRole("searchbox", { name: "Filter referrals" })).not.toBeInTheDocument();
    expect(queueIds()).toContain("RF-005");
    // The header search is where a queued referral is found by id, name, UMRN, origin or region.
    const state = seedWardFlowState();
    const found = searchWardFlow({
      query: "RF-005",
      patients: state.patients,
      movements: state.movements,
      units: state.units,
      referrals: state.referrals,
    });
    expect(found.referrals.map((result) => result.referral.id)).toContain("RF-005");
  });
});

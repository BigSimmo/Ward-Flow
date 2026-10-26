// Audit 24-1 B-03: when the referral on the Referrals board is decided at another desk, the
// detail names who was decided and selects nobody; it never opens the next person in the queue.
// Synthetic seed data only.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => cleanup());
beforeEach(() => {
  // Side by side, where the board opens the first in queue before anyone has chosen.
  const split = (query: string) => ({
    matches: query === "(min-width: 64rem)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: split });
});

type Adjust = (referrals: Referral[]) => Referral[];

function Harness({ adjust, children }: { adjust: Adjust; children: ReactNode }) {
  const state = useWardFlow();
  return <WardFlowOverride value={{ ...state, referrals: adjust(state.referrals) }}>{children}</WardFlowOverride>;
}

function renderBoard() {
  const tree = (adjust: Adjust) => (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Harness adjust={adjust}>
        <ReferralBoard defaultSelectFirst />
      </Harness>
    </WardFlowProvider>
  );
  const view = render(tree((referrals) => referrals));
  return (adjust: Adjust) => view.rerender(tree(adjust));
}

/** Another desk accepted it: every destination answered. */
const decidedElsewhere =
  (id: string): Adjust =>
  (referrals) =>
    referrals.map((referral) =>
      referral.id === id
        ? {
            ...referral,
            destinations: referral.destinations.map((addressing) => ({ ...addressing, state: "accepted" as const })),
          }
        : referral,
    );

function queueIds() {
  return within(screen.getByTestId("ward-referral-board-queued-table"))
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.getAttribute("data-referral-id")!);
}

const detail = () => screen.getByRole("region", { name: "Selected referral detail" });

describe("Referrals board: a referral decided elsewhere (B-03)", () => {
  it.each([
    ["chosen by the coordinator", true],
    ["opened by default", false],
  ])("names them and selects nobody when %s", (_label, choose) => {
    const adjust = renderBoard();
    const [, second] = queueIds();
    const target = choose ? second! : queueIds()[0]!;
    if (choose) fireEvent.click(screen.getByTestId(`ward-referral-board-select-${target}`));
    const name = screen.getByTestId(`ward-referral-board-select-${target}`).textContent ?? "";
    expect(detail()).toHaveAttribute("data-has-selection", "true");

    act(() => adjust(decidedElsewhere(target)));

    expect(queueIds()).not.toContain(target);
    expect(detail()).toHaveAttribute("data-has-selection", "false");
    const notice = screen.getByTestId("ward-referral-decided-elsewhere");
    expect(name.length).toBeGreaterThan(0);
    expect(notice.textContent).toContain("was decided elsewhere.");
    // The row reads "Surname, Given"; the notice reads "Given Surname".
    const [surname, given] = name.split(", ");
    expect(notice).toHaveTextContent(
      `${given} ${surname} was decided elsewhere. Choose the next referral from the queue.`,
    );
    expect(document.querySelector('button[data-testid^="ward-referral-match-accept-"]')).toBeNull();

    // Choosing another referral clears the notice.
    fireEvent.click(screen.getByTestId(`ward-referral-board-select-${queueIds()[0]}`));
    expect(screen.queryByTestId("ward-referral-decided-elsewhere")).not.toBeInTheDocument();
    expect(detail()).toHaveAttribute("data-has-selection", "true");
  });
});

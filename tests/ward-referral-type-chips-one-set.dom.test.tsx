import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * P154 (Josh, 27 October 2026, 9:24 PM AWST, option A): phone and desktop both read
 * "Ward bed · ED · More than one · Community · Refused once", and each referral is counted once
 * under its type (A2-13): one asking for more than one kind of place sits under More than one.
 */

const TYPE_KEYS = ["ward", "ed", "both", "community"] as const;
const LABELS = ["Ward bed", "ED", "More than one", "Community", "Refused once"];

function setPhone(phone: boolean) {
  const mm = (query: string) => ({
    matches: phone ? query === "(max-width: 48rem)" || query === "(max-width: 40rem)" : query === "(min-width: 64rem)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  });
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: mm });
}

function QueueProbe() {
  return <p data-testid="queue-probe">{referralQueueOrder(useWardFlow().referrals).length}</p>;
}

function renderBoard() {
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralBoard />
        <QueueProbe />
      </WardFlowProvider>
    </ToastProvider>,
  );
  return Number(screen.getByTestId("queue-probe").textContent);
}

/** "3Ward bed" -> ["Ward bed", 3] */
function split(el: HTMLElement): [string, number] {
  const text = (el.textContent ?? "").trim();
  const m = /^(\d+)\s*(.+)$/.exec(text) ?? /^(.+?)\s*(\d+)$/.exec(text);
  expect(m, `no count in "${text}"`).not.toBeNull();
  return /^\d/.test(text) ? [m![2]!.trim(), Number(m![1])] : [m![1]!.trim(), Number(m![2])];
}

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("P154: one type chip set on phone and desktop, each referral counted once", () => {
  it("phone chips read Ward bed · ED · More than one · Community · Refused once; types sum to the queue", () => {
    setPhone(true);
    const queued = renderBoard();
    const group = screen.getByRole("group", { name: "Highlight by what is asked" });
    const chips = within(group).getAllByRole("button").map(split);
    // Referrals redesign (31 Oct 2026): a chip with nobody in it hides, so the chips shown keep this
    // order and each holds someone; the types shown still sum to the queue (each counted once).
    expect(chips.map(([label]) => label)).toEqual(LABELS.filter((label) => chips.some(([shown]) => shown === label)));
    expect(chips.every(([, n]) => n > 0)).toBe(true);
    expect(queued).toBeGreaterThan(0);
    const types = chips.filter(([label]) => label !== "Refused once");
    expect(types.length).toBeGreaterThanOrEqual(2);
    expect(types.reduce((sum, [, n]) => sum + n, 0)).toBe(queued);
  });

  it("desktop pills read Ward bed · ED · More than one · Community (+ Refused once), same counts as phone", () => {
    setPhone(true);
    renderBoard();
    // Referrals redesign (31 Oct 2026): empty type chips hide on both, so compare the ones shown.
    const phone = TYPE_KEYS.flatMap((key) => {
      const chip = screen.queryByTestId(`ward-referral-phone-chip-${key}`);
      return chip ? [split(chip)] : [];
    });
    const phoneRefused = screen.queryByTestId("ward-referral-phone-chip-refused")?.textContent ?? null;
    document.body.innerHTML = "";
    setPhone(false);
    const queued = renderBoard();
    const group = screen.getByRole("group", { name: "Highlight referrals" });
    const pills = within(group).getAllByRole("button").map(split);
    // Referrals redesign (31 Oct 2026): "Decision overdue" is the one word for late decisions, and
    // Refused once joins this group (hidden, like the rest, while nobody is in it).
    const order = ["Decision overdue", "Tier 1", "Ward bed", "ED", "More than one", "Community", "Refused once"];
    expect(pills.map(([label]) => label)).toEqual(order.filter((label) => pills.some(([shown]) => shown === label)));
    expect(pills.every(([, n]) => n > 0)).toBe(true);
    const types = pills.filter(([label]) => !["Decision overdue", "Tier 1", "Refused once"].includes(label));
    expect(types).toEqual(phone);
    expect(types.reduce((sum, [, n]) => sum + n, 0)).toBe(queued);
    const refused = screen.queryByTestId("ward-referral-highlight-refused");
    expect(refused?.textContent ?? null).toBe(phoneRefused);
    if (refused) expect(refused).toHaveTextContent("Refused once");
  });
});

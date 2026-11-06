// BA-1 and BA-3 (front-end audit, 5 Nov 2026): on the Referrals board, keyboard focus no longer falls to
// the page after an ED acceptance is confirmed, or after Escape closes the detail the page opened by
// itself. Synthetic seed data only.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/referrals",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { nextQueuedId } from "@/components/ward-management/referrals/referral-focus-fallback";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const frames: FrameRequestCallback[] = [];
function nextFrame() {
  act(() => {
    for (const callback of frames.splice(0)) callback(0);
  });
}

beforeEach(() => {
  const split = (query: string) => ({
    matches: query === "(min-width: 64rem)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: split });
  // Frames run when the test says, after React has drawn the change.
  frames.length = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderBoard() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <ReferralBoard defaultSelectFirst />
      </WardAccessScope>
    </WardFlowProvider>,
  );
}

const detail = () => screen.getByRole("region", { name: "Selected referral detail" });
const queueRows = () =>
  screen.queryAllByTestId(/^ward-referral-board-select-(?!decided)/).filter((row) => row.closest("[hidden]") === null);

describe("Referrals board keeps keyboard focus after a decision (BA-1)", () => {
  it("moves focus to the next referral after an ED acceptance is confirmed", async () => {
    renderBoard();
    // Open each queued referral in turn until one is an ED review with Accept presentation.
    const rows = await screen.findAllByTestId(/^ward-referral-board-select-(?!decided)/);
    let accept: HTMLElement | null = null;
    for (const row of rows) {
      fireEvent.click(row);
      accept = within(detail()).queryByTestId("ward-referral-match-accept-emergency_department");
      if (accept) break;
    }
    expect(accept, "the seed has an ED review in the queue").not.toBeNull();
    // The second-tap guard ignores a confirm in the same instant as the open, so time moves on.
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    fireEvent.click(accept!);
    clock.mockReturnValue(1_010_000);
    const confirm = within(detail()).getByTestId("ward-referral-match-confirm-accept-emergency_department");
    confirm.focus();
    act(() => {
      fireEvent.click(confirm);
    });
    expect(confirm).not.toBeInTheDocument();
    nextFrame();
    expect(document.activeElement).not.toBe(document.body);
    const active = document.activeElement as HTMLElement;
    // The next queued referral's row, or the detail when the queue is now empty.
    const landed = queueRows().includes(active) || active === detail();
    expect(landed).toBe(true);
  });

  it("picks the referral after the decided one, else the one before", () => {
    expect(nextQueuedId(["a", "b", "c"], "b")).toBe("c");
    expect(nextQueuedId(["a", "b", "c"], "c")).toBe("b");
    expect(nextQueuedId(["a"], "a")).toBeUndefined();
    expect(nextQueuedId(["a", "b"], "gone")).toBe("a");
  });
});

describe("Escape on the auto-opened referral keeps focus on the board (BA-3)", () => {
  it("sends focus to the first queued referral when the page opened the detail itself", async () => {
    renderBoard();
    await within(detail()).findAllByTestId(/^ward-referral-match-/);
    // Nobody pressed a row: the detail opened on the first referral by default.
    within(detail()).getAllByRole("button")[0]!.focus();
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    nextFrame();
    expect(document.activeElement).not.toBe(document.body);
    expect(queueRows()[0]).toHaveFocus();
  });
});

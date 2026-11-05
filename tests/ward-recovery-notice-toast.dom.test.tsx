import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/wf";
import { WardRecoveryNoticeBody } from "@/components/ward-management/shell/ward-recovery-notice-body";
import {
  BROUGHT_UP_TO_DATE_NOTICE,
  OPEN_ITEMS_CLOSED_NOTICE,
  RESTORED_NOTICE_PREFIX,
} from "@/components/ward-management/ward-flow-demo-storage-constants";

const ROUTINE = `${RESTORED_NOTICE_PREFIX} 10:42 on the board clock. Later changes may not have been saved.`;

function renderInShell(notice: string) {
  return render(
    <StrictMode>
      <ToastProvider>
        <WardRecoveryNoticeBody notice={notice} fadeAfterMs={8_000} />
      </ToastProvider>
    </StrictMode>,
  );
}

describe("routine recovery news is an info toast (GEN1, 3 Nov 2026)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it("shows 'Brought up to date from another open tab' once as a closable toast, not a strip", () => {
    renderInShell(BROUGHT_UP_TO_DATE_NOTICE);
    const cards = screen.getAllByTestId("ward-recovery-notice");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent(BROUGHT_UP_TO_DATE_NOTICE);
    expect(cards[0].tagName).not.toBe("P");
    expect(screen.getByRole("button", { name: `Dismiss: ${BROUGHT_UP_TO_DATE_NOTICE}` })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(6_000));
    expect(screen.queryByTestId("ward-recovery-notice")).toBeNull();
  });

  it("shows a routine restore as a toast once per tab", () => {
    const first = renderInShell(ROUTINE);
    expect(screen.getAllByTestId("ward-recovery-notice")).toHaveLength(1);
    first.unmount();
    renderInShell(ROUTINE);
    expect(screen.queryByTestId("ward-recovery-notice")).toBeNull();
  });

  it("keeps a restore that closed open items in the strip, because it needs reading", () => {
    renderInShell(`${ROUTINE} ${OPEN_ITEMS_CLOSED_NOTICE}`);
    const strip = screen.getByTestId("ward-recovery-notice");
    expect(strip.tagName).toBe("P");
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.getByTestId("ward-recovery-notice")).toBeInTheDocument();
  });
});

describe("a restore toast is read whole (Codex review, #1367)", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("lets the restore notice wrap so its closing warning is never cut off", () => {
    renderInShell(ROUTINE);
    const card = screen.getByTestId("ward-recovery-notice");
    expect(card).toHaveAttribute("data-wrap", "true");
    expect(card).toHaveTextContent("Later changes may not have been saved.");
  });
});

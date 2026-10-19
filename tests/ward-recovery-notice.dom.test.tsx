import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WardRecoveryNotice, WardRecoveryNoticeContext } from "@/components/ward-management/shell/ward-recovery-notice";
import { RESTORED_NOTICE_PREFIX } from "@/components/ward-management/ward-flow-demo-storage";

const ROUTINE = `${RESTORED_NOTICE_PREFIX} 10:42 (Perth time). Later changes may not have been saved.`;

function renderNotice(notice: string) {
  return render(
    <StrictMode>
      <WardRecoveryNoticeContext.Provider value={notice}>
        <WardRecoveryNotice />
      </WardRecoveryNoticeContext.Provider>
    </StrictMode>,
  );
}

describe("restore notice (simplification A3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it("stays on screen under StrictMode's effect re-run, then hides after its pause, once per tab", () => {
    const first = renderNotice(ROUTINE);
    expect(screen.getByTestId("ward-recovery-notice")).toHaveTextContent(RESTORED_NOTICE_PREFIX);
    act(() => vi.advanceTimersByTime(8_000));
    expect(screen.queryByTestId("ward-recovery-notice")).toBeNull();
    first.unmount();

    renderNotice(ROUTINE);
    expect(screen.queryByTestId("ward-recovery-notice")).toBeNull();
  });

  it("shows again if the page was left before the pause ended", () => {
    const first = renderNotice(ROUTINE);
    act(() => vi.advanceTimersByTime(3_000));
    first.unmount();

    renderNotice(ROUTINE);
    expect(screen.getByTestId("ward-recovery-notice")).toBeInTheDocument();
  });

  it("keeps a failure notice on screen", () => {
    renderNotice("The last save could not be read. Nothing was restored.");
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByTestId("ward-recovery-notice")).toBeInTheDocument();
  });
});

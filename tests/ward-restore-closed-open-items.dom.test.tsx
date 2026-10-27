import { useEffect } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { absoluteWallClockMinutes, demoDayZero } from "@/components/ward-management/ward-clock";
import { tryWriteDemoState } from "@/components/ward-management/ward-flow-demo-storage";
import { markDemoSaveCurrent } from "@/components/ward-management/ward-flow-demo-save-marker";
import {
  OPEN_ITEMS_CLOSED_NOTICE,
  RESTORED_NOTICE_PREFIX,
  STORAGE_UNAVAILABLE,
} from "@/components/ward-management/ward-flow-demo-storage-constants";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardRecoveryNotice } from "@/components/ward-management/shell/ward-recovery-notice";
import { WardRecoveryNoticeBody } from "@/components/ward-management/shell/ward-recovery-notice-body";

// CS3-17 (26 Oct 2026): a saved day that differs from the first screen redraws every screen when it
// loads, so a panel opened in the first moments closes. The restore notice now says so, and only
// when someone had clicked or typed before the save loaded.

/** `current: false` stands for a save that a later failed write left behind (WS-13). */
function saveChangedDay({ current = true } = {}) {
  const offset = 30;
  const state = { ...seedWardFlowState(), clockOffsetMinutes: offset };
  expect(tryWriteDemoState(state, demoDayZero(new Date()), NOW_ANCHOR + offset, absoluteWallClockMinutes() - 1)).toBe(
    true,
  );
  if (!current) markDemoSaveCurrent(false);
}

/**
 * Clicks once, in its own mount effect. A child's effects run before the provider's, so this click
 * lands before the save is adopted, as a click does before a slow phone's restore has loaded.
 */
function ClickBeforeAdoption() {
  useEffect(() => {
    window.dispatchEvent(new Event("pointerdown"));
  }, []);
  return null;
}

function mount(click: boolean) {
  return render(
    <WardFlowProvider>
      <WardRecoveryNotice />
      {click ? <ClickBeforeAdoption /> : null}
    </WardFlowProvider>,
  );
}

async function settle() {
  for (let i = 0; i < 5; i++) await act(async () => Promise.resolve());
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("the first restore after a click (CS3-17)", () => {
  it("says that anything open was closed, and keeps the notice until it is closed", async () => {
    saveChangedDay();
    mount(true);
    await settle();
    const notice = screen.getByTestId("ward-recovery-notice");
    expect(notice).toHaveTextContent(RESTORED_NOTICE_PREFIX);
    expect(notice).toHaveTextContent(OPEN_ITEMS_CLOSED_NOTICE);
    expect(notice).not.toHaveAttribute("data-routine");
    fireEvent.click(screen.getByRole("button", { name: "Close notice" }));
    expect(screen.queryByTestId("ward-recovery-notice")).toBeNull();
  });

  it("says so after a save a failed write left behind, which still warns of later changes", async () => {
    saveChangedDay({ current: false });
    mount(true);
    await settle();
    const notice = screen.getByTestId("ward-recovery-notice");
    expect(notice).toHaveTextContent("Later changes may not have been saved.");
    expect(notice).toHaveTextContent(OPEN_ITEMS_CLOSED_NOTICE);
    expect(notice).not.toHaveAttribute("data-routine");
  });

  it("stays quiet for a current save when nobody had clicked or typed (WS-13)", async () => {
    saveChangedDay();
    mount(false);
    await settle();
    expect(screen.queryByTestId("ward-recovery-notice")).toBeNull();
  });

  it("leaves the routine notice unchanged when nobody had clicked or typed", async () => {
    saveChangedDay({ current: false });
    mount(false);
    await settle();
    const notice = screen.getByTestId("ward-recovery-notice");
    expect(notice).toHaveTextContent(RESTORED_NOTICE_PREFIX);
    expect(notice).not.toHaveTextContent(OPEN_ITEMS_CLOSED_NOTICE);
    expect(notice).toHaveAttribute("data-routine", "true");
  });

  it("keeps a later save failure on screen after the restore notice was closed", () => {
    const closed = `${RESTORED_NOTICE_PREFIX} 10:00. ${OPEN_ITEMS_CLOSED_NOTICE}`;
    const { rerender } = render(<WardRecoveryNoticeBody notice={closed} fadeAfterMs={5000} />);
    fireEvent.click(screen.getByRole("button", { name: "Close notice" }));
    expect(screen.queryByTestId("ward-recovery-notice")).toBeNull();
    rerender(<WardRecoveryNoticeBody notice={`${STORAGE_UNAVAILABLE} ${closed}`} fadeAfterMs={5000} />);
    expect(screen.getByTestId("ward-recovery-notice")).toHaveTextContent(STORAGE_UNAVAILABLE);
    expect(screen.queryByRole("button", { name: "Close notice" })).toBeNull();
  });
});

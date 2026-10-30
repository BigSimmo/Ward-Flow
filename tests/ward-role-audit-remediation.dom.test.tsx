import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommunityScreenTransportCancelDialog } from "@/components/ward-management/community/community-screen-transport-dialogs";
import { useCommunityScreenTransport } from "@/components/ward-management/community/use-community-screen-overlays";
import type { CommunityScreenView } from "@/components/ward-management/community/community-screen";
import { CANCEL_TRANSPORT_REASONS } from "@/components/ward-management/ward-change-reasons";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const state = seedWardFlowState();
const movement = state.movements[0]!;
const reason = CANCEL_TRANSPORT_REASONS[0]!;

function Harness({ raise }: { raise: WardRaise }) {
  const transport = useCommunityScreenTransport({ raise, teamId: "synthetic-team", now: NOW_ANCHOR });
  const view = { ...transport, movements: [movement], umrnLookup: state } as unknown as CommunityScreenView;
  return (
    <>
      <button type="button" onClick={() => transport.openTransportCancel(movement.id)}>
        Open cancellation
      </button>
      <CommunityScreenTransportCancelDialog view={view} />
    </>
  );
}

function openCancellation(raise: WardRaise) {
  render(<Harness raise={raise} />);
  const opener = screen.getByRole("button", { name: "Open cancellation" });
  opener.focus();
  fireEvent.click(opener);
  const dialog = screen.getByRole("dialog");
  const select = within(dialog).getByRole("combobox");
  fireEvent.change(select, { target: { value: reason } });
  return { opener, dialog, select };
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("community cancellation keeps context until its command is answered", () => {
  it("keeps the chosen reason after a backdrop tap and identifies the person instead of the journey ID", () => {
    const { dialog, select } = openCancellation(vi.fn());
    expect(within(dialog).getByRole("heading")).not.toHaveTextContent(movement.id);
    fireEvent.click(dialog.parentElement!);
    expect(dialog).toBeInTheDocument();
    expect(select).toHaveValue(reason);
  });

  it("blocks dismissal and duplicate submission while pending, then closes after confirmed acceptance", async () => {
    let complete!: (outcome: WardCommandOutcome) => void;
    const raise = vi.fn(
      () =>
        new Promise<WardCommandOutcome>((resolve) => {
          complete = resolve;
        }),
    );
    const { dialog, select, opener } = openCancellation(raise);
    const confirm = within(dialog).getByRole("button", { name: "Confirm cancel" });
    const close = within(dialog).getByRole("button", { name: "Close dialog" });
    fireEvent.click(confirm);
    expect(close).toBeDisabled();
    fireEvent.click(close);
    fireEvent.keyDown(within(dialog).getByRole("button", { name: "Confirm cancel" }), { key: "Escape" });
    fireEvent.click(dialog.parentElement!);
    fireEvent.click(confirm);
    expect(dialog).toBeInTheDocument();
    expect(select).toHaveValue(reason);
    expect(raise).toHaveBeenCalledExactlyOnceWith("CANCEL_TRANSPORT", {
      movementId: movement.id,
      actingPlaceId: "synthetic-team",
      reason,
    });
    await act(async () => complete({ commandId: "synthetic-cancel", status: "accepted" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("permits closing a held offline answer to reach Retry while keeping submission locked", async () => {
    const raise = vi.fn(() =>
      Promise.resolve({
        commandId: "synthetic-held",
        status: "failed" as const,
        message: "Connection unavailable.",
        confirmation: new Promise<WardCommandOutcome>(() => {}),
      }),
    );
    const { dialog, opener } = openCancellation(raise);
    const confirm = within(dialog).getByRole("button", { name: "Confirm cancel" });
    await act(async () => {
      fireEvent.click(confirm);
    });
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    expect(within(dialog).getByText(/Close this dialog to use Retry/)).toBeVisible();
    fireEvent.click(confirm);
    expect(raise).toHaveBeenCalledTimes(1);
    const close = within(dialog).getByRole("button", { name: "Close dialog" });
    expect(close).toBeEnabled();
    fireEvent.click(close);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("keeps a refusal and the selected reason visible, then permits explicit dismissal", async () => {
    const raise = vi.fn(() =>
      Promise.resolve({
        commandId: "synthetic-cancel",
        status: "refused" as const,
        message: "The booking changed. Review it before cancelling.",
      }),
    );
    const { dialog, select, opener } = openCancellation(raise);
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Confirm cancel" }));
    });
    expect(within(dialog).getByRole("alert")).toHaveTextContent("The booking changed");
    expect(select).toHaveValue(reason);
    expect(within(dialog).getByRole("button", { name: "Close dialog" })).toBeEnabled();
    fireEvent.keyDown(within(dialog).getByRole("button", { name: "Confirm cancel" }), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });
});

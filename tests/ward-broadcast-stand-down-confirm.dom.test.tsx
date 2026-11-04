/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmHost } from "@/components/wf/confirm-dialog";
import { BroadcastLiveCard } from "@/components/ward-management/alerts/broadcast-live-card";
import { PullNowCard } from "@/components/ward-management/alerts/global-alert-panels";
import type { BroadcastAlert } from "@/components/ward-management/alerts/ward-broadcast-model";
import { BannerBody } from "@/components/ward-management/shell/ward-broadcast-banner-body";

// Only PullNowCard reads the board. Empty synthetic records isolate the confirmation boundary;
// command permissions and shared persistence remain covered by their existing integration suites.
const lifetime = vi.hoisted(() => ({ enabled: false, epoch: 0, captures: 0 }));
vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return {
    ...actual,
    useWardFlowSelect: () => ({ units: [], movements: [], patients: [], referrals: [] }),
    useWardFlowClock: () => NOW,
    useOptionalWardFlowSelect: () =>
      lifetime.enabled
        ? {
            captureCommandLifetime: () => {
              const epoch = lifetime.epoch;
              lifetime.captures += 1;
              return () => lifetime.epoch === epoch;
            },
          }
        : null,
  };
});

const NOW = 600;
const ALERT: BroadcastAlert = {
  id: "BCAST-CONFIRM-SYNTHETIC",
  kind: "directive",
  title: "Synthetic capacity directive",
  message: "Synthetic directive for confirmation checks.",
  severity: "warning",
  category: "capacity_gridlock",
  targetScope: "all",
  targetScopeLabel: "All synthetic desks",
  durationMinutes: 60,
  dispatchedAt: NOW,
  expiresAt: NOW + 60,
  dispatchedByRole: "coordinator",
  dispatchedByName: "Synthetic coordinator desk",
  status: "active",
  acknowledgedUnits: [],
};

type Surface = "live card" | "shell banner" | "Pull now card";

function StandDownSurface({
  surface,
  alert = ALERT,
  onStandDown,
  enabled = true,
}: {
  surface: Surface;
  alert?: BroadcastAlert;
  onStandDown: () => void;
  enabled?: boolean;
}) {
  if (surface === "Pull now card") {
    return (
      <PullNowCard
        alert={{ ...alert, kind: "pull_now", answerBy: NOW + 30, targetUnitIds: alert.targetUnitIds ?? [] }}
        onStandDown={onStandDown}
      />
    );
  }
  return surface === "live card" ? (
    <BroadcastLiveCard
      alert={alert}
      units={[]}
      now={NOW}
      sentByYou
      acknowledgements={{ acknowledged: 0, of: 0 }}
      onExtend={vi.fn()}
      onAddUnits={vi.fn()}
      onCopyAnswers={vi.fn()}
      onStandDown={onStandDown}
    />
  ) : (
    <BannerBody
      entry={{ alert, tone: "warning", needsAnswer: false }}
      more={0}
      desk={{ role: "coordinator", id: "coordinator-desk" }}
      now={NOW}
      units={[]}
      lookup={{ patients: [], referrals: [], movements: [] }}
      onDispatch={vi.fn()}
      lifecycle={enabled ? { standDown: onStandDown } : undefined}
    />
  );
}

function setup(surface: Surface) {
  const onStandDown = vi.fn();
  const nativeConfirm = vi.spyOn(window, "confirm");
  const view = render(
    <>
      <StandDownSurface surface={surface} onStandDown={onStandDown} />
      <ConfirmHost />
    </>,
  );
  const trigger = screen.getByRole("button", { name: /Stand down/i });
  trigger.focus();
  return { ...view, onStandDown, nativeConfirm, trigger };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  lifetime.enabled = false;
  lifetime.epoch = 0;
  lifetime.captures = 0;
});

describe.each<Surface>(["live card", "shell banner", "Pull now card"])(
  "stand-down confirmation from the %s",
  (surface) => {
    it("asks about this alert and audience, with the safe choice focused and no command yet", async () => {
      const { trigger, onStandDown, nativeConfirm } = setup(surface);
      fireEvent.click(trigger);
      expect(onStandDown).not.toHaveBeenCalled();

      const dialog = await screen.findByRole("alertdialog", { name: "Stand down this alert?" });
      expect(dialog).toHaveTextContent(ALERT.title);
      expect(dialog).toHaveTextContent(ALERT.targetScopeLabel);
      await waitFor(() => expect(within(dialog).getByRole("button", { name: "Keep as is" })).toHaveFocus());
      expect(onStandDown).not.toHaveBeenCalled();
      expect(nativeConfirm).not.toHaveBeenCalled();
    });

    it("keeps the alert active when the person cancels", async () => {
      const { trigger, onStandDown } = setup(surface);
      fireEvent.click(trigger);
      const dialog = await screen.findByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Keep as is" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(onStandDown).not.toHaveBeenCalled();
      expect(trigger).toHaveFocus();
    });

    it("keeps the alert active when Escape dismisses the question", async () => {
      const { trigger, onStandDown } = setup(surface);
      fireEvent.click(trigger);
      const dialog = await screen.findByRole("alertdialog");
      // The lazily loaded dialog attaches its Escape listener in an effect that can land after the
      // node appears on a loaded runner, so repeat the key until the question is dismissed.
      await waitFor(() => {
        fireEvent.keyDown(dialog, { key: "Escape" });
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
      expect(onStandDown).not.toHaveBeenCalled();
    });

    it("runs the original action once after consent despite repeated trigger activation", async () => {
      const { trigger, onStandDown } = setup(surface);
      fireEvent.click(trigger);
      fireEvent.click(trigger);
      const dialog = await screen.findByRole("alertdialog");
      expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
      expect(onStandDown).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole("button", { name: "Stand down" }));
      await waitFor(() => expect(onStandDown).toHaveBeenCalledTimes(1));
    });

    it("cancels pending consent when a different alert replaces the original", async () => {
      const { trigger, onStandDown, rerender } = setup(surface);
      fireEvent.click(trigger);
      const dialog = await screen.findByRole("alertdialog");
      const onReplacementStandDown = vi.fn();
      rerender(
        <>
          <StandDownSurface
            surface={surface}
            alert={{ ...ALERT, id: "BCAST-REPLACEMENT-SYNTHETIC", title: "Replacement synthetic directive" }}
            onStandDown={onReplacementStandDown}
          />
          <ConfirmHost />
        </>,
      );
      expect(dialog).toHaveTextContent(ALERT.title);
      expect(dialog).not.toHaveTextContent("Replacement synthetic directive");
      fireEvent.click(within(dialog).getByRole("button", { name: "Stand down" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(onStandDown).not.toHaveBeenCalled();
      expect(onReplacementStandDown).not.toHaveBeenCalled();
    });

    it("uses the latest committed callback while the same alert remains", async () => {
      lifetime.enabled = true;
      const { trigger, onStandDown, rerender } = setup(surface);
      fireEvent.click(trigger);
      const dialog = await screen.findByRole("alertdialog");
      const onCurrentStandDown = vi.fn();
      rerender(
        <>
          <StandDownSurface surface={surface} onStandDown={onCurrentStandDown} />
          <ConfirmHost />
        </>,
      );
      fireEvent.click(within(dialog).getByRole("button", { name: "Stand down" }));
      await waitFor(() => expect(onCurrentStandDown).toHaveBeenCalledTimes(1));
      expect(onStandDown).not.toHaveBeenCalled();
    });

    it("cancels old consent when the command lifetime changes despite identical alert fields", async () => {
      // The provider's real predicate covers world generation, access epoch and provider disposal.
      // This bounded stand-in changes that lifetime without changing the displayed alert at all.
      lifetime.enabled = true;
      const { trigger, onStandDown, rerender } = setup(surface);
      expect(lifetime.captures).toBe(0);
      fireEvent.click(trigger);
      const dialog = await screen.findByRole("alertdialog");
      expect(lifetime.captures).toBe(1);
      lifetime.epoch += 1;
      const onReloadedStandDown = vi.fn();
      rerender(
        <>
          <StandDownSurface surface={surface} onStandDown={onReloadedStandDown} />
          <ConfirmHost />
        </>,
      );
      expect(dialog).toHaveTextContent(ALERT.title);
      fireEvent.click(within(dialog).getByRole("button", { name: "Stand down" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(onStandDown).not.toHaveBeenCalled();
      expect(onReloadedStandDown).not.toHaveBeenCalled();
    });

    it("cancels consent if the audience changes even when its displayed label stays the same", async () => {
      const { trigger, onStandDown, rerender } = setup(surface);
      fireEvent.click(trigger);
      const dialog = await screen.findByRole("alertdialog");
      rerender(
        <>
          <StandDownSurface
            surface={surface}
            alert={{ ...ALERT, targetUnitIds: ["SYNTHETIC-CHANGED-DESK"] }}
            onStandDown={onStandDown}
          />
          <ConfirmHost />
        </>,
      );
      expect(dialog).toHaveTextContent(ALERT.targetScopeLabel);
      fireEvent.click(within(dialog).getByRole("button", { name: "Stand down" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(onStandDown).not.toHaveBeenCalled();
    });

    it("does not revive consent if the original alert returns after a replacement", async () => {
      const { trigger, onStandDown, rerender } = setup(surface);
      fireEvent.click(trigger);
      const dialog = await screen.findByRole("alertdialog");
      rerender(
        <>
          <StandDownSurface
            surface={surface}
            alert={{ ...ALERT, id: "BCAST-REPLACEMENT-SYNTHETIC" }}
            onStandDown={onStandDown}
          />
          <ConfirmHost />
        </>,
      );
      rerender(
        <>
          <StandDownSurface surface={surface} onStandDown={onStandDown} />
          <ConfirmHost />
        </>,
      );
      fireEvent.click(within(dialog).getByRole("button", { name: "Stand down" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(onStandDown).not.toHaveBeenCalled();
    });

    it("does not run an old action after its surface unmounts while the host stays mounted", async () => {
      const { trigger, onStandDown, rerender } = setup(surface);
      fireEvent.click(trigger);
      const dialog = await screen.findByRole("alertdialog");
      rerender(
        <>
          <span>Alert surface closed</span>
          <ConfirmHost />
        </>,
      );
      fireEvent.click(within(dialog).getByRole("button", { name: "Stand down" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(onStandDown).not.toHaveBeenCalled();
    });

    it("does not run a pending action after its confirmation host unmounts", async () => {
      const { trigger, onStandDown, unmount } = setup(surface);
      fireEvent.click(trigger);
      await screen.findByRole("alertdialog");
      await act(async () => unmount());
      expect(onStandDown).not.toHaveBeenCalled();
    });
  },
);

it("cancels pending banner consent if the permitted lifecycle action is withdrawn", async () => {
  const { trigger, onStandDown, rerender } = setup("shell banner");
  fireEvent.click(trigger);
  const dialog = await screen.findByRole("alertdialog");
  rerender(
    <>
      <StandDownSurface surface="shell banner" enabled={false} onStandDown={onStandDown} />
      <ConfirmHost />
    </>,
  );
  expect(screen.queryByTestId("ward-broadcast-stand-down")).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Stand down" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(onStandDown).not.toHaveBeenCalled();
});

"use client";

import { useEffect, useRef, type ReactNode } from "react";

import type { InboxItem } from "@/components/ward-management/ward-derivations";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useOptionalWardFlowSelect, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { UNDO_WINDOW_TOAST_MS } from "@/components/ward-management/ward-operational-defaults";
import { undoWindowUntil, untilToastTitle } from "@/components/ward-management/ward-undo-until";
import { confirmedWardCommand } from "@/components/ward-management/ward-command-completion";
import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { Button, useOptionalToast } from "@/components/wf";

/**
 * P019 (Josh, 27 Oct 2026, 10:02 PM AWST, "approve the Release wording exactly as shown"): once the
 * coordinator has taken an alert, the button reads "Release". It asks "Hand <alert> back to the
 * queue?", records `RELEASE_INBOX_ITEM_OWNERSHIP`, and the toast "Released <alert>" offers Undo,
 * which takes the alert again. Outside the provider (a screen rendered alone) `fallback` shows.
 *
 * Alerts redesign (Josh, 31 Oct 2026, "Yes to all"): the button and the dialog's confirm say Hand back,
 * because the detail pane's other Release (of a pulled bed) is a different act. The question and the
 * "Released <alert>" toast are unchanged.
 */
export function ReleaseOwnershipButton(props: {
  item: InboxItem;
  subjectLine: string;
  disabledReason?: string;
  fallback: ReactNode;
}) {
  return useOptionalWardFlowSelect() ? <ReleaseOwnershipControl {...props} /> : <>{props.fallback}</>;
}

function ReleaseOwnershipControl({
  item,
  subjectLine,
  disabledReason,
}: {
  item: InboxItem;
  subjectLine: string;
  disabledReason?: string;
}) {
  const raise = useWardRaise("coordinator");
  // The undo runs later, so it raises through the latest clock, not the one at the time of the click.
  const raiseRef = useRef(raise);
  useEffect(() => {
    raiseRef.current = raise;
  }, [raise]);
  const toast = useOptionalToast();
  // D-192: the toast names one clock time, counted on the board clock from the press.
  const now = useWardFlowClock();
  const nowRef = useRef(now);
  useEffect(() => {
    nowRef.current = now;
  }, [now]);

  // Simplification R2 (mock-up, 26 Nov 2026): Hand back is one tap. The toast's Undo takes the
  // alert again, so the "Hand <alert> back to the queue?" question is no longer asked first.
  function confirm() {
    const inboxItemId = item.id;
    const complete = (result: ReturnType<WardCommandDispatch>, accepted: (outcome: WardCommandOutcome) => void) => {
      const failed = () => toast?.push({ tone: "warning", title: SAVE_NOT_CONFIRMED });
      const read = (outcome: WardCommandOutcome): void => {
        if (outcome.isCurrent && !outcome.isCurrent()) return;
        if (outcome.confirmation) {
          void outcome.confirmation.then(read, failed);
          return;
        }
        if (outcome.status === "accepted") accepted(outcome);
        else
          toast?.push({
            tone: "warning",
            title:
              outcome.status === "refused"
                ? `Not recorded: ${outcome.message ?? "The action was refused."}`
                : (outcome.message ?? SAVE_NOT_CONFIRMED),
          });
      };
      const completion = confirmedWardCommand(result);
      if ("then" in completion) void completion.then(read, failed);
      else read(completion);
    };
    complete(raiseRef.current("RELEASE_INBOX_ITEM_OWNERSHIP", { inboxItemId }), (outcome) => {
      toast?.push({
        tone: "success",
        title: untilToastTitle(`Released ${item.title}`),
        undo: {
          until: undoWindowUntil(nowRef.current),
          durationMs: UNDO_WINDOW_TOAST_MS,
          onUndo: () => {
            if (outcome.isCurrent && !outcome.isCurrent()) {
              toast.push({
                tone: "warning",
                title: "Undo is unavailable because the workspace or working role changed. Review the current board.",
              });
              return;
            }
            if (outcome.canUndo && !outcome.canUndo()) {
              toast.push({
                tone: "warning",
                title:
                  "Undo is unavailable until the shared board is ready. Wait for it to reconnect, then check the board.",
              });
              return false;
            }
            complete(raiseRef.current("TAKE_INBOX_ITEM_OWNERSHIP", { inboxItemId }), () => {});
            return;
          },
        },
      });
    });
  }

  return (
    <>
      <Button
        size="sm"
        disabledReason={disabledReason}
        reasonDisplay="tooltip"
        aria-label={`Hand back ${subjectLine}`}
        onClick={confirm}
      >
        Hand back
      </Button>
    </>
  );
}

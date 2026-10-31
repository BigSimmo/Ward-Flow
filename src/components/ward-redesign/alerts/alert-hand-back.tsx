"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import type { InboxItem } from "@/components/ward-management/ward-derivations";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { UNDO_TOAST_MS } from "@/components/ward-management/ward-operational-defaults";
import { Button, Dialog, useOptionalToast } from "@/components/wf";

/**
 * P019 (Josh, 27 Oct 2026, 10:02 PM AWST, "approve the Release wording exactly as shown"): once the
 * coordinator has taken an alert, the button reads "Release". It asks "Hand <alert> back to the
 * queue?", records `RELEASE_INBOX_ITEM_OWNERSHIP`, and the toast "Released <alert>" offers Undo,
 * which takes the alert again. Outside the provider (a screen rendered alone) `fallback` shows.
 */
/** Preview only: a fork of `ReleaseOwnershipButton` named for what it does. */
export function HandBackButton(props: {
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
  const [asking, setAsking] = useState(false);

  function confirm() {
    setAsking(false);
    const inboxItemId = item.id;
    raiseRef.current("RELEASE_INBOX_ITEM_OWNERSHIP", { inboxItemId });
    toast?.push({
      tone: "success",
      title: `Released ${item.title}`,
      undo: {
        durationMs: UNDO_TOAST_MS,
        onUndo: () => {
          raiseRef.current("TAKE_INBOX_ITEM_OWNERSHIP", { inboxItemId });
        },
      },
    });
  }

  return (
    <>
      <Button
        size="sm"
        disabledReason={disabledReason}
        reasonDisplay="tooltip"
        aria-label={`Hand back ${subjectLine}`}
        onClick={() => setAsking(true)}
      >
        {/* Redesign: "Release" here meant handing the alert back, beside a different Release. */}
        Hand back
      </Button>
      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        title={`Hand ${item.title} back to the queue?`}
        size="sm"
        primary={{ label: "Hand back", onAction: confirm }}
        secondary={[{ label: "Cancel", onAction: () => setAsking(false) }]}
        data-testid="alerts-release-ownership-confirm"
      />
    </>
  );
}

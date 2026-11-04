"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { Button } from "@/components/wf";
import { SharedAccessContext } from "../shell/ward-shared-access-context";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import { useWardNavCounts } from "../use-ward-nav-counts";
import { useEffectiveWardAccess } from "../shell/ward-access-store";
import { confirmedWardCommand } from "../ward-command-completion";
import type { OwnCommandReceipt } from "../ward-own-command-receipt";
import { activityUndo } from "./activity-undo";
import styles from "./home-activity.module.css";

type Review = { status: "closed" | "loading" | "failed" } | { status: "ready"; receipt: OwnCommandReceipt | null };

/** Only explicit review reads a receipt. An opaque command ID never opens a patient record. */
export function ActivityOwnCommand(props: { commandId: string; autoReview?: boolean }) {
  const access = useContext(SharedAccessContext);
  return <ActivityOwnCommandBody key={`${access?.actorId}:${access?.scopeKey}:${props.commandId}`} {...props} />;
}
function ActivityOwnCommandBody({ commandId, autoReview = false }: { commandId: string; autoReview?: boolean }) {
  const access = useContext(SharedAccessContext);
  const read = access?.api.readOwnCommand;
  const owner = `${access?.actorId ?? ""}:${access?.scopeKey ?? ""}`;
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [review, setReview] = useState<Review>({ status: autoReview ? "loading" : "closed" });
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const { undoRecords, movements, referrals, admissions, dispatch } = useWardFlowSelect(
    "undoRecords",
    "movements",
    "referrals",
    "admissions",
    "dispatch",
  );
  const now = useWardFlowClock();
  const { placeId: routePlaceId } = useWardNavCounts();
  const { role: accessRole, scope } = useEffectiveWardAccess();
  const role = accessRole === "admin" ? "executive" : accessRole;
  const placeId = routePlaceId ?? (scope.kind === "ward" && scope.unitIds.length === 1 ? scope.unitIds[0] : undefined);
  const load = async () => {
    if (!read) return;
    setReview({ status: "loading" });
    try {
      const receipt = await read(commandId);
      if (active.current) setReview({ status: "ready", receipt });
    } catch {
      if (active.current) setReview({ status: "failed" });
    }
  };
  useEffect(() => {
    if (!autoReview || !read) return;
    let current = true;
    void read(commandId).then(
      (receipt) => {
        if (current) setReview({ status: "ready", receipt });
      },
      () => {
        if (current) setReview({ status: "failed" });
      },
    );
    return () => {
      current = false;
    };
  }, [autoReview, commandId, owner, read]);
  if (!read) return null;
  const receipt = review.status === "ready" ? review.receipt : undefined;
  const offer = activityUndo(receipt?.undoStep, undoRecords, { movements, referrals, admissions }, role, placeId, now);
  const undo = async () => {
    if (!offer.event || sending) return;
    setSending(true);
    setMessage("Undoing… Waiting for the shared board.");
    try {
      const result = await confirmedWardCommand(dispatch(offer.event));
      if (!active.current || (result.isCurrent && !result.isCurrent())) return;
      setMessage(
        result.status === "accepted"
          ? "Undone. The shared board confirmed the change."
          : result.status === "refused"
            ? `Undo refused. ${result.message ?? "Review the current board."}`
            : "Undo is not confirmed. Check the current board before trying again.",
      );
    } catch {
      if (active.current) setMessage("Undo is not confirmed. Check the current board before trying again.");
    } finally {
      if (active.current) setSending(false);
    }
  };
  return (
    <div className={styles.ownCommand} data-own-command-id={commandId}>
      {review.status === "closed" || review.status === "failed" ? (
        <Button size="sm" variant="ghost" onClick={() => void load()}>
          {review.status === "failed" ? "Retry checking your change" : "Review your change"}
        </Button>
      ) : null}
      {review.status === "loading" ? <p role="status">Checking your change…</p> : null}
      {review.status === "failed" ? (
        <p role="status">Your change could not be checked. Review the current board.</p>
      ) : null}
      {review.status === "ready" ? (
        <>
          <p>
            {!receipt
              ? "No receipt is available for this change. It may have expired. Check the current board."
              : receipt.outcome === "refused"
                ? "This change was refused. Nothing to undo."
                : receipt.outcome === "partly"
                  ? "This change was partly recorded. Check the current board."
                  : "Your change was recorded."}
          </p>
          {receipt && receipt.outcome !== "refused" ? (
            offer.event && !message.startsWith("Undone.") ? (
              <Button size="sm" variant="ghost" disabled={sending} onClick={() => void undo()}>
                Undo this change
              </Button>
            ) : (
              <p>{offer.reason}</p>
            )
          ) : null}
        </>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}

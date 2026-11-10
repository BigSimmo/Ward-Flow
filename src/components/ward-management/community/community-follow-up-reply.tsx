"use client";

import { useState } from "react";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { confirmedWardCommand } from "@/components/ward-management/ward-command-completion";
import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";
import type { ActionToast } from "@/components/ward-management/ward-action-toast";
import type { Admission } from "@/components/ward-management/ward-admissions";
import {
  FOLLOW_UP_DECLINE_REASONS,
  FOLLOW_UP_REPLIES,
  FOLLOW_UP_REPLY_LABELS,
  type FollowUpDeclineReason,
  type FollowUpReplyState,
} from "@/components/ward-management/ward-discharge-checklist";
import { ChoiceChips } from "../ward/ward-bed-dossier-bits";
import styles from "./community.module.css";

/**
 * Feature 13 (9 Nov 2026): the community team answers whether it will follow this person up after
 * discharge: awaiting reply, accepted, or declined with a listed reason. The ward sees the answer on
 * the Discharges board and in the discharge checklist. Chosen, never typed.
 */
export function CommunityFollowUpReply({
  admission,
  teamId,
  onMessage,
}: {
  admission: Pick<Admission, "id" | "followUpReply">;
  teamId: string;
  onMessage: (message: ActionToast) => void;
}) {
  const raise = useWardRaise("community");
  const recorded = admission.followUpReply;
  const [declining, setDeclining] = useState(false);
  const shown: FollowUpReplyState | "" = declining ? "declined" : (recorded?.state ?? "");
  const send = (reply: FollowUpReplyState, declineReason?: FollowUpDeclineReason) => {
    void Promise.resolve(
      confirmedWardCommand(
        raise("RECORD_FOLLOW_UP_REPLY", {
          actingTeamId: teamId,
          admissionId: admission.id,
          reply,
          ...(declineReason ? { declineReason } : {}),
        }),
      ),
    )
      .then((outcome) => {
        // Only a confirmed save is called recorded; anything short of a refusal may still save on Retry.
        if (outcome.status === "accepted") {
          setDeclining(false);
          onMessage("Follow-up reply recorded. The ward sees it on the discharge board.");
        } else if (outcome.status === "refused")
          onMessage({ warning: `Reply not recorded. ${outcome.message ?? ""}`.trim() });
        else onMessage({ warning: outcome.message ?? SAVE_NOT_CONFIRMED });
      })
      .catch(() => onMessage({ warning: SAVE_NOT_CONFIRMED }));
  };
  return (
    <div className={styles.followUpReply} data-testid={`ward-community-follow-up-reply-${admission.id}`}>
      <div>
        <span className={styles.followUpReplyLabel}>Follow-up reply</span>
        <ChoiceChips
          label="Follow-up reply"
          items={FOLLOW_UP_REPLIES.map((reply) => ({ id: reply, label: FOLLOW_UP_REPLY_LABELS[reply] }))}
          value={shown}
          onChange={(value) => {
            if (value === "declined") setDeclining(true);
            else send(value);
          }}
        />
      </div>
      {shown === "declined" ? (
        <div>
          <span className={styles.followUpReplyLabel}>Reason declined</span>
          <ChoiceChips
            label="Reason declined"
            items={FOLLOW_UP_DECLINE_REASONS.map((reason) => ({ id: reason, label: reason }))}
            value={declining ? "" : (recorded?.reason ?? "")}
            onChange={(reason) => send("declined", reason)}
          />
        </div>
      ) : null}
    </div>
  );
}

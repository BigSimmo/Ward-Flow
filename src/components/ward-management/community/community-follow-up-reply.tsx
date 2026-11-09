"use client";

import { useState } from "react";
import { Field, Select } from "@/components/wf";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import type { ActionToast } from "@/components/ward-management/ward-action-toast";
import type { Admission } from "@/components/ward-management/ward-admissions";
import {
  FOLLOW_UP_DECLINE_REASONS,
  FOLLOW_UP_REPLIES,
  FOLLOW_UP_REPLY_LABELS,
  isFollowUpDeclineReason,
  isFollowUpReplyState,
  type FollowUpDeclineReason,
  type FollowUpReplyState,
} from "@/components/ward-management/ward-discharge-checklist";
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
      raise("RECORD_FOLLOW_UP_REPLY", {
        actingTeamId: teamId,
        admissionId: admission.id,
        reply,
        ...(declineReason ? { declineReason } : {}),
      }),
    ).then((outcome) => {
      if (outcome?.status === "refused") onMessage({ warning: `Reply not recorded. ${outcome.message ?? ""}`.trim() });
      else {
        setDeclining(false);
        onMessage("Follow-up reply recorded. The ward sees it on the discharge board.");
      }
    });
  };
  return (
    <div className={styles.followUpReply} data-testid={`ward-community-follow-up-reply-${admission.id}`}>
      <Field label="Follow-up reply">
        <Select
          value={shown}
          onChange={(event) => {
            const value = event.target.value;
            if (!isFollowUpReplyState(value)) return;
            if (value === "declined") setDeclining(true);
            else send(value);
          }}
        >
          {recorded ? null : <option value="">Not answered</option>}
          {FOLLOW_UP_REPLIES.map((reply) => (
            <option key={reply} value={reply}>
              {FOLLOW_UP_REPLY_LABELS[reply]}
            </option>
          ))}
        </Select>
      </Field>
      {shown === "declined" ? (
        <Field label="Reason declined">
          <Select
            value={declining ? "" : (recorded?.reason ?? "")}
            onChange={(event) => {
              const value = event.target.value;
              if (isFollowUpDeclineReason(value)) send("declined", value);
            }}
          >
            {declining ? <option value="">Choose a reason</option> : null}
            {FOLLOW_UP_DECLINE_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
    </div>
  );
}

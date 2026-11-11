import { Badge, SrOnly } from "@/components/wf";
import type { DischargeRecord } from "@/components/ward-management/ward-discharge-records";
import type { DischargeDependency } from "./discharge-dependencies";
import {
  dischargeChecklist,
  dischargeChecklistTally,
  followUpReplyWords,
} from "@/components/ward-management/ward-discharge-checklist";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { communityFirstContactWords } from "./community-first-contact";
import styles from "./discharge-slipping-list.module.css";

/**
 * Features 37 and 13 (9 Nov 2026) on a Discharges board row: how many of the four checklist items
 * are settled ("2 of 4"), and the community team's follow-up reply once it has given one. Item 22:
 * beside the reply, the date the community team first saw them, once it has recorded one.
 */
export function DischargeChecklistTag({
  record,
  dependencies,
  showChecklist = true,
}: {
  record: DischargeRecord;
  dependencies?: readonly DischargeDependency[];
  showChecklist?: boolean;
}) {
  const { settled, total } = dischargeChecklistTally(dischargeChecklist({ ...record, dependencies }));
  const reply = followUpReplyWords(record.followUpReply);
  const dayZero = useOptionalWardFlowSelect("dayZero")?.dayZero;
  const firstSeen = dayZero ? communityFirstContactWords(record, dayZero) : null;
  return (
    <span className={styles.tags} data-testid={`ward-discharge-checklist-tag-${record.admissionId}`}>
      {showChecklist ? (
        <>
          <SrOnly>, discharge checklist </SrOnly>
          <Badge size="sm" tone={settled === total ? "success" : "neutral"}>
            <span aria-hidden="true">Checklist </span>
            <span className={styles.figure}>
              {settled}/{total}
            </span>
            <SrOnly>
              {" "}
              ({settled} of {total} settled)
            </SrOnly>
          </Badge>
        </>
      ) : null}
      {reply ? (
        <>
          <SrOnly>, community team </SrOnly>
          <Badge size="sm" tone={record.followUpReply?.state === "declined" ? "warning" : "neutral"}>
            <span aria-hidden="true">Team </span>
            {reply}
          </Badge>
        </>
      ) : null}
      {firstSeen ? (
        <span className={styles.firstSeen} data-testid={`ward-discharge-first-contact-${record.admissionId}`}>
          <SrOnly>, </SrOnly>
          {firstSeen}
        </span>
      ) : null}
    </span>
  );
}

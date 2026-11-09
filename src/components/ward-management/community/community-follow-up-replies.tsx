"use client";

import { Card, CardHead } from "@/components/wf";
import type { ActionToast } from "@/components/ward-management/ward-action-toast";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { CommunityFollowUpReply } from "./community-follow-up-reply";
import { expectedBackLabel, unitName } from "./community-screen-helpers";
import styles from "./community.module.css";

/**
 * Feature 13 (polish pass, 9 Nov 2026): the follow-up reply on a team whose In hospital section is the
 * drawn Midland demo. Those rows are illustrative, so the people the engine holds for this team with a
 * written discharge date are listed here, each with its reply control, on desktop and phone alike.
 */
export function CommunityFollowUpReplies({
  admissions,
  teamId,
  units,
  now,
  umrnLookup,
  onMessage,
}: {
  admissions: readonly Admission[];
  umrnLookup: Parameters<typeof resolveSubjectPatient>[1];
  teamId: string;
  units: readonly Unit[];
  now: Instant;
  onMessage: (message: ActionToast) => void;
}) {
  if (admissions.length === 0) return null;
  return (
    <Card as="section" aria-labelledby="community-follow-up-replies" data-testid="ward-community-follow-up-replies">
      <CardHead
        title={<span id="community-follow-up-replies">Follow-up replies</span>}
        meta={`${admissions.length} with a discharge date`}
      />
      <ul className={styles.followUpReplies}>
        {admissions.map((admission) => {
          // D-39: named by name and UMRN through the resolver, as the In bed list names them.
          const person = resolveSubjectPatient(admission, umrnLookup);
          return (
            <li key={admission.id}>
              <div className={styles.followUpPerson}>
                <span className={styles.personName}>{person.formalName}</span>
                <span className={styles.personMeta}>
                  <span className={styles.personUmrn}>{person.umrn}</span> · {unitName(admission.unitId, units)}
                </span>
                <span className={styles.personMeta}>{expectedBackLabel(admission, now)}</span>
              </div>
              <CommunityFollowUpReply admission={admission} teamId={teamId} onMessage={onMessage} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

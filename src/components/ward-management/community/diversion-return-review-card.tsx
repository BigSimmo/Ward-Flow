"use client";

import { useCallback, useId } from "react";
import { RotateCcw } from "lucide-react";

import { Card, CardBody, CardHead } from "@/components/wf";
import { formatInstantWithDay, MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { useDiversionReturnPrompts } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { namesTeam, type CommunityTeam } from "./community-derivations";
import styles from "../out-of-area/return-early-alerts.module.css";

/** The signed window (D-136), read from the register, never typed here. */
const WINDOW_MINUTES = CLINICAL_VALUES.diversionReturnReview.value * MINUTES_PER_DAY;

/**
 * Batch 3 item 28 (D-136): "Please review: returned to ED", on the page of the community team that
 * took the person. A review prompt only: no reason, diagnosis, risk or score, and nothing stored.
 * Renders nothing when this team has no one to review.
 */
export function DiversionReturnReview({ team, now }: { team: CommunityTeam; now: Instant }) {
  const headingId = useId();
  const patientOf = usePatientOf();
  const matchesTeam = useCallback((teamName: string | undefined) => namesTeam(teamName, team), [team]);
  const prompts = useDiversionReturnPrompts(matchesTeam, WINDOW_MINUTES);
  if (prompts.length === 0) return null;
  return (
    <Card aria-labelledby={headingId} data-testid="community-diversion-return-review">
      <CardHead
        id={headingId}
        icon={RotateCcw}
        iconPlain
        title="Please review: returned to ED"
        meta={`${prompts.length} ${prompts.length === 1 ? "person" : "people"}`}
      />
      <CardBody>
        <ul className={styles.list}>
          {prompts.map((prompt) => (
            <li key={prompt.id} className={styles.row} data-testid="community-diversion-return-row">
              <span>{patientOf(prompt.subject).formalName}</span>
              <span className={styles.when}>Back in ED {formatInstantWithDay(prompt.returnedAt, now)}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

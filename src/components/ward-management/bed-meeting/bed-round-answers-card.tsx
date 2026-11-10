"use client";

import { useId, useState } from "react";

import { Card, CardBody, CardHead, FilterChip, ShowMoreRow, StatusGlyph, foldLimit } from "@/components/wf";

import { formatInstantWithDay } from "../ward-clock";
import { useWardFlowSelect } from "../ward-flow-provider";
import type { HealthService } from "../ward-model-vocabulary";
import { unitHealthService } from "../ward-service-scope";
import { bedRoundAnswers, notConfirmedOnly } from "./bed-round-answers";
import styles from "./bed-meeting-agenda.module.css";

/** Wards shown before "Show N more" (DESIGN-SYSTEM section 4 folds at about eight). */
const WARDS_SHOWN = 8;

/**
 * Bed round answers (batch 3 item 12): each ward's answer to "Please confirm your beds", in the
 * fixed ward order (D-126). Read only; the filter is this page's own state and is never stored.
 */
export function BedRoundAnswersCard({ service }: { service: HealthService | null }) {
  const { units, broadcastAlerts, now } = useWardFlowSelect("units", "broadcastAlerts", "now");
  const [notConfirmed, setNotConfirmed] = useState(false);
  const [all, setAll] = useState(false);
  const listId = useId();

  const scoped = service === null ? units : units.filter((unit) => unitHealthService(unit) === service);
  const answers = bedRoundAnswers(scoped, broadcastAlerts, now);
  const missing = notConfirmedOnly(answers);
  const shown = notConfirmed ? missing : answers;
  const limit = all ? shown.length : foldLimit(shown.length, WARDS_SHOWN);

  return (
    <Card data-testid="bed-meeting-agenda-bed-round" id="agenda-bed-round" className={styles.anchored}>
      <CardHead
        title="Bed round"
        meta={`${answers.length - missing.length} of ${answers.length} confirmed`}
        level={2}
        action={
          answers.length > 0 ? (
            <FilterChip pressed={notConfirmed} onPressedChange={setNotConfirmed} count={missing.length}>
              Not confirmed
            </FilterChip>
          ) : undefined
        }
      />
      <CardBody>
        {shown.length === 0 ? (
          <p className={styles.note}>{answers.length === 0 ? "No wards in this service." : "Every ward confirmed."}</p>
        ) : (
          <>
            <ul className={styles.list} id={listId} data-testid="bed-round-list">
              {shown.slice(0, limit).map((answer) => (
                <li key={answer.unit.id} className={styles.row} data-testid="bed-round-ward">
                  <span className={styles.name}>{answer.unit.name}</span>
                  <span className={styles.detail}>
                    {answer.confirmedAt !== undefined ? (
                      `Confirmed ${formatInstantWithDay(answer.confirmedAt, now)}`
                    ) : (
                      <>
                        <StatusGlyph tone="warning" size={8} /> Not confirmed
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {limit < shown.length || all ? (
              <ShowMoreRow onClick={() => setAll((value) => !value)} expanded={all} controls={listId}>
                {all ? "Show fewer" : `Show ${shown.length - limit} more`}
              </ShowMoreRow>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}

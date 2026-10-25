"use client";

// src/components/ward-management/reports/fixed-questions-card.tsx
//
// "Ask a question" (closing-the-loop features, Josh, 24 Oct 2026): a fixed menu of plain questions,
// each answered from the record by `fixedQuestionAnswers`. No typing, no AI, no ranking. Each answer
// row links to the record it came from; the panel itself changes nothing.
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { MessageCircleQuestion } from "lucide-react";

import { CardBody } from "@/components/wf";
import { StatCard } from "@/components/ward-management/statistics/statistics-hero";
import { dischargeHref, movementHref } from "@/components/ward-management/shell/ward-facade";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease, Movement, Unit } from "@/components/ward-management/ward-model";

import { fixedQuestionAnswers, type FixedAnswerSource, type FixedQuestionId } from "./fixed-questions";
import styles from "./closing-loop.module.css";

function sourceHref(source: FixedAnswerSource): string {
  return source.kind === "movement" ? movementHref(source.id) : dischargeHref(source.admissionId);
}

export function FixedQuestionsCard({
  movements,
  bedReleases,
  admissions,
  units,
  now,
}: {
  movements: readonly Movement[];
  bedReleases: readonly BedRelease[];
  admissions: readonly Admission[];
  units: readonly Unit[];
  now: Instant;
}) {
  const answers = useMemo(
    () => fixedQuestionAnswers({ movements, bedReleases, admissions, units, now }),
    [movements, bedReleases, admissions, units, now],
  );
  const [chosen, setChosen] = useState<FixedQuestionId | null>(null);
  const answerId = useId();
  const answer = answers.find((each) => each.id === chosen);

  return (
    <StatCard
      id="fixed-questions"
      icon={MessageCircleQuestion}
      title="Ask a question"
      meta="Fixed questions, answered from the record"
      data-testid="ward-statistics-fixed-questions"
    >
      <CardBody>
        <ul className={styles.questions}>
          {answers.map((each) => (
            <li key={each.id}>
              <button
                type="button"
                className={styles.question}
                aria-expanded={chosen === each.id}
                aria-controls={answerId}
                onClick={() => setChosen(chosen === each.id ? null : each.id)}
                data-testid={`ward-fixed-question-${each.id}`}
              >
                <span>{each.question}</span>
                <span className={styles.count}>{each.rows.length}</span>
              </button>
            </li>
          ))}
        </ul>
        <div id={answerId} aria-live="polite">
          {answer ? (
            <>
              <h3 className={styles.listHead}>{answer.question}</h3>
              <p className={styles.caption}>{answer.basis}</p>
              {answer.rows.length === 0 ? (
                <p className={styles.caption} data-testid="ward-fixed-answer-empty">
                  None on record now.
                </p>
              ) : (
                <ul className={styles.list} data-testid="ward-fixed-answer">
                  {answer.rows.map((row) => (
                    <li key={row.key}>
                      <Link href={sourceHref(row.source)}>{row.label}</Link>
                      <span className={styles.sub}>{row.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className={styles.caption}>Choose a question. Answers keep the order they were recorded in.</p>
          )}
        </div>
      </CardBody>
    </StatCard>
  );
}

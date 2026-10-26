"use client";

import { useId, useState } from "react";

import { Button, StatusGlyph } from "@/components/wf";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useOptionalWardFlowSelect, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import { siteDirectory } from "@/components/ward-management/ward-sites";

import {
  HOME_SERVICE_ANSWERS,
  HOME_SERVICE_ANSWER_LABELS,
  RETURN_PREREQUISITES,
  RETURN_PREREQUISITE_LABELS,
  RETURN_REVIEW_DAY_CHOICES,
  homeServiceReturnOf,
  homeServiceReturnStage,
  reviewDayInstant,
  reviewDayText,
  type HomeServiceAnswer,
  type ReturnPrerequisite,
} from "./home-service-return";
import { shortSiteName } from "./out-of-area-model";
import styles from "./home-service-return.module.css";

/**
 * Closing-the-loop (package E): "Return requested" and "Home service agreed" as two recorded steps
 * inside the return plan, each with the desk and the time. Records only; see `home-service-return.ts`.
 */
function dayChoiceLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function ReviewDaySelect({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return (
    <span className={styles.field}>
      <label htmlFor={id}>Next review</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">No date set</option>
        {RETURN_REVIEW_DAY_CHOICES.map((days) => (
          <option key={days} value={String(days)}>
            {dayChoiceLabel(days)}
          </option>
        ))}
      </select>
    </span>
  );
}

export function HomeServiceReturnPanel({
  admissionId,
  presetHospital,
}: {
  admissionId: string;
  /** The site already chosen in the plan, if any; the coordinator can change it. */
  presetHospital?: string;
}) {
  const records = useOptionalWardFlowSelect("homeServiceReturns")?.homeServiceReturns;
  const raise = useWardRaise("coordinator");
  const now = useWardFlowClock();
  const ids = useId();
  const record = homeServiceReturnOf(records, admissionId);
  const stage = homeServiceReturnStage(record);

  const [hospital, setHospital] = useState(presetHospital ?? "");
  const [answer, setAnswer] = useState<HomeServiceAnswer | undefined>(record?.answer);
  const [prerequisites, setPrerequisites] = useState<ReturnPrerequisite[]>(record?.prerequisites ?? []);
  const [reviewDays, setReviewDays] = useState("");
  const [askAgain, setAskAgain] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const reviewAt = reviewDays === "" ? undefined : reviewDayInstant(now, Number(reviewDays));
  const by = (role: keyof typeof WARD_FLOW_ROLE_LABELS) => WARD_FLOW_ROLE_LABELS[role];
  const showRequestForm = !record || askAgain || record.answer === "declined";

  const requestReturn = () => {
    if (!hospital) return;
    raise("RECORD_HOME_SERVICE_RETURN", {
      admissionId,
      step: "requested",
      homeHospital: hospital,
      ...(reviewAt !== undefined ? { nextReviewAt: reviewAt } : {}),
    });
    setAnswer(undefined);
    setPrerequisites([]);
    setReviewDays("");
    setAskAgain(false);
    setStatus(`Return requested from ${shortSiteName(hospital)}.`);
  };

  const recordAnswer = () => {
    if (!answer) return;
    raise("RECORD_HOME_SERVICE_RETURN", {
      admissionId,
      step: "answered",
      answer,
      prerequisites: answer === "declined" ? [] : prerequisites,
      ...(reviewAt !== undefined ? { nextReviewAt: reviewAt } : {}),
    });
    setReviewDays("");
    setStatus(`Home service answer recorded: ${HOME_SERVICE_ANSWER_LABELS[answer]}.`);
  };

  return (
    <section className={styles.panel} aria-labelledby={`${ids}-title`} data-testid="ward-home-service-return">
      <h4 className={styles.title} id={`${ids}-title`}>
        Home service
      </h4>

      <ol className={styles.steps} aria-label="Return to the home service">
        <li data-step="requested" data-done={record ? "true" : undefined}>
          <StatusGlyph tone={record ? "success" : "neutral"} size={9} />
          {record ? (
            <span>
              <b>Return requested</b> from {shortSiteName(record.homeHospital)},{" "}
              {formatInstantWithDay(record.requestedAt, now)} by {by(record.requestedBy)}
            </span>
          ) : (
            <span>Return not requested yet</span>
          )}
        </li>
        <li data-step="agreed" data-done={stage === "agreed" ? "true" : undefined}>
          <StatusGlyph
            tone={stage === "agreed" ? "success" : record?.answer === "declined" ? "closed" : "neutral"}
            size={9}
          />
          {record?.answer && record.answeredAt !== undefined && record.answeredBy ? (
            <span>
              <b>{record.answer === "agreed" ? "Home service agreed" : HOME_SERVICE_ANSWER_LABELS[record.answer]}</b>,{" "}
              {formatInstantWithDay(record.answeredAt, now)} by {by(record.answeredBy)}
            </span>
          ) : (
            <span>Home service has not answered</span>
          )}
        </li>
      </ol>

      {record && record.prerequisites.length > 0 ? (
        <div className={styles.agreed}>
          <p className={styles.label}>Agreed before return</p>
          <ul className={styles.prereqList}>
            {record.prerequisites.map((item) => (
              <li key={item}>{RETURN_PREREQUISITE_LABELS[item]}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {record?.nextReviewAt !== undefined ? (
        <p className={styles.review} data-testid="ward-home-service-review">
          {reviewDayText(record.nextReviewAt, now)}
        </p>
      ) : null}

      {status ? (
        <p className={styles.status} role="status">
          {status}
        </p>
      ) : null}

      {showRequestForm ? (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            requestReturn();
          }}
        >
          <span className={styles.field}>
            <label htmlFor={`${ids}-hospital`}>Home service asked</label>
            <select id={`${ids}-hospital`} value={hospital} onChange={(event) => setHospital(event.target.value)}>
              <option value="">Choose a hospital</option>
              {siteDirectory.map((site) => (
                <option key={site.code} value={site.code}>
                  {site.name}
                </option>
              ))}
            </select>
          </span>
          <ReviewDaySelect id={`${ids}-review-request`} value={reviewDays} onChange={setReviewDays} />
          <Button type="submit" size="sm" disabled={!hospital}>
            Record return requested
          </Button>
        </form>
      ) : (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            recordAnswer();
          }}
        >
          <fieldset className={styles.fieldset}>
            <legend>Home service answer</legend>
            {HOME_SERVICE_ANSWERS.map((value) => (
              <label key={value} className={styles.option}>
                <input
                  type="radio"
                  name={`${ids}-answer`}
                  value={value}
                  checked={answer === value}
                  onChange={() => setAnswer(value)}
                />
                {HOME_SERVICE_ANSWER_LABELS[value]}
              </label>
            ))}
          </fieldset>
          <fieldset className={styles.fieldset} disabled={answer === "declined"}>
            <legend>Agreed before return</legend>
            {RETURN_PREREQUISITES.map((item) => (
              <label key={item} className={styles.option}>
                <input
                  type="checkbox"
                  checked={answer !== "declined" && prerequisites.includes(item)}
                  onChange={(event) =>
                    setPrerequisites((current) =>
                      event.target.checked ? [...current, item] : current.filter((entry) => entry !== item),
                    )
                  }
                />
                {RETURN_PREREQUISITE_LABELS[item]}
              </label>
            ))}
          </fieldset>
          <ReviewDaySelect id={`${ids}-review-answer`} value={reviewDays} onChange={setReviewDays} />
          <span className={styles.actions}>
            <Button type="submit" size="sm" disabled={!answer}>
              Record home service answer
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAskAgain(true)}>
              Ask another service
            </Button>
          </span>
        </form>
      )}
    </section>
  );
}

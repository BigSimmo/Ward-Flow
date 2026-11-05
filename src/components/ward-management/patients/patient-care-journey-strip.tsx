"use client";

// PT1 round 3: the patient's journey as one simple line in the band (Josh, 3 Nov 2026 22:29Z).
// Six steps, the current one lit. Presentation only; `patient-care-journey.ts` decides each step
// from the record. The steps are plain text, so a screen reader hears "Step 4 of 6, On ward,
// Day 7, current". Tapping the line opens History, where each recorded change has its time.
import type { ReactNode } from "react";
import { StatusGlyph } from "@/components/wf";
import type { CareStep } from "./patient-care-journey";
import styles from "./patient-care-journey.module.css";

const SPOKEN: Record<CareStep["state"], string> = { done: "done", now: "current", next: "still to come" };

export const journeyToggleClass = styles.history;

export function PatientCareJourneyStrip({
  steps,
  onOpenHistory,
  extra,
}: {
  steps: CareStep[];
  onOpenHistory?: () => void;
  /** A control that replaces Full history, such as the placement's seven stages. */
  extra?: ReactNode;
}) {
  const current = steps.findIndex((step) => step.state === "now");
  return (
    <div className={styles.wrap} data-testid="ward-patient-care-journey">
      <ol className={styles.steps} aria-label="Movement steps">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={styles.step}
            data-state={step.state}
            aria-current={step.state === "now" ? "step" : undefined}
            data-testid={`ward-patient-care-journey-${step.id}`}
          >
            <span className={styles.mark} aria-hidden="true">
              {step.state === "done" ? (
                <StatusGlyph tone="success" size={10} />
              ) : step.state === "now" ? (
                <StatusGlyph tone="info" size={10} />
              ) : (
                <StatusGlyph tone="neutral" size={10} />
              )}
            </span>
            <span className={styles.text}>
              <span className="sr-only">{`Step ${index + 1} of ${steps.length}, `}</span>
              <span className={styles.label}>{step.label}</span>
              {step.detail ? <span className={styles.detail}>{step.detail}</span> : null}
              <span className="sr-only">{`, ${SPOKEN[step.state]}`}</span>
            </span>
          </li>
        ))}
      </ol>
      {/* Phone: the line keeps its six marks and names only the current step underneath. */}
      {current >= 0 ? (
        <p className={styles.phoneNow} aria-hidden="true">
          <strong>{steps[current]!.label}</strong>
          {steps[current]!.detail ? ` · ${steps[current]!.detail}` : null}
          <span>{` · step ${current + 1} of ${steps.length}`}</span>
        </p>
      ) : null}
      {extra ??
        (onOpenHistory ? (
          <button type="button" className={styles.history} onClick={onOpenHistory}>
            Full history
          </button>
        ) : null)}
    </div>
  );
}

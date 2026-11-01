"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { useId, useMemo } from "react";

import { Button } from "@/components/wf";

import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";

import { setPracticeSession as setSession, usePracticeSession } from "./ward-practice-session";
import { PRACTICE_STEPS, practiceProgress } from "./ward-practice-steps";
import styles from "./ward-practice-mode.module.css";

/**
 * PRACTICE MODE in Tools (smart features idea 10): a guided placement on the demo data. Shown
 * wherever the Tools demo panel is. It used to follow the one tap Demo reset (`demo-reset` flag),
 * but Josh asked for every feature on (20 Oct 2026) while that reset stays off on the live site, so
 * practice no longer depends on it: no step needs the whole-network reset, and Stop then Start begins
 * a fresh practice. The steps tick off from the shared record; progress lives in this browser tab only.
 */
export function WardPracticeMode({ className, headingClassName }: { className?: string; headingClassName?: string }) {
  const { movements, scenario, worldGeneration, shared } = useWardFlowSelect(
    "movements",
    "scenario",
    "worldGeneration",
    "shared",
  );
  const current = usePracticeSession();
  // Audit 24-7 (CT-01): practice has no sandbox, so every step is a real save. In the shared
  // workspace that save reaches everyone, so practice is off there and a running one stops.
  const inShared = shared?.enabled === true;
  const startedWith =
    !inShared && current && current.scenario === scenario && current.generation === worldGeneration
      ? current.startedWith
      : null;
  const titleId = useId();
  const progress = useMemo(
    () => (startedWith ? practiceProgress(movements, startedWith) : null),
    [movements, startedWith],
  );
  const finished = progress !== null && progress.next === undefined;
  return (
    <section
      className={className ? `${styles.practice} ${className}` : styles.practice}
      aria-labelledby={titleId}
      data-testid="ward-practice-mode"
    >
      <h3 id={titleId} className={headingClassName}>
        <GraduationCap aria-hidden="true" strokeWidth={1.75} />
        Practise a placement
        <span>Synthetic data, for learning the screens</span>
      </h3>
      {inShared ? (
        <p className={styles.intro} data-testid="ward-practice-shared-off">
          Practice is off in the shared workspace, where every step is saved for everyone. Use the demo on this device.
        </p>
      ) : progress === null ? (
        <>
          <p className={styles.intro}>Six steps, from bed request to arrival.</p>
          <Button
            size="sm"
            onClick={() =>
              setSession({
                scenario,
                generation: worldGeneration,
                startedWith: new Set(movements.map((movement) => movement.id)),
              })
            }
            data-testid="ward-practice-start"
          >
            Start practice
          </Button>
        </>
      ) : (
        <>
          <ol className={styles.steps} data-testid="ward-practice-steps">
            {PRACTICE_STEPS.map((step) => {
              const done = progress.done[step.id];
              const current = progress.next === step.id;
              return (
                <li
                  key={step.id}
                  className={styles.step}
                  data-state={done ? "done" : current ? "current" : "todo"}
                  aria-current={current ? "step" : undefined}
                >
                  <span className={styles.mark} aria-hidden="true">
                    {done ? "✓" : ""}
                  </span>
                  <span>
                    <strong>{step.title}</strong>
                    <span className={styles.state}>{done ? " · done" : current ? " · next" : ""}</span>
                    {current ? <span className={styles.how}>{step.how}</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className={styles.intro} role="status">
            {finished
              ? "All six steps done."
              : progress.movementId
                ? "Following the first bed request raised since you started."
                : "Waiting for a new bed request."}
          </p>
          <div className={styles.actions}>
            {progress.movementId ? (
              <Link href={movementHref(progress.movementId)} className={styles.link}>
                Open the practice request
              </Link>
            ) : null}
            <Button size="sm" onClick={() => setSession(null)} data-testid="ward-practice-stop">
              Stop practice
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

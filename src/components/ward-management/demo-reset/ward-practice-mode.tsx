"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { useId, useMemo, useSyncExternalStore } from "react";

import { Button } from "@/components/wf";

import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";

import { PRACTICE_STEPS, practiceProgress } from "./ward-practice-steps";
import styles from "./ward-practice-mode.module.css";

type PracticeSession = { scenario: string; startedWith: ReadonlySet<string> };

/**
 * The running practice, held at module level so it survives the Tools sheet closing while the
 * learner works in the real screens. Tied to the scenario: switching scenario ends it, since a new
 * scenario's seeded requests would otherwise look like ones the learner raised.
 */
let session: PracticeSession | null = null;
const listeners = new Set<() => void>();

function setSession(next: PracticeSession | null) {
  session = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const readSession = () => session;
const serverSession = () => null;

/**
 * PRACTICE MODE in Tools (smart features idea 10): a guided placement on the demo data. Shown
 * wherever the one tap Demo reset is (`demo-reset` flag), since practice only makes sense on data
 * that can be reset. The steps tick off from the shared record; progress lives in this browser tab only.
 */
export function WardPracticeMode({ className, headingClassName }: { className?: string; headingClassName?: string }) {
  const enabled = useWardFeatureFlag("demo-reset");
  const { movements, scenario } = useWardFlowSelect("movements", "scenario");
  const current = useSyncExternalStore(subscribe, readSession, serverSession);
  const startedWith = current && current.scenario === scenario ? current.startedWith : null;
  const titleId = useId();
  const progress = useMemo(
    () => (startedWith ? practiceProgress(movements, startedWith) : null),
    [movements, startedWith],
  );
  if (!enabled) return null;

  const finished = progress !== null && progress.next === undefined;
  return (
    <section
      className={className ? `${styles.practice} ${className}` : styles.practice}
      aria-labelledby={titleId}
      data-testid="ward-practice-mode"
    >
      <h3 id={titleId} className={headingClassName}>
        <GraduationCap aria-hidden="true" strokeWidth={1.75} />
        Practice a placement
        <span>Synthetic data, for learning the screens</span>
      </h3>
      {progress === null ? (
        <>
          <p className={styles.intro}>
            Six steps from bed request to arrival. Each one ticks off here as you do it in the real screens.
          </p>
          <Button
            size="sm"
            onClick={() => setSession({ scenario, startedWith: new Set(movements.map((movement) => movement.id)) })}
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
              ? "All six steps done. Reset the demo to practise again."
              : progress.movementId
                ? "Following the bed request you raised."
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

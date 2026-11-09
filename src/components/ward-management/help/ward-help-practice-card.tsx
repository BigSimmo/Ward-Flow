"use client";

import { useEffectiveWardAccess } from "../shell/ward-access-store";

import { GraduationCap, PlayCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Button, StatusGlyph, useIsPhone } from "@/components/wf";

import { setPracticeSession, usePracticeSession } from "@/components/ward-management/demo-reset/ward-practice-session";
import { WardTrainingSwitch } from "@/components/ward-management/demo-reset/ward-training-switch";
import { PRACTICE_STEPS, practiceProgress } from "@/components/ward-management/demo-reset/ward-practice-steps";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import {
  DEMO_CONTROLS_OFF,
  useDemoControlsAvailable,
  useWardRaise,
} from "@/components/ward-management/ward-flow-raise";

import { canShowMe, HOW_TOS } from "./ward-help-howto";
import { howToFor } from "./ward-help-access";
import type { WardTourRole } from "./ward-help-store";
import s from "./ward-help-checklists.module.css";

type PracticeStepId = (typeof PRACTICE_STEPS)[number]["id"];

/** The how-to whose Show me walks each practice step. Arrival has none. */
export const PRACTICE_SHOW_ME: Readonly<Record<PracticeStepId, string | undefined>> = {
  raise: "new-referral",
  ask: "ask-more-wards",
  accept: "decide-referral",
  hold: "pull-bed",
  transport: "book-transport",
  arrive: undefined,
};

/**
 * PRACTISE A PLACEMENT, INSIDE HELP (Josh, 2 Nov 2026: "training mode only on the demo data, with a
 * Reset practice button that puts it back"). The same practice as Tools (`ward-practice-mode.tsx`):
 * one session, the same six steps, ticked off from the record. Help adds a Show me for the step
 * that is next and Reset practice, which reloads the current demo scenario through `SET_SCENARIO`
 * after a confirm, then starts a fresh practice. Off in the shared workspace, as in Tools, unless
 * training is on (feature 47): Start training here runs it on a private synthetic world for this tab.
 */
export function WardHelpPracticeCard({
  role,
  onShowMe,
  showMeOn = true,
}: {
  role: WardTourRole;
  onShowMe: (howToId: string) => void;
  /** The help-ask switch: with Show me off, the host plays nothing, so no Show me is offered. */
  showMeOn?: boolean;
}) {
  const access = useEffectiveWardAccess();
  const { movements, scenario, worldGeneration, shared } = useWardFlowSelect(
    "movements",
    "scenario",
    "worldGeneration",
    "shared",
  );
  const raise = useWardRaise("demo");
  const demoOn = useDemoControlsAvailable();
  const phone = useIsPhone();
  const current = usePracticeSession();
  const inShared = shared?.enabled === true;
  const startedWith =
    !inShared && current && current.scenario === scenario && current.generation === worldGeneration
      ? current.startedWith
      : null;
  const progress = useMemo(
    () => (startedWith ? practiceProgress(movements, startedWith) : null),
    [movements, startedWith],
  );
  const finished = progress !== null && progress.next === undefined;
  const [confirming, setConfirming] = useState(false);
  // The demo generation a reset was raised from, so the render that carries the reloaded demo (a new
  // generation) starts a fresh practice.
  const restartFrom = useRef<number | null>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const resetButton = useRef<HTMLButtonElement>(null);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const offId = `${baseId}-off`;

  function start() {
    setPracticeSession({
      scenario,
      generation: worldGeneration,
      startedWith: new Set(movements.map((movement) => movement.id)),
    });
  }

  useEffect(() => {
    if (restartFrom.current === null || restartFrom.current === worldGeneration) return;
    restartFrom.current = null;
    setPracticeSession({
      scenario,
      generation: worldGeneration,
      startedWith: new Set(movements.map((movement) => movement.id)),
    });
    // Said only once the demo data has actually been reloaded, never on the press alone.
    announceToWardShell("Practice reset. Synthetic demo data only.");
  }, [movements, scenario, worldGeneration]);

  // The confirm takes focus on Cancel as it opens, never on the reset, so a second Enter cannot reset.
  useEffect(() => {
    if (confirming) cancelButton.current?.focus();
  }, [confirming]);

  function cancel() {
    setConfirming(false);
    resetButton.current?.focus();
  }

  function reset() {
    setConfirming(false);
    raise("SET_SCENARIO", { scenario });
    restartFrom.current = worldGeneration;
  }

  const nextStep = progress?.next ? PRACTICE_STEPS.find((step) => step.id === progress.next) : undefined;
  const nextHowTo = nextStep ? HOW_TOS.find((each) => each.id === PRACTICE_SHOW_ME[nextStep.id]) : undefined;
  const nextShowMe =
    showMeOn && nextHowTo && howToFor(nextHowTo, role, access) && canShowMe(nextHowTo, phone)
      ? nextHowTo.id
      : undefined;

  return (
    <section className={`${s.card} ${s.practice}`} aria-labelledby={titleId} data-testid="ward-help-practice">
      <h4 id={titleId} className={s.practiceTitle}>
        <GraduationCap aria-hidden="true" size={16} strokeWidth={1.75} />
        Practise a placement
        <span>Synthetic data, for learning the screens</span>
      </h4>
      {inShared ? (
        <div className={s.practiceActions}>
          <p className={s.intro} data-testid="ward-help-practice-shared-off">
            Practice is off in the shared workspace, where every step is saved for everyone. Start training to practise
            on synthetic patients that nobody else sees.
          </p>
          <WardTrainingSwitch testId="ward-help-training" />
        </div>
      ) : progress === null ? (
        <div className={s.practiceActions}>
          <p className={s.intro}>Six steps, from bed request to arrival.</p>
          <Button onClick={start} data-testid="ward-help-practice-start">
            Start practice
          </Button>
        </div>
      ) : (
        <>
          <ol className={s.practiceSteps} data-testid="ward-help-practice-steps">
            {PRACTICE_STEPS.map((step) => {
              const done = progress.done[step.id];
              const isNext = progress.next === step.id;
              return (
                <li
                  key={step.id}
                  className={s.practiceStep}
                  data-state={done ? "done" : isNext ? "current" : "todo"}
                  aria-current={isNext ? "step" : undefined}
                >
                  <span className={s.mark} aria-hidden="true">
                    {done ? <StatusGlyph tone="success" /> : null}
                  </span>
                  <span>
                    <strong>{step.title}</strong>
                    <span className={s.state}>{done ? " · done" : isNext ? " · next" : ""}</span>
                    {isNext ? <span className={s.how}>{step.how}</span> : null}
                    {isNext && nextShowMe ? (
                      <Button
                        variant="ghost"
                        icon={PlayCircle}
                        className={s.practiceShow}
                        onClick={() => onShowMe(nextShowMe)}
                        data-testid="ward-help-practice-show-me"
                      >
                        Show me
                      </Button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className={s.intro} role="status">
            {finished
              ? "All six steps done."
              : progress.movementId
                ? "Following the first bed request raised since you started."
                : "Waiting for a new bed request."}
          </p>
          <div className={s.practiceActions}>
            {progress.movementId ? (
              <Link href={movementHref(progress.movementId)} className={s.link}>
                Open the practice request
              </Link>
            ) : null}
            <Button onClick={() => setPracticeSession(null)} data-testid="ward-help-practice-stop">
              Stop practice
            </Button>
            <Button
              ref={resetButton}
              onClick={() => setConfirming(true)}
              disabledReason={demoOn ? undefined : DEMO_CONTROLS_OFF}
              reasonDisplay="tooltip"
              aria-expanded={demoOn ? confirming : undefined}
              data-testid="ward-help-practice-reset"
            >
              Reset practice
            </Button>
          </div>
          {demoOn ? null : (
            <p id={offId} className={s.intro} data-testid="ward-help-practice-reset-off">
              {DEMO_CONTROLS_OFF}
            </p>
          )}
          {confirming && demoOn ? (
            <div
              className={s.confirm}
              role="group"
              aria-label="Confirm practice reset"
              data-testid="ward-help-practice-confirm"
            >
              <p>
                Put the demo data back to how it was? This changes the demo data in this browser only. Other devices are
                not changed. There is no undo.
              </p>
              <div className={s.practiceActions}>
                <Button variant="pri" onClick={reset} data-testid="ward-help-practice-confirm-reset">
                  Reset practice
                </Button>
                <Button ref={cancelButton} onClick={cancel}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

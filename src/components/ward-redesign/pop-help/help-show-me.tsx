"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";

import { OverlayPortal, useIsPhone, useModalFocus } from "@/components/wf";

import { useTourRole } from "@/components/ward-management/help/ward-help-store";
import { useTourFacts } from "@/components/ward-management/help/ward-tour-facts";
import { railEntries } from "@/components/ward-management/shell/ward-rail-entries";
import styles from "@/components/ward-redesign/pop-tour/tour.module.css";
import type { TourDevice, TourTarget } from "@/components/ward-redesign/pop-tour/tour-steps";

import { howToHref } from "./help-href";
import { SPOT_NOT_HERE, usePlacedCard, useSpotlight } from "./help-spotlight";
import { taskById } from "./help-tasks-data";
import local from "./help.module.css";

/** The rail name of the screen at `path`, for the mock-up's "the app opens … first" line. */
function screenName(path: string): string {
  return railEntries().find((entry) => entry.href === path)?.label ?? "that screen";
}

/**
 * SHOW ME, mock-up copy of draft PR #1119's `help/ward-show-me.tsx`: a short walk through one task
 * over the real screen, lighting each control in turn with a line on what to do, on the tour's card
 * and spotlight (`help-spotlight.ts`, `pop-tour/tour.module.css`). It presses nothing: the engine
 * only finds, scrolls to and measures controls, and the person does the job. Back on the first step
 * returns to Help with this task open.
 *
 * Mock-up difference: the real Show me first opens the screen the task is done on. The preview draws
 * one page, so it stays here; a task done elsewhere says which screen the app would open, and its
 * steps show the "not on the screen" line. The live switch stays off in the real app (D-91).
 */
export function HelpShowMe({ id, onClose, onBack }: { id: string; onClose: () => void; onBack: () => void }) {
  const role = useTourRole();
  const device: TourDevice = useIsPhone() ? "phone" : "desk";
  const { home, deskHome } = useTourFacts(role);
  const task = taskById(id);
  const steps = useMemo(() => task?.showMe ?? [], [task]);
  const [index, setIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname() ?? "";
  const step = steps[index];
  const last = index >= steps.length - 1;

  const href = howToHref(task?.go, role, deskHome ?? home);
  const elsewhere = href ? href.split("#")[0] : undefined;
  const opensFirst = elsewhere && elsewhere !== pathname ? screenName(elsewhere) : undefined;

  // A step names its desktop control first and a phone stand-in after it; the first on screen is lit.
  const target = step?.target;
  const targets = useMemo<readonly TourTarget[] | undefined>(
    () => (target ? (Array.isArray(target) ? target : [target as TourTarget]) : undefined),
    [target],
  );
  const { box, missing } = useSpotlight(targets, `${index}|${pathname}`);
  usePlacedCard(cardRef, spotRef, box, device, step);

  const { rootRef } = useModalFocus({
    open: true,
    onClose,
    panelRef: cardRef,
    initialFocusRef: nextRef,
    keyPhase: "capture",
  });

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" && !last) {
      event.preventDefault();
      setIndex(index + 1);
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      setIndex(index - 1);
    }
  }

  if (!task || !step) return null;

  return (
    <OverlayPortal layer="modal" name="ward-show-me">
      <div ref={rootRef} className={styles.layer} data-testid="ward-show-me" data-device={device}>
        {box ? (
          <div
            ref={spotRef}
            className={styles.spot}
            style={{ transform: `translate(${box.left}px, ${box.top}px)`, width: box.width, height: box.height }}
            data-testid="ward-show-me-spot"
            aria-hidden="true"
          />
        ) : (
          <div className={styles.dim} aria-hidden="true" />
        )}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- catches the arrow keys bubbling up from the focused button inside */}
        <div
          ref={cardRef}
          className={styles.card}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ward-show-me-title"
          aria-describedby="ward-show-me-body"
          onKeyDown={onKeyDown}
          id="ward-show-me-card"
          data-testid="ward-show-me-card"
          data-step={index}
        >
          <div className={styles.head}>
            <p className={styles.who}>Show me · {task.title}</p>
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Close Show me"
              title="Close"
              data-testid="ward-show-me-close"
            >
              <X aria-hidden="true" strokeWidth={1.75} />
            </button>
          </div>
          <div className={styles.progress}>
            <div className={styles.bar} aria-hidden="true">
              <i style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
            </div>
            <p className={styles.meta}>
              Step {index + 1} of {steps.length}
            </p>
          </div>
          <h2 id="ward-show-me-title" className={styles.title} aria-live="polite">
            {step.title}
          </h2>
          <p id="ward-show-me-body" className={styles.body}>
            {step.body}
          </p>
          {target && missing ? (
            <p className={styles.notHere} data-testid="ward-show-me-not-here">
              {SPOT_NOT_HERE}
            </p>
          ) : null}
          {opensFirst && index === 0 ? (
            <p className={local.mockNote}>Mock-up: in the app, Show me opens {opensFirst} first.</p>
          ) : null}
          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.secondary}
              onClick={index === 0 ? onBack : () => setIndex(index - 1)}
              data-testid="ward-show-me-back"
            >
              {index === 0 ? "Back to Help" : "Back"}
            </button>
            <button
              ref={nextRef}
              type="button"
              className={styles.primary}
              onClick={last ? onClose : () => setIndex(index + 1)}
              data-testid={last ? "ward-show-me-done" : "ward-show-me-next"}
            >
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}

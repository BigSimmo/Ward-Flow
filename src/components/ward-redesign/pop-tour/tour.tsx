"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { OverlayPortal, useIsPhone, useModalFocus } from "@/components/wf";

import {
  markTourSeen,
  readTourStep,
  readTourStepId,
  saveTourStep,
  useTourRole,
} from "@/components/ward-management/help/ward-help-store";
import { useTourFacts } from "@/components/ward-management/help/ward-tour-facts";
import { SPOT_NOT_HERE, usePlacedCard, useSpotlight } from "@/components/ward-redesign/pop-help/help-spotlight";

import styles from "./tour.module.css";
import { TOUR_ROLE_LABELS, tourCanDo, tourGreeting, tourSteps, type TourDevice, type TourStep } from "./tour-steps";

/**
 * THE ROLE-TAILORED TOUR PLAYER. A spotlight on each step's control with the card beside it, Back
 * and Next, Skip tour (ends the tour and marks it seen, as Done does), and Close, which keeps the
 * step so the tour picks up there from Help. The real one runs on the desk's home screen and goes there first.
 *
 * Final round (D-91), matching draft PR #1119's restyled tour: one spotlight engine shared with Show me
 * (`pop-help/help-spotlight.ts`), its styles copied from #1119 (`tour.module.css`: focus-blue window,
 * 32px Close with an invisible tap area on a phone, quiet Skip tour), a "not on screen" line when a
 * step's control is missing, and the last step's link to How do I…. The welcome's "This takes about"
 * sentence is gone from the data (`tour-steps.ts`), not hidden as the card is drawn.
 */
export function TourMock({ onClose, onTasks }: { onClose: () => void; onTasks?: () => void }) {
  const role = useTourRole();
  const device: TourDevice = useIsPhone() ? "phone" : "desk";
  const { facts } = useTourFacts(role);
  const steps = useMemo(() => tourSteps(role, device, facts), [role, device, facts]);
  const canDo = useMemo(() => tourCanDo(role), [role]);
  // The place is held by the step's id, so crossing the phone width (a different set of steps)
  // keeps the same step, or the nearest one when that device has no such step. The saved place
  // carries the id too, so a tour closed on one width reopens on the same subject on the other.
  const [place, setPlace] = useState(() => {
    const at = Math.min(readTourStep(role), Math.max(0, steps.length - 1));
    return { id: readTourStepId(role) ?? steps[at]?.id, at };
  });
  const found = steps.findIndex((candidate) => candidate.id === place.id);
  const index = found >= 0 ? found : Math.min(place.at, Math.max(0, steps.length - 1));
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname() ?? "";
  const step: TourStep | undefined = steps[index];
  const last = index >= steps.length - 1;

  // Mock-up: the real tour goes to the desk's home first (`router.push(home)`). Here it stays over the
  // page it was drawn on, so a step whose control is not on this page says so on its card.

  // The shared engine finds the step's control (waiting a moment for a page still drawing), brings it
  // into view and follows it; a new step (or page) starts dark.
  const target = step?.target;
  const targets = useMemo(() => (target ? [target] : undefined), [target]);
  const { box, missing } = useSpotlight(targets, `${step?.id ?? ""}|${pathname}`);
  usePlacedCard(cardRef, spotRef, box, device, step);

  const finish = useCallback(() => {
    markTourSeen(role);
    saveTourStep(role, 0);
    onClose();
  }, [onClose, role]);

  const close = useCallback(() => {
    markTourSeen(role);
    saveTourStep(role, last ? 0 : index, step?.id);
    onClose();
  }, [index, last, onClose, role, step?.id]);

  // The shared modal contract: the page behind is inert and held still, Tab stays in the card,
  // Escape closes the tour wherever focus is (on a phone often not inside the card), and focus goes
  // back to Help or whatever opened it. Capture, so a screen's own Escape shortcut never acts too.
  const { rootRef } = useModalFocus({
    open: true,
    onClose: close,
    panelRef: cardRef,
    initialFocusRef: nextRef,
    keyPhase: "capture",
  });

  function go(next: number) {
    const clamped = Math.min(Math.max(0, next), steps.length - 1);
    setPlace({ id: steps[clamped]?.id, at: clamped });
    saveTourStep(role, clamped, steps[clamped]?.id);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" && !last) {
      event.preventDefault();
      go(index + 1);
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      go(index - 1);
    }
  }

  if (!step) return null;
  const left = steps.length - index - 1;
  const perStep = device === "phone" ? 12 : 15;
  const meta = `Step ${index + 1} of ${steps.length}${
    left ? `, about ${Math.max(1, Math.round((left * perStep) / 60))} min left` : ", last step"
  }`;
  const who = [
    tourGreeting(role),
    tourGreeting(role) === TOUR_ROLE_LABELS[role] ? "" : TOUR_ROLE_LABELS[role],
    facts.placeName,
  ]
    .filter(Boolean)
    .join(", ");
  // The welcome card's title and body already say who you are, so the progress takes the who-line's
  // place beside Close. How long is left is said once, in the progress line.
  const welcome = step.id === "welcome";
  const progress = (
    <div className={styles.progress}>
      <div className={styles.bar} aria-hidden="true">
        <i style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
      </div>
      <p className={styles.meta}>{meta}</p>
    </div>
  );

  return (
    <OverlayPortal layer="modal" name="ward-tour">
      <div ref={rootRef} className={styles.layer} data-testid="ward-tour" data-device={device}>
        {box ? (
          <div
            ref={spotRef}
            className={styles.spot}
            style={{ transform: `translate(${box.left}px, ${box.top}px)`, width: box.width, height: box.height }}
            data-testid="ward-tour-spot"
            aria-hidden="true"
          />
        ) : (
          <div className={styles.dim} aria-hidden="true" />
        )}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- catches Escape, arrow keys and Tab bubbling up from the focused button inside */}
        <div
          ref={cardRef}
          className={styles.card}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ward-tour-title"
          aria-describedby="ward-tour-body"
          onKeyDown={onKeyDown}
          id="ward-tour-card"
          data-testid="ward-tour-card"
          data-step={step.id}
        >
          <div className={styles.head}>
            {/* On the welcome card the progress takes the who-line's place beside Close, so no empty row. */}
            {welcome ? progress : <p className={styles.who}>{who}</p>}
            <button
              type="button"
              className={styles.close}
              onClick={close}
              aria-label="Close the tour. Pick it up again from Help."
              data-testid="ward-tour-close"
            >
              <X aria-hidden="true" strokeWidth={1.75} />
            </button>
          </div>
          {welcome ? null : progress}
          <p className={styles.chapter}>{step.chapter}</p>
          <h2 id="ward-tour-title" className={styles.title} aria-live="polite">
            {step.title}
          </h2>
          <p id="ward-tour-body" className={styles.body}>
            {step.body}
          </p>
          {step.tryIt ? (
            <p className={styles.try}>
              <b>Try it.</b> {step.tryIt}
            </p>
          ) : null}
          {step.canDo ? (
            // A long ask list scrolls inside its own box, so Done and Back stay on screen.
            <div
              className={styles.canDo}
              role="region"
              aria-label={step.title}
              tabIndex={0}
              data-testid="ward-tour-can-do"
            >
              <section aria-labelledby="ward-tour-can">
                <h3 id="ward-tour-can" className={styles.canTitle}>
                  {canDo.canTitle}
                </h3>
                <ul className={`${styles.list} ${styles.canList}`}>
                  {canDo.can.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
              {canDo.ask.length ? (
                <section aria-labelledby="ward-tour-ask">
                  <h3 id="ward-tour-ask" className={styles.askTitle}>
                    Ask someone else
                  </h3>
                  <ul className={styles.list}>
                    {canDo.ask.map((item) => (
                      <li key={item.label}>
                        {item.label} <span className={styles.by}>({item.by})</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}
          {step.target && missing ? (
            <p className={styles.notHere} data-testid="ward-tour-not-here">
              {SPOT_NOT_HERE}
            </p>
          ) : null}
          {step.canDo && onTasks ? (
            <button
              type="button"
              className={styles.tasksLink}
              onClick={() => {
                finish();
                onTasks();
              }}
              data-testid="ward-tour-tasks"
            >
              See common tasks, with Show me
            </button>
          ) : null}
          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.skip}
              onClick={last ? () => go(0) : finish}
              data-testid="ward-tour-skip"
            >
              {last ? "Replay" : "Skip tour"}
            </button>
            {/* Mock-up: no dead Back on the first card. */}
            {index > 0 ? (
              <button type="button" className={styles.secondary} onClick={() => go(index - 1)}>
                Back
              </button>
            ) : null}
            <button
              ref={nextRef}
              type="button"
              className={styles.primary}
              onClick={last ? finish : () => go(index + 1)}
              data-testid={last ? "ward-tour-done" : "ward-tour-next"}
            >
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}

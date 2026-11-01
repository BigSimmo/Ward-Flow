"use client";

import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { OverlayPortal, useIsPhone, useModalFocus } from "@/components/wf";
import { canRestoreFocusTo, SHEET_INERT_SKIP_ATTRIBUTE, topSheetRoot } from "@/components/wf/sheet-focus";
import { modalFocusTargets } from "@/components/wf/focus-targets";

import { howToHref } from "./ward-help-href";
import { howToFor } from "./ward-help-access";
import { HOW_TOS, showMeSteps, type HowTo } from "./ward-help-howto";
import { useTourRole, type WardTourRole } from "./ward-help-store";
import { findTourTarget, SPOT_NOT_HERE, usePlacedCard, useSpotlight } from "./ward-spotlight";
import { useTourFacts } from "./ward-tour-facts";
import type { TourDevice, TourTarget } from "./ward-tour-steps";
import styles from "./ward-tour.module.css";

/**
 * SHOW ME: a short walk through one how-to (`ward-help-howto.ts`) over the real screen. It opens the
 * screen the job is done on, then lights each control in turn with a line on what to do, using the
 * tour's card and spotlight (`ward-spotlight.ts`). It presses nothing: the person does the job.
 * Back on the first step returns to Help with this task open.
 */
export function WardShowMe({ id, onClose, onBack }: { id: string; onClose: () => void; onBack: () => void }) {
  const role = useTourRole();
  const device: TourDevice = useIsPhone() ? "phone" : "desk";
  const howTo = HOW_TOS.find((candidate) => candidate.id === id);
  const steps = useMemo(() => showMeSteps(howTo, device === "phone"), [howTo, device]);
  // Invalid, answer-only and computer-only phone requests never register an invisible modal.
  if (!howTo || !howToFor(howTo, role) || !steps.length) return null;
  return <ShowMeJourney key={`${id}|${role}`} {...{ howTo, role, device, steps, onClose, onBack }} />;
}

function ShowMeJourney({
  howTo,
  role,
  device,
  steps,
  onClose,
  onBack,
}: {
  howTo: HowTo;
  role: WardTourRole;
  device: TourDevice;
  steps: ReturnType<typeof showMeSteps>;
  onClose: () => void;
  onBack: () => void;
}) {
  const { home, deskHome } = useTourFacts(role);
  const [at, setIndex] = useState(0);
  const index = Math.min(at, steps.length - 1);
  const [paused, setPaused] = useState<{ advance: boolean } | null>(null);
  const [visit, setVisit] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const pausedRef = useRef<HTMLElement>(null);
  const pageFocusRef = useRef<HTMLElement | null>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const step = steps[index];
  const last = index >= steps.length - 1;

  // Open the screen the job is done on, once, when Show me starts somewhere else. Already on that
  // screen, a different Settings tab is opened through the hash, which Settings listens for.
  const href = howToHref(howTo.go, role, deskHome ?? home);
  const went = useRef(false);
  useEffect(() => {
    if (went.current || !href) return;
    went.current = true;
    const [path, tab] = href.split("#");
    if (pathname !== path) router.push(href);
    else if (tab && window.location.hash !== `#${tab}`) window.location.hash = tab;
  }, [href, pathname, router]);

  // A step names its desktop control first and a phone stand-in after it; the first on screen is lit.
  const target = step?.target;
  const targets = useMemo<readonly TourTarget[] | undefined>(
    () => (target ? (Array.isArray(target) ? target : [target as TourTarget]) : undefined),
    [target],
  );
  const { box, missing } = useSpotlight(paused ? undefined : targets, `${index}|${pathname}|${device}|${visit}`);
  usePlacedCard(cardRef, spotRef, box, device, step, missing);

  const { rootRef } = useModalFocus({
    open: !paused,
    onClose,
    panelRef: cardRef,
    initialFocusRef: nextRef,
    keyPhase: "capture",
  });

  // Pausing hands the page back, including native keyboard access. Focus a usable entry control
  // when one exists; never click it, choose a record, or perform a domain action on the user's behalf.
  useEffect(() => {
    if (!paused) return;
    pageFocusRef.current = null;
    const rememberFocus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && !pausedRef.current?.contains(event.target)) {
        pageFocusRef.current = event.target;
      }
    };
    document.addEventListener("focusin", rememberFocus);
    const control = targets
      ?.map(findTourTarget)
      .find((element) =>
        element?.matches(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]',
        ),
      );
    (control ?? continueRef.current)?.focus({ preventScroll: true });
    return () => document.removeEventListener("focusin", rememberFocus);
  }, [paused, targets]);

  function closePaused() {
    const previous = pageFocusRef.current;
    const usable =
      previous?.isConnected &&
      !previous.closest('[inert], [hidden], [aria-hidden="true"]') &&
      canRestoreFocusTo(previous);
    const target = usable ? previous : modalFocusTargets(topSheetRoot(), false, false)[0];
    target?.focus({ preventScroll: true });
    onClose();
  }

  function resume() {
    if (paused?.advance && !last) setIndex(index + 1);
    setVisit((value) => value + 1);
    setPaused(null);
  }

  // A form opened while paused owns Tab and Escape. This explicit shortcut can resume the guide
  // above it without closing the form or weakening its focus trap.
  useEffect(() => {
    if (!paused) return;
    const continueGuide = (event: globalThis.KeyboardEvent) => {
      if (
        !event.defaultPrevented &&
        !event.isComposing &&
        !event.repeat &&
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        event.key === "ArrowRight"
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (paused.advance && index < steps.length - 1) setIndex(index + 1);
        setVisit((value) => value + 1);
        setPaused(null);
      }
    };
    window.addEventListener("keydown", continueGuide, true);
    return () => window.removeEventListener("keydown", continueGuide, true);
  }, [paused, index, steps.length]);

  function next() {
    if (last) onClose();
    else if (step.continueLabel) setPaused({ advance: true });
    else setIndex(index + 1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.repeat ||
      event.nativeEvent.isComposing
    )
      return;
    if (event.key === "ArrowRight" && !last) {
      event.preventDefault();
      next();
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      setIndex(index - 1);
    }
  }

  if (paused)
    return (
      <OverlayPortal layer="modal" name="ward-show-me-paused">
        <section
          ref={pausedRef}
          className={styles.paused}
          data-device={device}
          data-testid="ward-show-me-paused"
          aria-label="Paused Show me guide"
          {...{ [SHEET_INERT_SKIP_ATTRIBUTE]: "" }}
        >
          <div className={styles.head}>
            <p className={styles.who}>Guide paused · {howTo.title}</p>
            <button type="button" className={styles.close} onClick={closePaused} aria-label="Close Show me">
              <X aria-hidden="true" strokeWidth={1.75} />
            </button>
          </div>
          <p className={styles.meta} role="status">
            {paused.advance ? step.continueLabel : "Use this screen, then return to the guide."}
          </p>
          <button
            ref={continueRef}
            type="button"
            className={styles.primary}
            data-testid="ward-show-me-continue"
            aria-keyshortcuts="Alt+ArrowRight"
            onClick={resume}
          >
            Continue guide
          </button>
          <p className={styles.meta}>Keyboard: Alt+Right continues the guide.</p>
        </section>
      </OverlayPortal>
    );

  return (
    <OverlayPortal layer="modal" name="ward-show-me">
      <div ref={rootRef} className={styles.layer} data-guide="" data-testid="ward-show-me" data-device={device}>
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
            <p className={styles.who}>Show me · {howTo.title}</p>
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
          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.secondary}
              onClick={index === 0 ? onBack : () => setIndex(index - 1)}
              data-testid="ward-show-me-back"
            >
              {index === 0 ? "Back to Help" : "Back"}
            </button>
            {!step.continueLabel || last ? (
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setPaused({ advance: false })}
                data-testid="ward-show-me-use-screen"
              >
                Use this screen
              </button>
            ) : null}
            <button
              ref={nextRef}
              type="button"
              className={styles.primary}
              onClick={next}
              data-testid={last ? "ward-show-me-done" : step.continueLabel ? "ward-show-me-try" : "ward-show-me-next"}
            >
              {last ? "Done" : step.continueLabel ? "Try this step" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}

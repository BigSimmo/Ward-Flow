"use client";

import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { OverlayPortal, useIsPhone, useModalFocus } from "@/components/wf";

import { howToHref } from "./ward-help-href";
import { HOW_TOS } from "./ward-help-howto";
import { useTourRole } from "./ward-help-store";
import { SPOT_NOT_HERE, usePlacedCard, useSpotlight } from "./ward-spotlight";
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
  const { home, deskHome } = useTourFacts(role);
  const howTo = HOW_TOS.find((candidate) => candidate.id === id);
  const steps = useMemo(() => howTo?.showMe ?? [], [howTo]);
  const [index, setIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const step = steps[index];
  const last = index >= steps.length - 1;

  // Open the screen the job is done on, once, when Show me starts somewhere else. Already on that
  // screen, a different Settings tab is opened through the hash, which Settings listens for.
  const href = howToHref(howTo?.go, role, deskHome ?? home);
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

  if (!howTo || !step) return null;

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

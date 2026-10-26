"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { OverlayPortal, useIsPhone, useModalFocus } from "@/components/wf";

import { howToHref } from "./ward-help-ask";
import { HOW_TOS } from "./ward-help-howto";
import { useTourRole } from "./ward-help-store";
import { findTourTarget } from "./ward-tour";
import { useTourFacts } from "./ward-tour-facts";
import type { TourTarget } from "./ward-tour-steps";
import styles from "./ward-tour.module.css";

type Box = { top: number; left: number; width: number; height: number };

/** How long a step waits for its control to appear (a page still loading) before showing without one. */
const FIND_TIMEOUT_MS = 3000;
const REMEASURE_MS = 400;
const EDGE = 12;

function boxOf(element: HTMLElement): Box {
  const rect = element.getBoundingClientRect();
  const top = Math.max(4, rect.top - 6);
  const left = Math.max(4, rect.left - 6);
  const bottom = Math.min(window.innerHeight - 4, rect.bottom + 6);
  const right = Math.min(window.innerWidth - 4, rect.right + 6);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/**
 * The card keeps clear of the lit control: on a desktop in the corner across from it, on a phone
 * docked to whichever end it is not near. With no control it sits in the middle.
 */
function cardPlace(box: Box | null, phone: boolean): { place: string; style: CSSProperties } {
  if (!box) return { place: phone ? "bottom" : "centre", style: phone ? { bottom: EDGE } : {} };
  const lowHalf = box.top + box.height / 2 > window.innerHeight / 2;
  const vertical: CSSProperties = lowHalf ? { top: EDGE } : { bottom: EDGE };
  if (phone) return { place: lowHalf ? "top" : "bottom", style: vertical };
  const rightHalf = box.left + box.width / 2 > window.innerWidth / 2;
  return { place: "beside", style: { ...vertical, ...(rightHalf ? { left: EDGE } : { right: EDGE }) } };
}

/**
 * SHOW ME: a short walk through one how-to (`ward-help-howto.ts`) over the real screen. It opens the
 * screen the job is done on, then lights each control in turn with a line on what to do, using the
 * tour's look and its way of finding a control. It presses nothing: the person does the job.
 */
export function WardShowMe({ id, onClose, onBack }: { id: string; onClose: () => void; onBack: () => void }) {
  const role = useTourRole();
  const phone = useIsPhone();
  const { home, deskHome } = useTourFacts(role);
  const howTo = HOW_TOS.find((candidate) => candidate.id === id);
  const steps = howTo?.showMe ?? [];
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<{ index: number; box: Box | null } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
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

  const target = step?.target;
  useEffect(() => {
    if (!target) return;
    const targets: readonly TourTarget[] = Array.isArray(target) ? target : [target as TourTarget];
    let element: HTMLElement | null = null;
    let follow = 0;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setSpot({ index, box: element && element.isConnected ? boxOf(element) : null }),
      );
    };
    const started = Date.now();
    const poll = window.setInterval(() => {
      element = targets.reduce<HTMLElement | null>((found, each) => found ?? findTourTarget(each), null);
      if (!element && Date.now() - started < FIND_TIMEOUT_MS) return;
      window.clearInterval(poll);
      if (!element) {
        setSpot({ index, box: null });
        return;
      }
      element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      measure();
      follow = window.setInterval(measure, REMEASURE_MS);
    }, 100);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(follow);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [target, pathname, index]);

  const { rootRef } = useModalFocus({
    open: true,
    onClose,
    panelRef: cardRef,
    initialFocusRef: nextRef,
    keyPhase: "capture",
  });

  if (!howTo || !step) return null;
  const box = spot && spot.index === index ? spot.box : null;
  const { place, style } = cardPlace(box, phone);

  return (
    <OverlayPortal layer="modal" name="ward-show-me">
      <div ref={rootRef} className={styles.layer} data-testid="ward-show-me" data-device={phone ? "phone" : "desk"}>
        {box ? (
          <div
            className={styles.spot}
            style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
            data-testid="ward-show-me-spot"
            aria-hidden="true"
          />
        ) : (
          <div className={styles.dim} aria-hidden="true" />
        )}
        <div
          ref={cardRef}
          className={styles.card}
          style={style}
          data-place={place}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ward-show-me-title"
          aria-describedby="ward-show-me-body"
          data-testid="ward-show-me-card"
          data-step={index}
        >
          <div className={styles.head}>
            <p className={styles.who}>Show me: {howTo.title}</p>
            <button type="button" className={styles.close} onClick={onClose} data-testid="ward-show-me-close">
              Close
            </button>
          </div>
          <h2 id="ward-show-me-title" className={styles.title} aria-live="polite">
            {step.title}
          </h2>
          <p id="ward-show-me-body" className={styles.body}>
            {step.body}
          </p>
          {target && spot?.index === index && !box ? (
            <p className={styles.try} data-testid="ward-show-me-not-here">
              This is not on the screen right now, for example when there is nothing to act on yet.
            </p>
          ) : null}
          <p className={styles.meta}>
            Step {index + 1} of {steps.length}
          </p>
          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.secondary}
              onClick={index === 0 ? onBack : () => setIndex(index - 1)}
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

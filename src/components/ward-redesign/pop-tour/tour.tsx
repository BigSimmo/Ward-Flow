"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { OverlayPortal, useIsPhone, useModalFocus } from "@/components/wf";

import {
  markTourSeen,
  readTourStep,
  readTourStepId,
  saveTourStep,
  useTourRole,
} from "@/components/ward-management/help/ward-help-store";
import { useTourFacts } from "@/components/ward-management/help/ward-tour-facts";
import {
  TOUR_ROLE_LABELS,
  tourCanDo,
  tourGreeting,
  tourSteps,
  type TourDevice,
  type TourStep,
  type TourTarget,
} from "@/components/ward-management/help/ward-tour-steps";
import { X } from "lucide-react";

import styles from "@/components/ward-management/help/ward-tour.module.css";
import mock from "./pop-tour.module.css";

type Box = { top: number; left: number; width: number; height: number };

/** How long a step waits for its control to appear (a page still loading) before it shows without one. */
const FIND_TIMEOUT_MS = 2000;
/** How often the spotlight re-measures, so a notice that shifts the page cannot leave it behind. */
const REMEASURE_MS = 400;
const GAP = 12;
const EDGE = 8;
/** A control taller than this share of the window is shown from its top, at this share. */
const TALL_SHARE = 0.45;
/** Room left above a control scrolled to the top, for the header that sits over the page. */
const HEADER_ROOM = 72;

function tall(rect: DOMRect): boolean {
  return rect.height > window.innerHeight * TALL_SHARE;
}

/** Brings the control into view: centred, or a tall one to just under the header. */
function bringIntoView(element: HTMLElement): void {
  const behavior: ScrollBehavior = "instant";
  if (!tall(element.getBoundingClientRect())) {
    element.scrollIntoView({ block: "center", inline: "nearest", behavior });
    return;
  }
  const margin = element.style.scrollMarginTop;
  element.style.scrollMarginTop = `${HEADER_ROOM}px`;
  element.scrollIntoView({ block: "start", inline: "nearest", behavior });
  element.style.scrollMarginTop = margin;
}

function shown(element: HTMLElement): boolean {
  if (element.getClientRects().length === 0) return false;
  // A control laid out but hidden (the phone dock under another dialog) is not on screen.
  return element.checkVisibility?.({ visibilityProperty: true }) ?? true;
}

/** The step's control on screen now, or null. See `TourTarget`. */
function findTourTarget(target: TourTarget): HTMLElement | null {
  const match = Array.from(document.querySelectorAll<HTMLElement>(target.sel)).find(
    (element) => shown(element) && (!target.text || (element.textContent ?? "").includes(target.text)),
  );
  let element: HTMLElement | null = match ?? null;
  for (let level = 0; element && level < (target.up ?? 0); level++) element = element.parentElement;
  return element;
}

/** The spotlight's box: the control with a little room, kept inside the window. */
function spotBox(element: HTMLElement): Box {
  const rect = element.getBoundingClientRect();
  const pad = rect.width < 120 || rect.height < 40 ? 6 : 4;
  const top = Math.max(EDGE / 2, rect.top - pad);
  const left = Math.max(EDGE / 2, rect.left - pad);
  // A tall control is lit from its top only, leaving room under it for the card.
  const tallest = tall(rect) ? window.innerHeight * TALL_SHARE : Infinity;
  const bottom = Math.min(window.innerHeight - EDGE / 2, rect.bottom + pad, top + tallest);
  const right = Math.min(window.innerWidth - EDGE / 2, rect.right + pad);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/**
 * Where the card goes. On a desktop it sits beside the control (right, left, below, then above),
 * kept inside the window. On a phone it spans the width, docked to whichever end has more room.
 * With no control it sits in the middle.
 *
 * H-0376 / H-0890 (L1 re-measure, 26 Oct 2026): the card stays at the window's top left and moves
 * by transform only, so settling from the middle to beside its control, or a phone card changing
 * height at the foot, never counts as a layout shift.
 */
function placeCard(card: HTMLElement, box: Box | null, device: TourDevice): void {
  const style = card.style;
  style.maxHeight = "";
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const moveTo = (left: number, top: number) => {
    style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  };
  // A phone card spans the width from its CSS insets, so it only ever moves down.
  const dock = (end: "top" | "bottom") => {
    card.dataset.place = end;
    moveTo(0, end === "top" ? EDGE : Math.max(EDGE, vh - EDGE - card.offsetHeight));
  };
  if (!box) {
    // B6-20 (device sweep, 24 Oct 2026): on a phone a step with no control still docks to the foot
    // like every other phone step, rather than floating mid-screen over the page.
    if (device === "phone") {
      dock("bottom");
      return;
    }
    card.dataset.place = "centre";
    moveTo((vw - card.offsetWidth) / 2, (vh - card.offsetHeight) / 2);
    return;
  }
  if (device === "phone") {
    const above = box.top;
    const below = vh - (box.top + box.height);
    const room = Math.max(above, below) - GAP - EDGE;
    // Never cover the control when there is room for a readable card, else take just over half,
    // and on a short screen (a phone on its side) at least 260px, so a step reads with Next in view.
    style.maxHeight = `${room >= 200 ? room : Math.round(Math.max(vh * 0.56, Math.min(vh - EDGE * 2, 260)))}px`;
    dock(above > below ? "top" : "bottom");
    return;
  }
  card.dataset.place = "beside";
  const cw = card.offsetWidth;
  const ch = card.offsetHeight;
  // D2 (device sweep, 24 Oct 2026): twice the edge below, so Next and its focus ring never touch the
  // bottom of the window.
  const clampTop = (top: number) => Math.min(Math.max(EDGE, top), Math.max(EDGE, vh - ch - EDGE * 2));
  const clampLeft = (left: number) => Math.min(Math.max(EDGE, left), Math.max(EDGE, vw - cw - EDGE));
  const bottom = box.top + box.height;
  const right = box.left + box.width;
  // Right, left, below, above, each kept in the window; the first that leaves the control clear
  // wins, else whichever covers least of it.
  const candidates = [
    { left: clampLeft(right + GAP), top: clampTop(box.top) },
    { left: clampLeft(box.left - GAP - cw), top: clampTop(box.top) },
    { left: clampLeft(box.left), top: clampTop(bottom + GAP) },
    { left: clampLeft(box.left), top: clampTop(box.top - GAP - ch) },
  ];
  const covered = ({ left, top }: { left: number; top: number }) =>
    Math.max(0, Math.min(left + cw, right) - Math.max(left, box.left)) *
    Math.max(0, Math.min(top + ch, bottom) - Math.max(top, box.top));
  const best = candidates.reduce((chosen, candidate) => (covered(candidate) < covered(chosen) ? candidate : chosen));
  moveTo(best.left, best.top);
}

/**
 * THE ROLE-TAILORED TOUR PLAYER. A spotlight on each step's control with the card beside it, Back
 * and Next, Skip tour (ends the tour and marks it seen, as Done does), and Close, which keeps the
 * step so the tour picks up there from Help. The real one runs on the desk's home screen and goes there first.
 */
export function TourMock({ onClose }: { onClose: () => void }) {
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
  // The box belongs to the step's control it measured, so a new step starts with no spotlight.
  const [spot, setSpot] = useState<{ target: TourTarget; box: Box | null } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname() ?? "";
  const step: TourStep | undefined = steps[index];
  const last = index >= steps.length - 1;

  // The tour walks the desk's home screen, so it goes there first when opened from another page,
  // and again if the desk's access settles to another role while it is open.
  // Mock-up: the real tour goes to the desk's home first (`router.push(home)`). Here it stays over the
  // page it was drawn on, so a step whose control is not on this page shows its card in the middle.

  // Find the step's control (waiting a moment for a page still drawing), bring it into view and
  // follow it while the window scrolls or resizes.
  const target = step?.target;
  const box = spot && spot.target === target ? spot.box : null;
  useEffect(() => {
    if (!target) return;
    let element: HTMLElement | null = null;
    let frame = 0;
    let follow = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setSpot({ target, box: element && element.isConnected ? spotBox(element) : null }),
      );
    };
    const started = Date.now();
    const poll = window.setInterval(() => {
      element = findTourTarget(target);
      if (!element && Date.now() - started < FIND_TIMEOUT_MS) return;
      window.clearInterval(poll);
      if (!element) return;
      bringIntoView(element);
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
  }, [target, pathname]);

  useLayoutEffect(() => {
    // The card is placed by transform, so a step with no control is placed again when the window
    // changes size (one with a control follows it through the spotlight's own re-measure).
    const card = cardRef.current;
    if (!card || box) return;
    const place = () => placeCard(card, null, device);
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [box, device]);

  useLayoutEffect(() => {
    if (cardRef.current) placeCard(cardRef.current, box, device);
    // A tall control with no room beside it: the light stops short of the card below it.
    const spotElement = spotRef.current;
    const card = cardRef.current;
    if (!spotElement || !card || !box) return;
    const rect = card.getBoundingClientRect();
    const stop = rect.top - GAP / 2 - box.top;
    const sideBySide = rect.left >= box.left + box.width || rect.right <= box.left;
    spotElement.style.height =
      !sideBySide && rect.top > box.top && stop < box.height ? `${Math.max(24, stop)}px` : `${box.height}px`;
  }, [box, device, index, step]);

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
            <p className={styles.who}>{who}</p>
            <button
              type="button"
              className={mock.close}
              onClick={close}
              aria-label="Close the tour. Pick it up again from Help."
              data-testid="ward-tour-close"
            >
              <X aria-hidden="true" strokeWidth={1.75} />
            </button>
          </div>
          <div className={mock.progress}>
            <div className={styles.bar} aria-hidden="true">
              <i style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
            </div>
            <p className={styles.meta}>{meta}</p>
          </div>
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
          <div className={`${styles.buttons} ${mock.buttons}`}>
            <button
              type="button"
              className={`${styles.skip} ${mock.skip}`}
              onClick={last ? () => go(0) : finish}
              data-testid="ward-tour-skip"
            >
              {last ? "Replay" : "Skip tour"}
            </button>
            <button type="button" className={styles.secondary} disabled={index === 0} onClick={() => go(index - 1)}>
              Back
            </button>
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

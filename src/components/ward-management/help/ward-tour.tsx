"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Check, ChevronDown, Info, X } from "lucide-react";

import { OverlayPortal, useModalFocus } from "@/components/wf";

import { markTourSeen, readTourStep, readTourStepId, saveTourStep, useTourRole } from "./ward-help-store";
import { useTourFacts } from "./ward-tour-facts";
import { TOUR_ROLE_LABELS, tourCanDo, tourGreeting, type TourStep } from "./ward-tour-steps";
import { fullTourSteps, goFurtherSteps } from "./ward-tour-more-steps";
import { tourChapters, useSwipe, useTourDevice } from "./ward-tour-device";
import { openWardHelp } from "./ward-help-events";
import { navigateWithDirtyGuard } from "@/components/ward-management/use-dirty-state-guard";
import { SPOT_NOT_HERE, usePlacedCard, useSpotlight } from "./ward-spotlight";
import styles from "./ward-tour.module.css";

export { findTourTarget } from "./ward-spotlight";

/**
 * THE ROLE-TAILORED TOUR PLAYER. A spotlight on each step's control with the card beside it, Back
 * and Next, Skip tour (ends the tour and marks it seen, as Done does), and Close, which keeps the
 * step so the tour picks up there from Help. It runs on the desk's home screen and goes there first.
 *
 * Nov 2026 (Help extension): a chapter menu jumps to any chapter and says where you are in it; a
 * swipe left or right on a touch screen is Next or Back; the screen is read as a phone, a tablet
 * (the rail across the top) or a desk; and the end of the first-run tour offers "Go further", the
 * desk's optional extra steps, played by this same player.
 */
export function WardTour({ onClose }: { onClose: () => void }) {
  const role = useTourRole();
  const device = useTourDevice();
  const { facts, home } = useTourFacts(role);
  // The home walk plus the desk's other parts (`ward-tour-more-steps.ts`). Added steps move a saved
  // index; the place below is found by id first and a stale index is clamped to the tour's length.
  const base = useMemo(() => fullTourSteps(role, device, facts), [role, device, facts]);
  const extra = useMemo(() => goFurtherSteps(role, device, facts), [role, device, facts]);
  // Go further is played on from the last first-run step, so its steps follow the base ones. A tour
  // closed part way through them reopens there.
  const [further, setFurther] = useState(() => {
    const id = readTourStepId(role);
    return Boolean(id && extra.some((each) => each.id === id));
  });
  const steps = useMemo(() => (further && extra.length ? [...base, ...extra] : base), [base, extra, further]);
  const chapters = useMemo(() => tourChapters(steps), [steps]);
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [menu, setMenu] = useState(false);
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const step: TourStep | undefined = steps[index];
  const last = index >= steps.length - 1;
  // The end of the first-run tour, with optional steps still to offer.
  const offerFurther = last && !further && extra.length > 0;

  // The tour walks the desk's home screen, so it goes there first when opened from another page,
  // and again if the desk's access settles to another role while it is open.
  const wentHome = useRef<string | null>(null);
  useEffect(() => {
    if (!home || wentHome.current === home) return;
    if (pathname !== home)
      navigateWithDirtyGuard(() => {
        wentHome.current = home;
        router.push(home);
      });
    else wentHome.current = home;
  }, [home, pathname, router]);

  // Find the step's control, light it and keep the card clear of it (`ward-spotlight.ts`).
  const target = step?.target;
  const targets = useMemo(() => (target ? [target] : undefined), [target]);
  const { box, missing, held } = useSpotlight(targets, `${step?.id ?? ""}|${pathname}`, device);
  usePlacedCard(cardRef, spotRef, box, device, `${step?.id ?? ""}|${menu}`, missing);

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

  const closeMenu = useCallback(() => {
    setMenu(false);
    menuButtonRef.current?.focus();
  }, []);

  // The shared modal contract: the page behind is inert and held still, Tab stays in the card,
  // Escape closes the tour wherever focus is (on a phone often not inside the card), and focus goes
  // back to Help or whatever opened it. Capture, so a screen's own Escape shortcut never acts too.
  // With the chapter menu open, Escape closes the menu first.
  const { rootRef } = useModalFocus({
    open: true,
    onClose: menu ? closeMenu : close,
    panelRef: cardRef,
    initialFocusRef: nextRef,
    keyPhase: "capture",
  });

  // A step change can take away the focused button (Back on the first step), so focus goes to Next.
  useEffect(() => {
    if (document.activeElement === document.body) nextRef.current?.focus();
  }, [index]);

  // The chapter menu opens on the chapter you are in, so arrow keys start from there.
  useEffect(() => {
    if (menu) menuRef.current?.querySelector<HTMLElement>("[aria-current]")?.focus();
  }, [menu]);

  function go(next: number, list: readonly TourStep[] = steps) {
    const clamped = Math.min(Math.max(0, next), list.length - 1);
    setPlace({ id: list[clamped]?.id, at: clamped });
    saveTourStep(role, clamped, list[clamped]?.id);
  }

  function goFurther() {
    const all = [...base, ...extra];
    setFurther(true);
    go(base.length, all);
  }

  const swipe = useSwipe(last ? undefined : () => go(index + 1), index > 0 ? () => go(index - 1) : undefined);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (menu) {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      // Up and down move through the chapters, round from one end to the other.
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("button") ?? []);
      const at = items.indexOf(document.activeElement as HTMLElement);
      if (at < 0) return;
      event.preventDefault();
      items[(at + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
      return;
    }
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
  const chapter = chapters.find((span) => index >= span.start && index < span.start + span.count);
  const who = [
    tourGreeting(role),
    tourGreeting(role) === TOUR_ROLE_LABELS[role] ? "" : TOUR_ROLE_LABELS[role],
    facts.placeName,
  ]
    .filter(Boolean)
    .join(", ");

  // Round 2 (#1118): the welcome card's title and body already say who you are and the meta says
  // how long is left, so it drops the who-line (the progress takes its place) and its own sentence.
  const welcome = step.id === "welcome";
  const body = welcome ? step.body.replace(/\s*This takes about [^.]*\./u, "") : step.body;
  const progress = (
    <div className={styles.progress}>
      <div className={styles.bar} aria-hidden="true">
        <i style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
      </div>
      <p className={styles.meta} data-testid="ward-tour-meta">
        {meta}
      </p>
    </div>
  );

  return (
    <OverlayPortal layer="modal" name="ward-tour">
      <div ref={rootRef} className={styles.layer} data-testid="ward-tour" data-device={device}>
        {/* Keyed apart, so a new spot is never the dim's box reused and flown in from the corner. */}
        {box ? (
          <div
            key="spot"
            ref={spotRef}
            className={styles.spot}
            style={{
              transform: `translate(${box.left}px, ${box.top}px)`,
              width: box.width,
              height: box.height,
              borderRadius: box.radius,
            }}
            data-testid="ward-tour-spot"
            data-held={held ? "" : undefined}
            aria-hidden="true"
          />
        ) : (
          <div key="dim" className={styles.dim} aria-hidden="true" />
        )}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- catches Escape, arrow keys and Tab bubbling up from the focused button inside, and a swipe across the card */}
        <div
          ref={cardRef}
          className={styles.card}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ward-tour-title"
          aria-describedby="ward-tour-body"
          onKeyDown={onKeyDown}
          {...swipe}
          id="ward-tour-card"
          data-testid="ward-tour-card"
          data-step={step.id}
        >
          <div className={styles.head}>
            {welcome ? progress : <p className={styles.who}>{who}</p>}
            <button
              type="button"
              className={styles.close}
              onClick={close}
              aria-label="Close the tour. Pick it up again from Help."
              title="Close"
              data-testid="ward-tour-close"
            >
              <X aria-hidden="true" strokeWidth={1.75} />
            </button>
          </div>
          {/* Redesign (#1118): how far through, straight under the header. */}
          {welcome ? null : progress}
          <div className={styles.chapterRow}>
            <button
              ref={menuButtonRef}
              type="button"
              className={styles.chapterButton}
              aria-expanded={menu}
              aria-controls="ward-tour-chapters"
              onClick={() => (menu ? closeMenu() : setMenu(true))}
              data-testid="ward-tour-chapter"
            >
              <span className="sr-only">Chapter: </span>
              {step.chapter}
              <span className="sr-only">. Choose a chapter</span>
              <ChevronDown aria-hidden="true" strokeWidth={2} />
            </button>
            {chapter && chapter.count > 1 ? (
              <span className={styles.chapterStep} data-testid="ward-tour-chapter-step">
                {index - chapter.start + 1} of {chapter.count}
              </span>
            ) : null}
          </div>
          {menu ? (
            <ul
              ref={menuRef}
              id="ward-tour-chapters"
              className={styles.chapters}
              aria-label="Chapters"
              data-testid="ward-tour-chapters"
            >
              {chapters.map((span) => {
                const current = span === chapter;
                const done = span.start + span.count <= index;
                return (
                  <li key={span.name}>
                    <button
                      type="button"
                      className={styles.chapterItem}
                      aria-current={current ? "step" : undefined}
                      onClick={() => {
                        go(span.start);
                        closeMenu();
                      }}
                    >
                      <span className={styles.chapterMark} aria-hidden="true">
                        {done ? <Check aria-hidden="true" strokeWidth={2.25} /> : null}
                      </span>
                      <span className={styles.chapterName}>{span.name}</span>
                      <span className={styles.chapterCount}>
                        {span.count} {span.count === 1 ? "step" : "steps"}
                        {done ? <span className="sr-only">, seen</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <h2 id="ward-tour-title" className={menu ? "sr-only" : styles.title} aria-live="polite">
            {step.title}
          </h2>
          {/* While the chapter menu is open it takes the step's place, so a phone card stays short. */}
          {menu ? null : (
            <>
              <p id="ward-tour-body" className={styles.body}>
                {body}
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
                <p className={styles.notHere} role="note" data-testid="ward-tour-not-here">
                  <Info aria-hidden="true" strokeWidth={1.75} />
                  <span>{SPOT_NOT_HERE}</span>
                </p>
              ) : null}
              {step.canDo ? (
                <button
                  type="button"
                  className={styles.tasksLink}
                  onClick={() => {
                    finish();
                    openWardHelp("tasks");
                  }}
                  data-testid="ward-tour-tasks"
                >
                  See common tasks, with Show me
                </button>
              ) : null}
              {offerFurther ? (
                <button type="button" className={styles.further} onClick={goFurther} data-testid="ward-tour-further">
                  Go further, {extra.length} more {extra.length === 1 ? "step" : "steps"}
                </button>
              ) : null}
            </>
          )}
          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.skip}
              onClick={
                last
                  ? () => {
                      setFurther(false);
                      go(0, base);
                    }
                  : finish
              }
              data-testid="ward-tour-skip"
            >
              {last ? "Replay" : "Skip tour"}
            </button>
            {/* Round 2 (#1118): no dead Back on the first card. */}
            {index > 0 ? (
              <button
                type="button"
                className={styles.secondary}
                onClick={() => go(index - 1)}
                aria-keyshortcuts="ArrowLeft"
              >
                Back
              </button>
            ) : null}
            <button
              ref={nextRef}
              type="button"
              className={styles.primary}
              onClick={last ? finish : () => go(index + 1)}
              aria-keyshortcuts={last ? undefined : "ArrowRight"}
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

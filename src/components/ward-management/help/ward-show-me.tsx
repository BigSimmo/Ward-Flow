"use client";

import { useEffectiveWardAccess } from "../shell/ward-access-store";
import { howToFor } from "./ward-help-access";

import { Info, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { OverlayPortal, useIsPhone, useModalFocus } from "@/components/wf";
import { hasOpenSheet, subscribeToSheetStack, topSheetRoot } from "@/components/wf/sheet-focus";
import { PHONE_QUICK_SETTINGS } from "@/components/ward-management/settings/settings-screen-model";

import { howToHref } from "./ward-help-href";
import { HOW_TOS, showMeSteps } from "./ward-help-howto";
import { useTourRole } from "./ward-help-store";
import { SPOT_NOT_HERE, usePlacedCard, useSpotlight } from "./ward-spotlight";
import { useTourFacts } from "./ward-tour-facts";
import type { TourDevice, TourTarget } from "./ward-tour-steps";
import styles from "./ward-tour.module.css";

/**
 * SHOW ME: a short walk through one how-to (`ward-help-howto.ts`) over the real screen. It opens the
 * screen the job is done on, then lights each control in turn with a line on what to do, using the
 * tour's card and spotlight (`ward-spotlight.ts`). It presses nothing: the person does the job.
 * Back to Help, on the first and last steps, returns to Help with this task open.
 */
export function WardShowMe({ id, onClose, onBack }: { id: string; onClose: () => void; onBack: () => void }) {
  const role = useTourRole();
  const access = useEffectiveWardAccess();
  const device: TourDevice = useIsPhone() ? "phone" : "desk";
  const { home, deskHome } = useTourFacts(role);
  const howTo = HOW_TOS.find((candidate) => candidate.id === id);
  // Steps marked for the other device are skipped, so a phone never walks to a computer-only part.
  const permitted = Boolean(howTo && howToFor(howTo, role, access));
  const steps = useMemo(() => (permitted ? showMeSteps(howTo, device) : []), [howTo, device, permitted]);
  const [stepIndex, setIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname() ?? "";
  const router = useRouter();
  // A computer and a phone walk different steps, so a window narrowed mid-walk (or a tablet
  // turned) keeps the walk on its last step rather than running past the end and vanishing.
  const index = Math.min(stepIndex, Math.max(steps.length - 1, 0));
  const step = steps[index];
  const last = index >= steps.length - 1;

  // Open the screen the job is done on, once, when Show me starts somewhere else. Already on that
  // screen, a different Settings tab is opened through the hash, which Settings listens for.
  const destination = permitted ? howToHref(howTo?.go, role, deskHome ?? home) : undefined;
  // Phone quick settings live on the page. Their old desktop section hashes open a device
  // sheet which deliberately omits these controls, covering the very target we need to light.
  const href =
    device === "phone" && howTo && PHONE_QUICK_SETTINGS.has(howTo.id) && destination?.startsWith("/ward-flow/settings#")
      ? destination.split("#")[0]
      : destination;
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
  const [ownsFocus, setOwnsFocus] = useState(false);
  const { box, missing, held, element } = useSpotlight(targets, `${index}|${pathname}`, device);
  usePlacedCard(cardRef, spotRef, box, device, ownsFocus ? step : undefined, missing);

  // Navigation can open the first target's PhoneSheet after the guide mounts. Join above that
  // context once it is ready, then keep this stack position for the whole walk: a dialog opened
  // by the person afterwards must still take priority. An unrelated dialog also keeps its turn
  // if it opens while the initial target is being found.
  useEffect(() => {
    if (ownsFocus || !howTo || !step) return;
    function admit() {
      const top = topSheetRoot();
      if (element ? !top || top.contains(element) : (!targets?.length || missing) && !top) setOwnsFocus(true);
    }
    admit();
    return subscribeToSheetStack(admit);
  }, [ownsFocus, howTo, step, element, targets, missing]);

  // The card shows while it waits for its turn above any sheet, so Escape must still close it then.
  // An open sheet keeps its own Escape; once the card owns focus, useModalFocus handles it.
  useEffect(() => {
    if (ownsFocus || !howTo || !step) return;
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented || hasOpenSheet()) return;
      event.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ownsFocus, howTo, step, onClose]);

  // The restricted notice has no steps, so the admit effect never runs; it owns focus as soon as it shows.
  const restricted = Boolean(howTo && !permitted);
  const { rootRef } = useModalFocus({
    open: ownsFocus || restricted,
    onClose,
    panelRef: cardRef,
    initialFocusRef: nextRef,
    interactionRoots: [element],
  });

  // A step change can take away the focused button (Back on the first step), so focus goes to Next.
  useEffect(() => {
    if (ownsFocus && document.activeElement === document.body) nextRef.current?.focus();
  }, [index, ownsFocus]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" && !last) {
      event.preventDefault();
      setIndex(index + 1);
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      setIndex(index - 1);
    }
  }

  if (howTo && !permitted)
    return (
      <OverlayPortal layer="modal" name="ward-show-me">
        <div ref={rootRef} className={styles.layer} data-testid="ward-show-me-restricted">
          <div ref={cardRef} className={styles.card} role="dialog" aria-modal="true" aria-label={howTo.title}>
            <p>
              {howTo.requiresWholeNetwork
                ? "Only the statewide coordinator may change global settings."
                : "This task is not available to your desk."}
            </p>
            <button ref={nextRef} type="button" onClick={onBack}>
              Back to Help
            </button>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </OverlayPortal>
    );
  if (!howTo || !step) return null;

  return (
    <OverlayPortal key={ownsFocus ? "ready" : "waiting"} layer="modal" name="ward-show-me">
      <div
        ref={rootRef}
        className={styles.layer}
        style={{ pointerEvents: "none" }}
        data-testid="ward-show-me"
        data-device={device}
        data-flow="show-me"
      >
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
            data-testid="ward-show-me-spot"
            data-held={held ? "" : undefined}
            aria-hidden="true"
          />
        ) : (
          <div key="dim" className={styles.dim} aria-hidden="true" />
        )}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- catches the arrow keys bubbling up from the focused button inside */}
        <div
          ref={cardRef}
          className={styles.card}
          style={{ pointerEvents: "auto" }}
          role="dialog"
          aria-labelledby="ward-show-me-title"
          aria-describedby="ward-show-me-body"
          onKeyDown={onKeyDown}
          id="ward-show-me-card"
          data-testid="ward-show-me-card"
          data-step={index}
        >
          <div className={styles.head}>
            {/* A walk round's title already starts "Show me around", so it is not said twice. */}
            <p className={styles.who}>{howTo.around ? howTo.title : `Show me · ${howTo.title}`}</p>
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
          <div className={styles.steps}>
            <div className={styles.segments} aria-hidden="true">
              {steps.map((each, at) => (
                <i key={at} data-on={at <= index ? "" : undefined} />
              ))}
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
          {device === "desk" && steps.length > 1 ? (
            // Said for sighted keyboard users; the buttons' own key shortcuts tell a screen reader.
            <p className={styles.hint} aria-hidden="true">
              Use ← and → to move
            </p>
          ) : null}
          {target && missing ? (
            <p className={styles.notHere} role="note" data-testid="ward-show-me-not-here">
              <Info aria-hidden="true" strokeWidth={1.75} />
              <span>{SPOT_NOT_HERE}</span>
            </p>
          ) : null}
          <div className={styles.buttons}>
            {/* The quiet way back to Help, on the first step and on the last (so Done is not the only
                way on); between them, Back steps back. */}
            {index === 0 || last ? (
              <button
                type="button"
                className={styles.skip}
                onClick={onBack}
                data-testid={index === 0 ? "ward-show-me-back" : "ward-show-me-help"}
              >
                Back to Help
              </button>
            ) : null}
            {index > 0 ? (
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setIndex(index - 1)}
                aria-keyshortcuts="ArrowLeft"
                data-testid="ward-show-me-back"
              >
                Back
              </button>
            ) : null}
            <button
              ref={nextRef}
              type="button"
              className={styles.primary}
              onClick={last ? onClose : () => setIndex(index + 1)}
              aria-keyshortcuts={last ? undefined : "ArrowRight"}
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

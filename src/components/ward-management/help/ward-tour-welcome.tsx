"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { CircleHelp, FlaskConical, LayoutDashboard, type LucideIcon } from "lucide-react";

import { OverlayPortal, useModalFocus } from "@/components/wf";

import { useTourRole } from "./ward-help-store";
import { useTourFacts } from "./ward-tour-facts";
import { fullTourSteps } from "./ward-tour-more-steps";
import { tourMinutes, type TourDevice } from "./ward-tour-steps";
import { useSwipe, useTourDevice, type WardTourDevice } from "./ward-tour-device";
import styles from "./ward-tour-offer.module.css";

type WelcomeCard = { readonly id: string; readonly icon: LucideIcon; readonly title: string; readonly body: string };

/** Where Help is on this screen: the foot of the side menu on a computer, inside the menu elsewhere. */
function whereHelpIs(device: WardTourDevice): string {
  return device === "desk"
    ? "Help is at the foot of the menu on the left, on every screen."
    : "Help is in the menu, the button at the top left, on every screen.";
}

/**
 * The three welcome cards, in order: what Ward Flow is, that it holds made-up data only, and how
 * Help works and where it is on this screen. The last card offers the tour and says how long it takes.
 */
export function welcomeCards(device: WardTourDevice, minutes: string): readonly WelcomeCard[] {
  return [
    {
      id: "what",
      icon: LayoutDashboard,
      title: "Welcome to Ward Flow",
      body: "Ward Flow shows mental health beds across the network in one place: who is waiting in ED, which beds are ready, and which moves are under way. Each desk sees the part it works on.",
    },
    {
      id: "prototype",
      icon: FlaskConical,
      title: "A prototype with made-up data",
      body: "Every person, bed and figure here is synthetic. There are no real patients, and nothing you do here reaches a hospital system, so try anything.",
    },
    {
      id: "help",
      icon: CircleHelp,
      title: "Help is always close",
      body: `${whereHelpIs(device)} It explains the screen you are on, lists your jobs with Show me, and keeps this tour. The tour takes ${minutes}, and you can stop at any step.`,
    },
  ];
}

/**
 * THE WELCOME before the first-run tour (Nov 2026, Help extension). Three short cards, then "Start
 * the tour" or "Not now". The offer is still made once per device (`ward-tour-auto-start.tsx` keeps
 * that); Help's tour row plays the same cards again inline (`inline`), with no layer over the page.
 *
 * Move between cards with Next and Back, the dots, the arrow keys, or a swipe on a touch screen.
 * A screen reader hears each new card; reduced motion turns the slide into a plain swap.
 * It loads only when it is shown (next/dynamic), so no page's first load carries it.
 */
export function WardTourWelcome({
  onStart,
  onClose,
  inline = false,
}: {
  onStart: () => void;
  onClose: () => void;
  inline?: boolean;
}) {
  const role = useTourRole();
  const device = useTourDevice();
  const { facts } = useTourFacts(role);
  const minutes = useMemo(
    () => tourMinutes(fullTourSteps(role, device as TourDevice, facts).length, device as TourDevice),
    [role, device, facts],
  );
  const cards = useMemo(() => welcomeCards(device, minutes), [device, minutes]);
  const [at, setAt] = useState(0);
  // Which way the last move went, so the new card slides in from that side.
  const [from, setFrom] = useState<"next" | "back" | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const card = cards[at] ?? cards[0]!;
  const lastCard = at === cards.length - 1;

  const { rootRef } = useModalFocus({
    open: !inline,
    onClose,
    panelRef,
    initialFocusRef: primaryRef,
  });

  // A move can take away the focused button (Back on the first card), so focus goes to the main one.
  useEffect(() => {
    if (document.activeElement === document.body) primaryRef.current?.focus({ preventScroll: true });
  }, [at]);

  function move(to: number) {
    const next = Math.min(Math.max(0, to), cards.length - 1);
    if (next === at) return;
    setFrom(next > at ? "next" : "back");
    setAt(next);
  }

  const swipe = useSwipe(lastCard ? undefined : () => move(at + 1), at > 0 ? () => move(at - 1) : undefined);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" && !lastCard) {
      event.preventDefault();
      move(at + 1);
    } else if (event.key === "ArrowLeft" && at > 0) {
      event.preventDefault();
      move(at - 1);
    }
  }

  const Icon = card.icon;
  const body = (
    <div
      ref={panelRef}
      className={styles.panel}
      role={inline ? "group" : "dialog"}
      aria-modal={inline ? undefined : "true"}
      aria-labelledby="ward-tour-welcome-title"
      aria-describedby="ward-tour-welcome-body"
      onKeyDown={onKeyDown}
      {...swipe}
      data-testid={inline ? "ward-tour-welcome-inline" : "ward-tour-offer"}
      data-card={card.id}
      data-inline={inline ? "" : undefined}
    >
      <div key={card.id} className={styles.slide} data-from={from ?? undefined}>
        <span className={styles.art} aria-hidden="true">
          <Icon aria-hidden="true" strokeWidth={1.75} />
        </span>
        <h2 id="ward-tour-welcome-title" className={styles.title}>
          {card.title}
        </h2>
        <p id="ward-tour-welcome-body" className={styles.body}>
          {card.body}
        </p>
      </div>
      {/* Heard on each move, in place of reading the whole card again. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true" data-testid="ward-tour-welcome-live">
        {from ? `Card ${at + 1} of ${cards.length}. ${card.title}` : ""}
      </p>
      <div className={styles.dots}>
        {cards.map((each, index) => (
          <button
            key={each.id}
            type="button"
            className={styles.dot}
            aria-label={`Card ${index + 1} of ${cards.length}: ${each.title}`}
            aria-current={index === at ? "step" : undefined}
            onClick={() => move(index)}
          />
        ))}
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.ghost} onClick={onClose} data-testid="ward-tour-welcome-close">
          Not now
        </button>
        {at > 0 ? (
          <button type="button" className={styles.secondary} onClick={() => move(at - 1)} aria-keyshortcuts="ArrowLeft">
            Back
          </button>
        ) : null}
        <button
          ref={primaryRef}
          type="button"
          className={styles.primary}
          onClick={lastCard ? onStart : () => move(at + 1)}
          aria-keyshortcuts={lastCard ? undefined : "ArrowRight"}
          data-testid={lastCard ? "ward-tour-welcome-start" : "ward-tour-welcome-next"}
        >
          {lastCard ? "Start the tour" : "Next"}
        </button>
      </div>
    </div>
  );
  if (inline) return body;
  return (
    <OverlayPortal layer="modal" name="ward-tour-welcome">
      <div ref={rootRef} className={styles.layer} data-testid="ward-tour-welcome">
        {body}
      </div>
    </OverlayPortal>
  );
}

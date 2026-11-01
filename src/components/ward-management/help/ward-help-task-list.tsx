"use client";

import { ArrowRight, ChevronDown, MousePointerClick } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import { useIsPhone } from "@/components/wf";

import { howToFor } from "./ward-help-access";
import { howToHref } from "./ward-help-href";
import { showWardHowTo } from "./ward-help-events";
import { canShowMe, HOW_TO_IDS, HOW_TOS, type HowTo } from "./ward-help-howto";
import type { WardTourRole } from "./ward-help-store";
import { recordHowToUsed } from "./ward-help-usage";
import styles from "./ward-help-sheet.module.css";

/** "3 steps", or nothing for an answer with no Show me. */
function stepsLabel(howTo: HowTo): string | undefined {
  const count = howTo.showMe?.length ?? 0;
  return count ? `${count} ${count === 1 ? "step" : "steps"}` : undefined;
}

/**
 * One how-to as a folded row: the task, how many Show me steps it has, and, opened, its answer with
 * Show me (walks the real screen, pressing nothing) and Go there. Shared by How do I… and the Ask
 * box, so a task looks and behaves the same wherever Help lists it. Opening, Show me and Go there
 * count towards the "most used" card in Settings, by id only.
 */
export function HowToRow({
  howTo,
  role,
  home,
  pathname,
  expanded,
  onToggle,
  onClose,
  showMeOn,
  actions = true,
  testPrefix,
}: {
  howTo: HowTo;
  role: WardTourRole;
  home: string | undefined;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  showMeOn: boolean;
  /** False for another desk's task: the answer only, no doors this desk cannot use. */
  actions?: boolean;
  testPrefix: "ward-help-ask" | "ward-help-task";
}) {
  const id = useId();
  const phone = useIsPhone();
  const href = actions ? howToHref(howTo.go, role, home) : undefined;
  // Go there is offered only when the job is done somewhere else, or on a tab of this page (Settings).
  const goThere = href && (href.includes("#") || href !== pathname) ? href : undefined;
  const showMe = actions && showMeOn && showMeAvailable(howTo, role, home, phone);
  // A phone screen without the button says where the job is done instead of offering Show me.
  const computerOnly = actions && showMeOn && phone && Boolean(howTo.computerOnly);
  const steps = showMeOn && showMe ? stepsLabel(howTo) : computerOnly ? "On a computer" : undefined;
  return (
    <li data-testid={`${testPrefix}-answer-${howTo.id}`}>
      <button
        type="button"
        className={styles.answerTitle}
        aria-expanded={expanded}
        aria-controls={`${id}-answer`}
        onClick={() => {
          if (!expanded) recordHowToUsed(howTo.id, HOW_TO_IDS);
          onToggle();
        }}
      >
        <span className={styles.answerName}>{howTo.title}</span>
        {steps && actions ? <span className={styles.answerMeta}>{steps}</span> : null}
        <ChevronDown aria-hidden="true" className={styles.caret} strokeWidth={1.75} />
      </button>
      {expanded ? (
        <div id={`${id}-answer`} className={styles.answerBody}>
          <p className={styles.text}>{howTo.answer}</p>
          {computerOnly ? (
            <p className={styles.note} data-testid={`${testPrefix}-computer-only`}>
              This is done on a computer: the phone screen has no such button.
            </p>
          ) : null}
          {showMe || goThere ? (
            <div className={styles.actions}>
              {showMe ? (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => {
                    recordHowToUsed(howTo.id, HOW_TO_IDS);
                    showWardHowTo(howTo.id);
                  }}
                  data-testid={`${testPrefix}-show-me`}
                >
                  <MousePointerClick aria-hidden="true" strokeWidth={2} />
                  Show me
                </button>
              ) : null}
              {goThere ? (
                <Link
                  href={goThere}
                  className={styles.secondaryButton}
                  onClick={() => {
                    recordHowToUsed(howTo.id, HOW_TO_IDS);
                    onClose();
                  }}
                  data-testid={`${testPrefix}-go`}
                >
                  Go there
                  <ArrowRight aria-hidden="true" strokeWidth={2} />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Whether Show me can walk this task for this desk on this device: it has steps the device draws,
 * and any screen it opens is one this desk may open (else it could only say "not on the screen").
 */
export function showMeAvailable(howTo: HowTo, role: WardTourRole, home: string | undefined, phone: boolean): boolean {
  return canShowMe(howTo, phone) && (!howTo.go || howToHref(howTo.go, role, home) !== undefined);
}

/**
 * This login's tasks: those named for its desk that it can actually do, on screens it can open
 * (audit finding 11, Josh 31 Oct 2026; `howToFor`).
 */
export function tasksForDesk(role: WardTourRole): readonly HowTo[] {
  return HOW_TOS.filter((howTo) => howToFor(howTo, role));
}

"use client";

import { ArrowRight, ChevronDown, Compass, MousePointerClick } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { useIsPhone } from "@/components/wf";

import { howToFor } from "./ward-help-access";
import type { ScreenHelp } from "./ward-help-content";
import { howToHref } from "./ward-help-href";
import { showWardHowTo } from "./ward-help-events";
import { canShowMe, HOW_TO_IDS, HOW_TO_TOPICS, HOW_TOS, type HowTo } from "./ward-help-howto";
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

/**
 * HOW DO I…: the desk's common tasks (Josh, 30 Oct 2026: "common tasks or questions specifically for
 * the app and when clicked on there is launched the interactive help"). Josh, 31 Oct 2026: Help opens
 * here, and the tour is its first row, taken only by choice. Then "On this screen": the screen in
 * view, its own tasks and its questions. Then the rest in fixed groups (`HOW_TO_TOPICS`), each in the
 * list's own order: grouping only, never ranking. One answer is open at a time; `openTask` opens one
 * on arrival (Show me's Back to Help returns here with its task open).
 */
export function WardHelpTasks({
  role,
  home,
  pathname,
  onClose,
  showMeOn,
  openTask,
  screen,
  onTour,
}: {
  role: WardTourRole;
  home: string | undefined;
  pathname: string;
  onClose: () => void;
  showMeOn: boolean;
  openTask?: string;
  /** Help for the screen in view, when it has its own. */
  screen?: ScreenHelp;
  /** Starts this desk's tour. */
  onTour?: () => void;
}) {
  const phone = useIsPhone();
  const [open, setOpen] = useState<string | undefined>(openTask);
  const { here, groups } = useMemo(() => {
    const mine = tasksForDesk(role);
    const isHere = (howTo: HowTo) => howToHref(howTo.go, role, home)?.split("#")[0] === pathname;
    return {
      here: mine.filter(isHere),
      groups: HOW_TO_TOPICS.map((topic) => ({
        topic,
        tasks: mine.filter((howTo) => howTo.topic === topic && !isHere(howTo)),
      })).filter((group) => group.tasks.length > 0),
    };
  }, [home, pathname, role]);

  const row = (howTo: HowTo) => (
    <HowToRow
      key={howTo.id}
      howTo={howTo}
      role={role}
      home={home}
      pathname={pathname}
      expanded={open === howTo.id}
      onToggle={() => setOpen(open === howTo.id ? undefined : howTo.id)}
      onClose={onClose}
      showMeOn={showMeOn}
      testPrefix="ward-help-task"
    />
  );

  return (
    <section className={styles.stack} aria-labelledby="ward-help-tasks-title" data-testid="ward-help-tasks">
      <h3 id="ward-help-tasks-title" className="sr-only">
        How do I…
      </h3>
      {onTour ? (
        <ul className={styles.card}>
          <li>
            <button type="button" className={styles.linkRow} onClick={onTour} data-testid="ward-help-view-tour">
              <span className={styles.rowIcon} aria-hidden="true">
                <Compass aria-hidden="true" strokeWidth={1.75} />
              </span>
              <span className={styles.answerName}>Take the tour of your desk</span>
              <span className={styles.answerMeta}>About 2 minutes</span>
            </button>
          </li>
        </ul>
      ) : null}
      <div className={styles.group} data-testid="ward-help-tasks-here">
        <h4 className={styles.groupHeading}>On this screen{screen ? ` · ${screen.title}` : ""}</h4>
        <div className={styles.stack} data-testid={screen ? "ward-help-screen" : undefined}>
          {screen ? <p className={styles.text}>{screen.purpose}</p> : null}
          {here.length ? (
            <ul className={styles.card}>{here.map(row)}</ul>
          ) : (
            <p className={styles.empty}>No task of yours starts on this screen. Pick one below.</p>
          )}
          {screen?.questions?.length ? <Questions items={screen.questions} /> : null}
          {screen ? (
            <details className={styles.referenceSection}>
              <summary>Main actions on this screen</summary>
              <PointCard points={phone ? (screen.phoneActions ?? screen.actions) : screen.actions} />
            </details>
          ) : null}
        </div>
      </div>
      {groups.map((group) => (
        <div key={group.topic} className={styles.group}>
          <h4 className={styles.groupHeading}>{group.topic}</h4>
          <ul className={styles.card}>{group.tasks.map(row)}</ul>
        </div>
      ))}
      <p className={styles.note}>{"Another desk's job? Search Help above to read how it is done."}</p>
    </section>
  );
}

/** A screen's questions, each answer folded until asked for, one open at a time (redesign, #1118). */
function Questions({ items }: { items: readonly { question: string; answer: string }[] }) {
  const id = useId();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ul className={styles.card} data-testid="ward-help-questions">
      {items.map((item, index) => {
        const expanded = open === index;
        return (
          <li key={item.question}>
            <button
              type="button"
              className={styles.answerTitle}
              aria-expanded={expanded}
              aria-controls={`${id}-${index}`}
              onClick={() => setOpen(expanded ? null : index)}
            >
              <span className={styles.answerName}>{item.question}</span>
              <ChevronDown aria-hidden="true" className={styles.caret} strokeWidth={1.75} />
            </button>
            <p id={`${id}-${index}`} className={styles.answer} hidden={!expanded}>
              {item.answer}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/** A card of short points. Round 2 (#1118): the row dividers part them, so no dot. */
export function PointCard({ points, testId }: { points: readonly string[]; testId?: string }) {
  return (
    <ul className={styles.card} data-testid={testId}>
      {points.map((point) => (
        <li key={point} className={styles.row}>
          <span className={styles.text}>{point}</span>
        </li>
      ))}
    </ul>
  );
}

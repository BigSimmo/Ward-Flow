"use client";

import { ArrowRight, ChevronDown, MousePointerClick } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { useIsPhone } from "@/components/wf";

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
  // Go there is offered only when the job is done somewhere else.
  const goThere = href && href.split("#")[0] !== pathname ? href : undefined;
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

/** This desk's tasks: those for every desk, and those named for it. */
export function tasksForDesk(role: WardTourRole): readonly HowTo[] {
  return HOW_TOS.filter((howTo) => howTo.desks === "all" || howTo.desks.includes(role));
}

/**
 * HOW DO I…: the desk's common tasks (Josh, 30 Oct 2026: "common tasks or questions specifically for
 * the app and when clicked on there is launched the interactive help"). Tasks done on the screen in
 * view come first, then the rest in fixed groups (`HOW_TO_TOPICS`), each in the list's own order:
 * grouping only, never ranking. One answer is open at a time; `openTask` opens one on arrival (Show
 * me's Back to Help returns here with its task open).
 */
export function WardHelpTasks({
  role,
  home,
  pathname,
  onClose,
  showMeOn,
  openTask,
}: {
  role: WardTourRole;
  home: string | undefined;
  pathname: string;
  onClose: () => void;
  showMeOn: boolean;
  openTask?: string;
}) {
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
      <p className={styles.text}>
        {showMeOn
          ? "Pick a task. Show me lights each control on the real screen in turn; it never presses anything for you."
          : "Pick a task to read how it is done."}
      </p>
      <div className={styles.group} data-testid="ward-help-tasks-here">
        <h4 className={styles.groupHeading}>On this screen</h4>
        {here.length ? (
          <ul className={styles.card}>{here.map(row)}</ul>
        ) : (
          <p className={styles.empty}>No task here starts on this screen. Pick one below.</p>
        )}
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

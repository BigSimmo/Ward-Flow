"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { useIsPhone } from "@/components/wf";

import type { WardTourRole } from "@/components/ward-management/help/ward-help-store";
import styles from "@/components/ward-management/help/ward-help-sheet.module.css";

import { howToHref } from "./help-href";
import { TASK_TOPICS, tasksForDesk, type MockTask } from "./help-tasks-data";
import local from "./help.module.css";

/**
 * Whether Show me can walk this task for this desk on this device (#1119's `showMeAvailable`): it has
 * steps, the device draws them, and any screen it opens is one this desk may open.
 */
function canShowTask(task: MockTask, role: WardTourRole, home: string | undefined, phone: boolean): boolean {
  if (!task.showMe?.length || (phone && task.computerOnly)) return false;
  return !task.go || howToHref(task.go, role, home) !== undefined;
}

/**
 * One task: its name (which folds open the answer) and a quiet Show me at the row's end, so the way
 * into the walkthrough is in view without opening anything. A phone shows "On a computer" for a job
 * it has no button for. Opened, the answer has Go there when the job is done on another screen.
 */
function TaskRow({
  task,
  role,
  home,
  pathname,
  expanded,
  onToggle,
  onClose,
  onShowMe,
}: {
  task: MockTask;
  role: WardTourRole;
  home: string | undefined;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  onShowMe: (id: string) => void;
}) {
  const id = useId();
  const phone = useIsPhone();
  const href = howToHref(task.go, role, home);
  const goThere = href && href.split("#")[0] !== pathname ? href : undefined;
  const showMe = canShowTask(task, role, home, phone);
  const computerOnly = phone && task.computerOnly;
  const steps = task.showMe?.length ?? 0;
  return (
    <li className={local.task} data-testid={`ward-help-task-answer-${task.id}`}>
      <div className={local.taskHead}>
        <button
          type="button"
          className={local.taskTitle}
          aria-expanded={expanded}
          aria-controls={`${id}-answer`}
          onClick={onToggle}
        >
          <span>{task.title}</span>
          <ChevronDown aria-hidden="true" className={local.taskCaret} strokeWidth={1.75} />
        </button>
        {showMe ? (
          <button
            type="button"
            className={local.showMe}
            onClick={() => onShowMe(task.id)}
            aria-label={`Show me: ${task.title}, ${steps} ${steps === 1 ? "step" : "steps"}`}
            data-testid="ward-help-task-show-me"
          >
            Show me
          </button>
        ) : computerOnly ? (
          <span className={local.taskMeta}>On a computer</span>
        ) : null}
      </div>
      {expanded ? (
        <div id={`${id}-answer`} className={local.taskBody}>
          <p className={styles.text}>{task.answer}</p>
          {computerOnly ? (
            <p className={styles.note} data-testid="ward-help-task-computer-only">
              This is done on a computer: the phone screen has no such button.
            </p>
          ) : null}
          {goThere ? (
            <Link href={goThere} className={local.goThere} onClick={onClose} data-testid="ward-help-task-go">
              Go there
              <ArrowRight aria-hidden="true" strokeWidth={2} />
            </Link>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * HOW DO I… (draft PR #1119, D-91): the desk's common tasks. Those done on this screen come first
 * under "On this screen" (the heading is drawn only when there are some), then the rest in fixed
 * groups, each in the list's own order: grouping only, never ranking. One answer is open at a time;
 * `openTask` opens one on arrival (Show me's Back to Help returns here with its task open).
 */
export function HelpTasks({
  role,
  home,
  pathname,
  onClose,
  onShowMe,
  openTask,
}: {
  role: WardTourRole;
  home: string | undefined;
  pathname: string;
  onClose: () => void;
  onShowMe: (id: string) => void;
  openTask?: string;
}) {
  const [open, setOpen] = useState<string | undefined>(openTask);
  const { here, groups } = useMemo(() => {
    const mine = tasksForDesk(role);
    const isHere = (task: MockTask) => howToHref(task.go, role, home)?.split("#")[0] === pathname;
    return {
      here: mine.filter(isHere),
      groups: TASK_TOPICS.map((topic) => ({
        topic,
        tasks: mine.filter((task) => task.topic === topic && !isHere(task)),
      })).filter((group) => group.tasks.length > 0),
    };
  }, [home, pathname, role]);

  const row = (task: MockTask) => (
    <TaskRow
      key={task.id}
      task={task}
      role={role}
      home={home}
      pathname={pathname}
      expanded={open === task.id}
      onToggle={() => setOpen(open === task.id ? undefined : task.id)}
      onClose={onClose}
      onShowMe={onShowMe}
    />
  );

  return (
    <section className={styles.stack} aria-labelledby="ward-help-tasks-title" data-testid="ward-help-tasks">
      <h3 id="ward-help-tasks-title" className="sr-only">
        How do I…
      </h3>
      <p className={local.tasksLead}>
        Pick a task. Show me lights each control on the real screen in turn; it never presses anything for you.
      </p>
      {here.length ? (
        <div className={styles.group} data-testid="ward-help-tasks-here">
          <h4 className={styles.groupHeading}>On this screen</h4>
          <ul className={styles.card}>{here.map(row)}</ul>
        </div>
      ) : null}
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

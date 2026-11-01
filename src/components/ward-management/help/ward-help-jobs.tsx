"use client";

import {
  ArrowRight,
  BedDouble,
  ChevronDown,
  ClipboardList,
  Compass,
  Info,
  LayoutDashboard,
  Play,
  SlidersHorizontal,
  Truck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { Button, buttonClass, useIsPhone } from "@/components/wf";

import { readTourStep, type WardTourRole } from "./ward-help-store";
import { tourSteps, type TourDevice } from "./ward-tour-steps";
import { useTourFacts } from "./ward-tour-facts";
import type { ScreenHelp } from "./ward-help-content";

import { howToHref } from "./ward-help-href";
import { HOW_TO_IDS, HOW_TO_TOPICS, type HowTo } from "./ward-help-howto";
import { showMeAvailable, tasksForDesk } from "./ward-help-task-list";
import { recordHowToUsed } from "./ward-help-usage";
import s from "./ward-help-panel.module.css";

type Topic = (typeof HOW_TO_TOPICS)[number];

/** Each topic's icon and short chip name. */
const TOPIC_LOOK: Readonly<Record<Topic, { icon: LucideIcon; chip: string }>> = {
  "Beds and referrals": { icon: BedDouble, chip: "Beds" },
  Transport: { icon: Truck, chip: "Transport" },
  "Handover and reports": { icon: ClipboardList, chip: "Handover" },
  "Finding your way": { icon: Compass, chip: "Finding your way" },
  "Settings and display": { icon: SlidersHorizontal, chip: "Settings" },
};

/** How many tasks the list shows before "Show more". */
const FIRST = 9;

/**
 * Whether Show me can walk this task for this desk on this device (`showMeAvailable`), with the
 * Show me switch on (the help-ask flag; without it a task offers its answer and Go to only).
 */
export function canShowTask(
  task: HowTo,
  role: WardTourRole,
  home: string | undefined,
  phone: boolean,
  showMeOn: boolean,
): boolean {
  return showMeOn && showMeAvailable(task, role, home, phone);
}

function PlayMark() {
  return (
    <span className={s.play} aria-hidden="true">
      <Play aria-hidden="true" strokeWidth={0} />
    </span>
  );
}

/**
 * One task. The row folds open the answer; a small play mark says Show me can walk it. Open, the
 * answer has the steps Show me will light, one filled "Show me on screen", and "Go to" when the job
 * is done on another screen.
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
  screenName,
  showMeOn,
}: {
  task: HowTo;
  role: WardTourRole;
  home: string | undefined;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  onShowMe: (id: string) => void;
  screenName: (href: string) => string;
  showMeOn: boolean;
}) {
  const id = useId();
  const phone = useIsPhone();
  const href = howToHref(task.go, role, home);
  // Another Settings tab is still somewhere to go, even while Help is open on Settings.
  const goThere = href && (href.includes("#") || href !== pathname) ? href : undefined;
  const showMe = canShowTask(task, role, home, phone, showMeOn);
  const computerOnly = phone && task.computerOnly;
  return (
    <li className={s.task} data-testid={`ward-help-task-answer-${task.id}`}>
      <button
        type="button"
        className={s.taskHead}
        aria-expanded={expanded}
        aria-controls={`${id}-answer`}
        onClick={onToggle}
      >
        <span className={s.taskName}>{task.title}</span>
        {goThere && !expanded ? <span className={s.place}>{screenName(goThere)}</span> : null}
        {computerOnly ? <span className={s.elsewhere}>On a computer</span> : showMe ? <PlayMark /> : null}
        <ChevronDown aria-hidden="true" className={s.caret} strokeWidth={1.75} />
      </button>
      {expanded ? (
        <div id={`${id}-answer`} className={s.answer}>
          <p className={s.answerText}>{task.answer}</p>
          {task.showMe?.length && !computerOnly ? (
            <ol className={s.steps} aria-label="Steps">
              {task.showMe.map((step) => (
                <li key={step.title}>
                  <div>
                    <b>{step.title}</b>
                    <span>{step.body}</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
          {computerOnly ? (
            <p className={s.note} data-testid="ward-help-task-computer-only">
              This is done on a computer. The phone screen has no button for it.
            </p>
          ) : null}
          {showMe || goThere ? (
            <div className={s.answerActions}>
              {showMe ? (
                <Button
                  variant="pri"
                  icon={Play}
                  onClick={() => onShowMe(task.id)}
                  data-testid="ward-help-task-show-me"
                >
                  Show me on screen
                </Button>
              ) : null}
              {goThere ? (
                <Link
                  href={goThere}
                  className={buttonClass({ variant: showMe ? "ghost" : "sec" })}
                  onClick={() => {
                    recordHowToUsed(task.id, HOW_TO_IDS);
                    onClose();
                  }}
                  data-testid="ward-help-task-go"
                >
                  Go to {screenName(goThere)}
                  <ArrowRight aria-hidden="true" size={14} strokeWidth={2} />
                </Link>
              ) : null}
            </div>
          ) : null}
          {showMe ? (
            <p className={s.safety}>
              <Info aria-hidden="true" strokeWidth={1.75} />
              {goThere
                ? `Show me opens ${screenName(goThere)}, then lights each control in turn. It never presses anything for you.`
                : "Show me lights each control in turn. It never presses anything for you."}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** The screen's main actions, folded: "How this screen works". */
function HowItWorks({ actions }: { actions: readonly string[] }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  if (!actions.length) return null;
  return (
    <div className={s.works}>
      <button
        type="button"
        className={s.worksToggle}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        How this screen works
        <ChevronDown aria-hidden="true" className={s.caret} strokeWidth={1.75} />
      </button>
      <ul id={id} className={s.worksList} hidden={!open}>
        {actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
    </div>
  );
}

/** The tour as one row: where this desk stopped, and Start or Resume. */
function TourRow({ role, onTour }: { role: WardTourRole; onTour: () => void }) {
  const device: TourDevice = useIsPhone() ? "phone" : "desk";
  const { facts } = useTourFacts(role);
  const total = useMemo(() => tourSteps(role, device, facts).length, [role, device, facts]);
  // The tour's own saved place (`ward-help-store`), read once when Help opens.
  const [at] = useState(() => Math.min(readTourStep(role), Math.max(0, total - 1)));
  const minutes = Math.max(1, Math.round(((total - at) * (device === "phone" ? 12 : 15)) / 60));
  return (
    <div className={`${s.card} ${s.tour}`} data-testid="ward-help-tour-row">
      <span className={s.tourIcon} aria-hidden="true">
        <Compass aria-hidden="true" strokeWidth={1.75} />
      </span>
      <div className={s.tourText}>
        <b>Tour of your desk</b>
        <span>
          {at > 0 ? `Stopped at ${at + 1} of ${total}` : `${total} short steps`} · about {minutes} min
        </span>
        <span className={s.segments} aria-hidden="true">
          {Array.from({ length: total }, (_, index) => (
            <i key={index} data-done={index < at ? "" : undefined} />
          ))}
        </span>
      </div>
      <Button variant="sec" onClick={onTour} data-testid="ward-help-view-tour">
        {at > 0 ? "Resume" : "Start"}
      </Button>
    </div>
  );
}

/**
 * HOW DO I…: this screen first, as a card of its own jobs, then the tour, then the desk's jobs by
 * topic. Topic chips narrow the list; grouping only, never ranking. One answer is open at a time;
 * `openTask` opens one on arrival (Show me's Back to Help returns here with its task open).
 */
export function HelpTasks({
  role,
  home,
  pathname,
  screen,
  onClose,
  onShowMe,
  onTour,
  onSearch,
  openTask,
  screenName,
  showMeOn,
}: {
  role: WardTourRole;
  home: string | undefined;
  pathname: string;
  screen: (ScreenHelp & { id: string }) | undefined;
  onClose: () => void;
  onShowMe: (id: string) => void;
  onTour: () => void;
  onSearch: () => void;
  openTask?: string;
  screenName: (href: string) => string;
  showMeOn: boolean;
}) {
  const phone = useIsPhone();
  const [open, setOpen] = useState<string | undefined>(openTask);
  const [topic, setTopic] = useState<Topic | "all">("all");
  const [all, setAll] = useState(Boolean(openTask));
  const { here, mine } = useMemo(() => {
    const desk = tasksForDesk(role);
    const isHere = (task: HowTo) => howToHref(task.go, role, home)?.split("#")[0] === pathname;
    return { here: desk.filter(isHere), mine: desk };
  }, [home, pathname, role]);

  const counts = HOW_TO_TOPICS.map((name) => ({ name, n: mine.filter((task) => task.topic === name).length })).filter(
    (entry) => entry.n > 0,
  );
  const shown = topic === "all" ? mine : mine.filter((task) => task.topic === topic);
  const limit = all || topic !== "all" ? shown.length : FIRST;
  // The first `limit` tasks in topic order, still grouped by topic.
  const ordered = HOW_TO_TOPICS.flatMap((name) => shown.filter((task) => task.topic === name));
  const kept = new Set(ordered.slice(0, limit));
  const groups = HOW_TO_TOPICS.map((name) => {
    const tasks = shown.filter((task) => task.topic === name);
    return { name, tasks: tasks.filter((task) => kept.has(task)), n: tasks.length };
  }).filter((group) => group.tasks.length > 0);

  // Usage counts are ids only, the same as the old list: an answer opened, Show me or Go to.
  const showMe = (id: string) => {
    recordHowToUsed(id, HOW_TO_IDS);
    onShowMe(id);
  };
  // Opening a task always reveals it, even when it sits past the first few or outside the topic.
  const reveal = (id: string) => {
    recordHowToUsed(id, HOW_TO_IDS);
    setOpen(id);
    setAll(true);
    setTopic("all");
  };

  const row = (task: HowTo) => (
    <TaskRow
      key={task.id}
      task={task}
      role={role}
      home={home}
      pathname={pathname}
      expanded={open === task.id}
      onToggle={() => (open === task.id ? setOpen(undefined) : reveal(task.id))}
      onClose={onClose}
      onShowMe={showMe}
      screenName={screenName}
      showMeOn={showMeOn}
    />
  );

  return (
    <>
      {screen ? (
        <section className={`${s.card} ${s.here}`} aria-labelledby="ward-help-here" data-testid="ward-help-tasks-here">
          <div className={s.hereHead}>
            <span className={s.hereIcon} aria-hidden="true">
              <LayoutDashboard aria-hidden="true" strokeWidth={1.75} />
            </span>
            <div>
              <h3 id="ward-help-here" className={s.hereTitle}>
                <span>On this screen:</span> {screen.title}
              </h3>
              <p className={s.herePurpose}>{screen.purpose}</p>
            </div>
          </div>
          {here.length ? (
            <div className={s.tiles}>
              {here.slice(0, 4).map((task) => {
                const can = canShowTask(task, role, home, phone, showMeOn);
                return (
                  <button
                    key={task.id}
                    type="button"
                    className={s.tile}
                    onClick={() => (can ? showMe(task.id) : reveal(task.id))}
                  >
                    <span className={s.tileTitle}>{task.title}</span>
                    <span className={s.tileAction}>
                      {can ? (
                        <>
                          <PlayMark />
                          Show me
                        </>
                      ) : (
                        "Read how"
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <HowItWorks actions={phone ? (screen.phoneActions ?? screen.actions) : screen.actions} />
        </section>
      ) : null}

      <TourRow role={role} onTour={onTour} />

      <section className={s.section} aria-labelledby="ward-help-jobs" data-testid="ward-help-tasks">
        <h3 id="ward-help-jobs" className={s.sectionHead}>
          Your jobs <span className={s.n}>{mine.length}</span>
        </h3>
        <div className={s.chips} role="group" aria-label="Show jobs about">
          <button type="button" className={s.chip} aria-pressed={topic === "all"} onClick={() => setTopic("all")}>
            All <span className={s.n}>{mine.length}</span>
          </button>
          {counts.map((entry) => {
            const Icon = TOPIC_LOOK[entry.name].icon;
            return (
              <button
                key={entry.name}
                type="button"
                className={s.chip}
                aria-pressed={topic === entry.name}
                onClick={() => setTopic(entry.name)}
              >
                <Icon aria-hidden="true" strokeWidth={1.75} />
                {TOPIC_LOOK[entry.name].chip} <span className={s.n}>{entry.n}</span>
              </button>
            );
          })}
        </div>
      </section>

      {groups.map((group, index) => {
        const Icon = TOPIC_LOOK[group.name].icon;
        const last = index === groups.length - 1;
        return (
          <section key={group.name} className={s.section} aria-labelledby={`ward-help-topic-${index}`}>
            <h4 id={`ward-help-topic-${index}`} className={s.sectionHead}>
              <span className={s.sectionHeadIcon} aria-hidden="true">
                <Icon aria-hidden="true" strokeWidth={1.75} />
              </span>
              {group.name} <span className={s.n}>{group.n}</span>
            </h4>
            <div className={s.card}>
              <ul className={s.list}>{group.tasks.map(row)}</ul>
              {last && limit < shown.length ? (
                <button type="button" className={s.more} onClick={() => setAll(true)}>
                  Show {shown.length - limit} more
                  <ChevronDown aria-hidden="true" strokeWidth={1.75} />
                </button>
              ) : null}
            </div>
          </section>
        );
      })}

      <p className={s.note}>
        Another desk&rsquo;s job?{" "}
        <button type="button" className={s.inlineLink} onClick={onSearch}>
          Search
        </button>{" "}
        covers every desk.
      </p>
    </>
  );
}

"use client";

import { useEffectiveWardAccess } from "../shell/ward-access-store";
import type { WardAccess } from "../ward-role-access";
import { howToFor } from "./ward-help-access";

import {
  ArrowRight,
  BedSingle,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Compass,
  ExternalLink,
  Info,
  Link2,
  ListChecks,
  Play,
  Printer,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  Ambulance,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Button, buttonClass, foldLimit, ShowMoreRow, useIsPhone } from "@/components/wf";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";

import { type WardTourRole } from "./ward-help-store";
import { TourRow } from "./ward-help-tour-row";
import type { ScreenHelp } from "./ward-help-content";

import { howToHref } from "./ward-help-href";
import { HOW_TO_IDS, HOW_TO_TOPICS, HOW_TOS, showMeSteps, type HowTo } from "./ward-help-howto";
import { aroundId, SCREEN_TOURS, walkPlaysHere } from "./ward-help-screen-tours";
import { checklistsForDesk } from "./ward-help-checklists";
import { WardHelpPracticeCard } from "./ward-help-practice-card";
import { useOptionalWardFlowSelect } from "../ward-flow-provider";
import { showMeAvailable, tasksForDesk } from "./ward-help-task-list";
import { helpLinkHref } from "./ward-help-events";
import { recordHelpFeedback } from "./ward-help-feedback";
import { recordHowToUsed } from "./ward-help-usage";
import s from "./ward-help-panel.module.css";

type Topic = (typeof HOW_TO_TOPICS)[number];

/** Each topic's icon and short chip name. */
const TOPIC_LOOK: Readonly<Record<Topic, { icon: LucideIcon; chip: string }>> = {
  "Beds and referrals": { icon: BedSingle, chip: "Beds" },
  Transport: { icon: Ambulance, chip: "Transport" },
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
  pathname: string = typeof window === "undefined" ? "" : window.location.pathname,
  access?: WardAccess,
): boolean {
  return showMeOn && showMeAvailable(task, role, home, phone, access) && walkPlaysHere(task, pathname);
}

/** The small play mark that says Show me can walk a job. `label` names it where no words sit beside it. */
function PlayMark({ label }: { label?: boolean }) {
  return (
    <>
      <span className={s.play} aria-hidden="true">
        <Play aria-hidden="true" strokeWidth={0} />
      </span>
      {label ? <span className="sr-only">Show me available</span> : null}
    </>
  );
}

/** How long Copy link reads "Link copied" before it goes back. */
const COPIED_FOR = 2000;

/**
 * The foot of an open answer: "Was this helpful?" (counted on this device, by id only) and Copy
 * link, which copies an address that opens Help at this job (`#help=<id>`, nothing typed).
 */
function AnswerFoot({ id, path }: { id: string; path: string }) {
  const [voted, setVoted] = useState(false);
  const [copy, setCopy] = useState<"idle" | "done" | "failed">("idle");
  const copyButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (copy !== "done") return undefined;
    const timer = window.setTimeout(() => setCopy("idle"), COPIED_FOR);
    return () => window.clearTimeout(timer);
  }, [copy]);
  const vote = (helpful: boolean) => {
    recordHelpFeedback(id, helpful, HOW_TO_IDS);
    setVoted(true);
    // Yes and No give way to the thanks, so focus moves on to Copy link instead of being lost.
    copyButton.current?.focus();
  };
  return (
    <div className={s.answerFoot} data-testid="ward-help-task-foot">
      {/* Always in the page, so the thanks is announced when its words arrive. */}
      <span className={s.footStatus} role="status">
        {voted ? "Thanks. Counted on this device only." : ""}
      </span>
      {voted ? null : (
        <span className={s.helpful} role="group" aria-label="Was this helpful?">
          <span aria-hidden="true">Was this helpful?</span>
          <Button
            variant="ghost"
            size="sm"
            icon={ThumbsUp}
            onClick={() => vote(true)}
            data-testid="ward-help-helpful-yes"
          >
            Yes
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={ThumbsDown}
            onClick={() => vote(false)}
            data-testid="ward-help-helpful-no"
          >
            No
          </Button>
        </span>
      )}
      <span className={s.copy}>
        <Button
          ref={copyButton}
          variant="ghost"
          size="sm"
          icon={copy === "done" ? Check : Link2}
          onClick={() => {
            copyTextToClipboard(helpLinkHref(window.location.origin, path, id)).then(
              () => setCopy("done"),
              () => setCopy("failed"),
            );
          }}
          data-copied={copy === "done" ? "" : undefined}
          data-testid="ward-help-copy-link"
        >
          {copy === "done" ? "Link copied" : "Copy link"}
        </Button>
        <span className={copy === "failed" ? s.copyFailed : "sr-only"} aria-live="polite">
          {copy === "done" ? "Link copied" : copy === "failed" ? "Could not copy the link" : ""}
        </span>
      </span>
    </div>
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
  const access = useEffectiveWardAccess();
  const phone = useIsPhone();
  const permitted = howToFor(task, role, access);
  const href = permitted ? howToHref(task.go, role, home) : undefined;
  // Another Settings tab is still somewhere to go, even while Help is open on Settings.
  const goThere = href && (href.includes("#") || href !== pathname) ? href : undefined;
  const showMe = canShowTask(task, role, home, phone, showMeOn, pathname, access);
  const computerOnly = phone && task.computerOnly;
  const steps = permitted ? showMeSteps(task, phone ? "phone" : "desk", role) : [];
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
        {computerOnly ? <span className={s.elsewhere}>On a computer</span> : showMe ? <PlayMark label /> : null}
        <ChevronDown aria-hidden="true" className={s.caret} strokeWidth={1.75} />
      </button>
      {expanded ? (
        <div id={`${id}-answer`} className={s.answer}>
          <p className={s.answerText}>{task.answer}</p>
          {steps.length && !computerOnly ? (
            <ol className={s.steps} aria-label="Steps">
              {steps.map((step) => (
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
                  <ArrowRight aria-hidden="true" size={14} strokeWidth={1.75} />
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
          <AnswerFoot id={task.id} path={href ?? pathname} />
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
        <ListChecks aria-hidden="true" className={s.worksIcon} strokeWidth={1.75} />
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

/** Practice needs the live demo record, so it shows only where the Ward Flow data is mounted. */
function PracticeWhenLive({
  role,
  onShowMe,
  showMeOn,
}: {
  role: WardTourRole;
  onShowMe: (id: string) => void;
  showMeOn: boolean;
}) {
  return useOptionalWardFlowSelect("scenario") ? (
    <WardHelpPracticeCard role={role} onShowMe={onShowMe} showMeOn={showMeOn} />
  ) : null;
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
  onOpenChecklist,
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
  /** Opens one checklist as a view inside Help (`ward-help-checklist-view.tsx`). */
  onOpenChecklist?: (id: string) => void;
}) {
  const phone = useIsPhone();
  const access = useEffectiveWardAccess();
  const checklists = useMemo(() => checklistsForDesk(role), [role]);
  const [open, setOpen] = useState<string | undefined>(openTask);
  const [topic, setTopic] = useState<Topic | "all">("all");
  const [all, setAll] = useState(Boolean(openTask));
  const { here, mine } = useMemo(() => {
    const desk = tasksForDesk(role, access);
    const isHere = (task: HowTo) => howToHref(task.go, role, home)?.split("#")[0] === pathname;
    return { here: desk.filter(isHere), mine: desk };
  }, [access, home, pathname, role]);
  // This screen's walk round (`ward-help-screen-tours.ts`), when Show me can play it here.
  const around = useMemo(() => {
    const walk = screen ? HOW_TOS.find((each) => each.id === aroundId(screen.id)) : undefined;
    return walk && canShowTask(walk, role, home, phone, showMeOn, pathname, access) ? walk : undefined;
  }, [access, home, pathname, phone, role, screen, showMeOn]);
  const aroundSteps = around ? showMeSteps(around, phone ? "phone" : "desk", role).length : 0;
  const hereTiles = here.slice(0, 4);

  const counts = HOW_TO_TOPICS.map((name) => ({ name, n: mine.filter((task) => task.topic === name).length })).filter(
    (entry) => entry.n > 0,
  );
  const anyShowMe = mine.some((task) => canShowTask(task, role, home, phone, showMeOn, pathname, access));
  const shown = topic === "all" ? mine : mine.filter((task) => task.topic === topic);
  const limit = all || topic !== "all" ? shown.length : foldLimit(shown.length, FIRST);
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
            <p className={s.hereEyebrow}>On this screen</p>
            <h3 id="ward-help-here" className={s.hereTitle}>
              <span className="sr-only">On this screen: </span>
              {screen.title}
            </h3>
            <p className={s.herePurpose}>{screen.purpose}</p>
          </div>
          {here.length || around ? (
            <div className={s.tiles}>
              {around ? (
                <button
                  type="button"
                  className={`${s.tile} ${s.aroundTile}`}
                  onClick={() => showMe(around.id)}
                  data-testid="ward-help-show-me-around"
                >
                  <span className={s.aroundDisc} aria-hidden="true">
                    <Play aria-hidden="true" strokeWidth={0} />
                  </span>
                  <span className={s.aroundText}>
                    <span className={s.tileTitle}>Show me around this screen</span>
                    <span className={s.aroundSub}>{aroundSteps} steps · this screen only</span>
                  </span>
                  <ArrowRight aria-hidden="true" className={s.aroundGo} strokeWidth={1.75} />
                </button>
              ) : null}
              {hereTiles.map((task) => {
                const can = canShowTask(task, role, home, phone, showMeOn, pathname, access);
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
                        <>
                          Read how
                          <ChevronRight aria-hidden="true" className={s.caret} strokeWidth={1.75} />
                        </>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <HowItWorks actions={phone ? (screen.phoneActions ?? screen.actions) : screen.actions} />
          {SCREEN_TOURS.some((tour) => tour.around === screen.id) ? (
            <a
              href={`/help/screens/${screen.id}.html`}
              target="_blank"
              rel="noopener noreferrer"
              className={s.printRow}
              data-testid="ward-help-screen-print"
            >
              <Printer aria-hidden="true" strokeWidth={1.75} />
              Printable screen guide (A4)
              <span className="sr-only"> (opens in a new tab)</span>
              <ExternalLink aria-hidden="true" className={s.printGo} strokeWidth={1.75} />
            </a>
          ) : null}
        </section>
      ) : null}

      {/* Learning the app in one place (Help overhaul, 9 Nov 2026): the tour, then practice. */}
      <section className={s.section} aria-labelledby="ward-help-learn" data-testid="ward-help-learn">
        <h3 id="ward-help-learn" className={s.sectionHead}>
          Learn Ward Flow
        </h3>
        <TourRow role={role} onTour={onTour} />
        {/* The access admin records no ward work, so there is nothing to practise. */}
        {role === "admin" ? null : <PracticeWhenLive role={role} onShowMe={onShowMe} showMeOn={showMeOn} />}
      </section>

      {checklists.length && onOpenChecklist ? (
        <section className={s.section} aria-labelledby="ward-help-checklists" data-testid="ward-help-checklists">
          <h3 id="ward-help-checklists" className={s.sectionHead}>
            Checklists <span className={s.n}>{checklists.length}</span>
          </h3>
          <div className={s.card}>
            <ul className={s.list}>
              {checklists.map((checklist) => (
                <li key={checklist.id} className={s.task}>
                  <button
                    type="button"
                    className={s.taskHead}
                    onClick={() => onOpenChecklist(checklist.id)}
                    data-testid={`ward-help-checklist-open-${checklist.id}`}
                  >
                    <ListChecks aria-hidden="true" className={s.rowIcon} strokeWidth={1.75} />
                    <span className={s.taskName}>{checklist.title}</span>
                    <span className={s.place}>{checklist.steps.length} steps</span>
                    <ChevronRight aria-hidden="true" className={s.caret} strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

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
        {anyShowMe ? (
          <p className={s.playKey}>
            <PlayMark />
            Show me can walk you through it on screen.
          </p>
        ) : null}
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
                <ShowMoreRow onClick={() => setAll(true)} expanded={false}>
                  Show {shown.length - limit} more
                </ShowMoreRow>
              ) : last && topic === "all" && foldLimit(shown.length, FIRST) < shown.length ? (
                // The longer list (5 Nov 2026) folds back, so the topics stay within reach.
                <ShowMoreRow onClick={() => setAll(false)} expanded>
                  Show fewer
                </ShowMoreRow>
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

"use client";

import { BookOpen, CircleHelp, Keyboard, Library, Search, Sparkles, UserRound, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";

import { TabPanel, Tabs, useIsPhone } from "@/components/wf";
import { Sheet } from "@/components/wf/sheet";
import barStyles from "@/components/ward-management/shell/ward-bar.module.css";
import { railEntries } from "@/components/ward-management/shell/ward-rail-entries";
import { CHROME_ROLE_LABELS } from "@/components/ward-management/ward-chrome-role";
import { WARD_HOME_HREF } from "@/components/ward-management/ward-nav";

import { useWardNetwork } from "../ward-flow-provider";
import { useExecutiveStatistics, useExecutiveStatisticsControl } from "../statistics/executive-statistics-context";

import { ADMIN_SETTINGS_HELP, glossaryForSites, screenHelpFor, type GlossaryTerm } from "./ward-help-content";
import type { HelpView } from "./ward-help-events";
import { findInHelp, foundRows, HelpFindResults, HelpTryAsking } from "./ward-help-find";
import { HOW_TOS } from "./ward-help-howto";
import { howToHref } from "./ward-help-href";
import { canShowTask, HelpTasks } from "./ward-help-jobs";
import s from "./ward-help-panel.module.css";
import { HelpQuestions, HelpReference, QUESTIONS_ICON } from "./ward-help-reference-tabs";
import type { HelpSearchResult } from "./ward-help-search-index";
import { useTourRole, type WardTourRole } from "./ward-help-store";
import { tasksForDesk } from "./ward-help-task-list";
import { useTourFacts } from "./ward-tour-facts";
import { HelpDesk, HelpKeys, HelpNews } from "./ward-help-views";
import { markWhatsNewSeen, unseenWhatsNew, WHATS_NEW, WHATS_NEW_STORAGE_KEY } from "./ward-whats-new";

/**
 * Help's four tabs are How do I…, Common questions, Reference and What's new; Your desk and Shortcuts
 * open from the foot as views of their own, with Back to Help (redesign, Josh 1 Nov 2026). Older ways
 * in still arrive: "screen" opens How do I… and "glossary" opens Reference.
 */
type TabView = "tasks" | "questions" | "reference" | "new";
const TAB_VIEWS: readonly HelpView[] = ["tasks", "questions", "reference", "new"];

function tabFor(view: HelpView): TabView {
  if (view === "glossary") return "reference";
  return (TAB_VIEWS as readonly string[]).includes(view) ? (view as TabView) : "tasks";
}

/** The real list (`whats-new.json`), oldest first. */
const NEWS = WHATS_NEW;

function deskLabel(role: WardTourRole): string {
  return role === "admin" ? "Access admin" : CHROME_ROLE_LABELS[role];
}

/** This device's unseen changes, as the corner card counts them (at most four). */
function readUnread(): number {
  let seen: string | null = null;
  try {
    seen = window.localStorage.getItem(WHATS_NEW_STORAGE_KEY);
  } catch {
    // Without storage nothing can be marked seen, so no dots are drawn (as the corner card).
    return 0;
  }
  return unseenWhatsNew(seen, NEWS).length;
}

type WardHelpSheetProps = {
  view: HelpView;
  onView: (view: HelpView) => void;
  onClose: () => void;
  /** Start or resume the tour, from the tour row. */
  onTour: () => void;
  /** Show me on a task: Help gives way to the walkthrough, which opens the task's screen first. */
  onShowMe: (id: string) => void;
  /** A task to open on arrival in How do I… (Show me's Back to Help). */
  task?: string;
  /** A question the header search handed over, put in the search box on arrival. */
  ask?: string;
  /** Show me plays (the help-ask flag); without it a task offers its answer and Go to only. */
  showMeOn?: boolean;
};

const BASE_GLOSSARY = glossaryForSites([]);

export function WardHelpSheet(props: WardHelpSheetProps) {
  return useExecutiveStatisticsControl().executive ? (
    <ExecutiveHelpSheet {...props} />
  ) : (
    <OperationalHelpSheet {...props} />
  );
}

function ExecutiveHelpSheet(props: WardHelpSheetProps) {
  const report = useExecutiveStatistics();
  const { terms, codes } = useMemo(() => {
    const sites = report?.catalogue.sites ?? [];
    return {
      terms: [...BASE_GLOSSARY, ...sites.map((site) => ({ term: site.code, meaning: site.name }))].toSorted((a, b) =>
        a.term.localeCompare(b.term, "en-AU"),
      ),
      codes: new Set(sites.map((site) => site.code)),
    };
  }, [report]);
  return <WardHelpSheetView {...props} terms={terms} siteCodes={codes} />;
}

function OperationalHelpSheet(props: WardHelpSheetProps) {
  const { sites } = useWardNetwork();
  const codes = useMemo(() => new Set(sites.map((site) => site.code)), [sites]);
  return <WardHelpSheetView {...props} terms={glossaryForSites(sites)} siteCodes={codes} />;
}

/**
 * HELP (redesign round 2, approved by Josh 1 Nov 2026). One panel with:
 * - a header that says who you are and where you are;
 * - one smart search: typos mended, the kind of answer guessed from the question, the best answer
 *   open in full with Show me, and the rest grouped; questions to try before anything is typed;
 * - four tabs: How do I… (this screen, the tour, the desk's jobs), Questions (common questions by
 *   screen), Reference (glossary, codes, colours, desks, display and keys) and What's new;
 * - a foot with Your desk and Shortcuts, each a view inside Help.
 * Typed words stay in this component's state and are never saved, put in a URL or logged.
 */
function WardHelpSheetView({
  view,
  onView,
  onClose,
  onTour,
  onShowMe,
  task: openTask,
  ask,
  showMeOn = false,
  terms,
  siteCodes,
}: WardHelpSheetProps & { terms: readonly GlossaryTerm[]; siteCodes: ReadonlySet<string> }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const role = useTourRole();
  const { home, deskHome } = useTourFacts(role);
  const deskHref = deskHome ?? home;
  const phone = useIsPhone();
  const entries = useMemo(() => railEntries(), []);
  // Home's address prefixes every page, so it matches only itself: Settings must not show Home's help.
  const screen = useMemo(() => {
    const shown = screenHelpFor(
      pathname,
      entries.filter((entry) => entry.href !== WARD_HOME_HREF || pathname === WARD_HOME_HREF),
      role === "admin" ? undefined : role,
    );
    return role === "admin" && shown?.id === "settings" ? ADMIN_SETTINGS_HELP : shown;
  }, [entries, pathname, role]);
  const screenName = (href: string) => {
    const path = href.split("#")[0];
    if (path === deskHref) return "your home screen";
    return entries.find((entry) => entry.href === path)?.label ?? "that screen";
  };

  const [query, setQuery] = useState(ask ?? "");
  const [literal, setLiteral] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const [task, setTask] = useState(openTask);
  const [unread, setUnread] = useState(readUnread);
  const field = useRef<HTMLInputElement>(null);
  const found = useMemo(
    () => (query.trim() ? findInHelp(query, role, terms, !literal) : undefined),
    [query, role, terms, literal],
  );
  const rows = foundRows(found);
  const canShow = (id: string) => {
    const each = HOW_TOS.find((howTo) => howTo.id === id);
    return Boolean(each && canShowTask(each, role, deskHref, phone, showMeOn));
  };

  // Questions to try: this desk's first two jobs, a word people mix up, and this screen's own question.
  const examples = useMemo(() => {
    const jobs = tasksForDesk(role)
      .slice(0, 2)
      .map((each) => `How do I ${each.title.charAt(0).toLowerCase()}${each.title.slice(1)}?`);
    return [...jobs, "What does Held up mean?", screen?.questions?.[0]?.question ?? "Is my change saved?"];
  }, [role, screen]);

  const tab = tabFor(view);
  const QuestionsIcon = QUESTIONS_ICON;
  const tabs = [
    {
      id: "tasks" as const,
      label: (
        <>
          <BookOpen aria-hidden="true" strokeWidth={1.75} />
          How do I…
        </>
      ),
    },
    {
      id: "questions" as const,
      label: (
        <>
          <QuestionsIcon aria-hidden="true" strokeWidth={1.75} />
          {phone ? "Questions" : "Common questions"}
        </>
      ),
    },
    {
      id: "reference" as const,
      label: (
        <>
          <Library aria-hidden="true" strokeWidth={1.75} />
          Reference
        </>
      ),
    },
    {
      id: "new" as const,
      label: (
        <>
          <Sparkles aria-hidden="true" strokeWidth={1.75} />
          What&rsquo;s new
        </>
      ),
      count: unread || undefined,
    },
  ];

  const typed = (words: string) => {
    setQuery(words);
    setActive(0);
    field.current?.focus();
  };

  const choose = (result: HelpSearchResult) => {
    // Accepting a result ends suggestion mode so the chosen answer shows straight away.
    setFocused(false);
    const mine = !result.desks || result.desks.includes(role);
    if (result.key.startsWith("howto:") && mine) {
      setQuery("");
      setTask(result.key.slice("howto:".length));
      onView("tasks");
      return;
    }
    if (result.group === "Shortcuts") {
      setQuery("");
      onView("keys");
      return;
    }
    if (result.group === "Glossary") {
      setQuery("");
      onView("reference");
      return;
    }
    if (/:q\d+$/u.test(result.key)) {
      setQuery("");
      onView("questions");
      return;
    }
    const href = mine ? howToHref(result.go, role, deskHref) : undefined;
    if (href) {
      onClose();
      const [path, tab] = href.split("#");
      // A tab on this screen goes by native fragment navigation, which Settings listens for.
      if (tab && path === pathname) {
        if (window.location.hash !== `#${tab}`) window.location.hash = tab;
      } else router.push(href);
    }
  };

  const onFieldKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && query) {
      event.preventDefault();
      event.stopPropagation();
      setQuery("");
    } else if (event.key === "ArrowDown" && rows.length) {
      event.preventDefault();
      setActive((active + 1) % rows.length);
    } else if (event.key === "ArrowUp" && rows.length) {
      event.preventDefault();
      setActive((active - 1 + rows.length) % rows.length);
    } else if (event.key === "Enter" && rows[active]) {
      event.preventDefault();
      choose(rows[active]);
    }
  };

  const searching = query.trim().length > 0;
  const suggesting = !searching && focused;
  const inView = view === "desk" || view === "keys";

  return (
    <Sheet
      id="ward-help-sheet"
      testId="ward-help-sheet"
      open
      onClose={onClose}
      title="Help"
      headerLeading={
        <span className={`${barStyles.drawerTile} ${s.headTile}`} aria-hidden="true">
          <CircleHelp aria-hidden="true" className={barStyles.drawerHeadingIcon} strokeWidth={1.75} />
        </span>
      }
      descriptionContent={
        <p className={s.context}>
          <span className={s.deskTag}>
            <UserRound aria-hidden="true" strokeWidth={2} />
            {deskLabel(role)}
          </span>
          {screen ? (
            <span>
              You are on <b>{screen.title}</b>
            </span>
          ) : null}
        </p>
      }
      placement="right"
      desktopBackdropClassName={barStyles.drawerBackdrop}
      contentClassName={`${barStyles.drawerSheet} ${barStyles.drawerSheetWide} ${s.sheet}`}
      headerClassName={barStyles.drawerHeader}
      titleClassName={barStyles.drawerTitle}
      closeButtonClassName={barStyles.drawerClose}
      bodyClassName={barStyles.drawerBody}
      footer={
        <div className={s.foot}>
          <button
            type="button"
            className={s.footButton}
            aria-current={view === "desk" ? "true" : undefined}
            onClick={() => onView(view === "desk" ? "tasks" : "desk")}
            data-testid="ward-help-desk-open"
          >
            <UserRound aria-hidden="true" strokeWidth={1.75} />
            Your desk
          </button>
          {phone ? null : (
            <button
              type="button"
              className={s.footButton}
              aria-current={view === "keys" ? "true" : undefined}
              onClick={() => onView(view === "keys" ? "tasks" : "keys")}
              data-testid="ward-help-shortcuts"
            >
              <Keyboard aria-hidden="true" strokeWidth={1.75} />
              Shortcuts
              <kbd aria-hidden="true">?</kbd>
            </button>
          )}
          <span className={s.footNote} data-testid="ward-help-synthetic">
            Synthetic prototype
          </span>
        </div>
      }
      footerClassName={barStyles.drawerFooter}
    >
      <div className={s.dock}>
        <div className={s.field}>
          <Search aria-hidden="true" strokeWidth={1.75} />
          <input
            ref={field}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLiteral(false);
              setActive(0);
            }}
            onKeyDown={onFieldKey}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            placeholder="Ask a question or search Help"
            aria-label="Search Help"
            aria-controls="ward-help-found"
            aria-activedescendant={searching && rows.length ? `ward-help-found-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            data-testid="ward-help-search"
          />
          <span className={s.fieldEnd}>
            {query ? (
              <button
                type="button"
                className={s.clear}
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  field.current?.focus();
                }}
              >
                <X aria-hidden="true" strokeWidth={2} />
              </button>
            ) : phone ? null : (
              <kbd className={s.slash} aria-hidden="true">
                /
              </kbd>
            )}
          </span>
        </div>
        {searching || suggesting || inView ? null : (
          <Tabs
            items={tabs}
            value={tab}
            onChange={onView}
            label="Help sections"
            idPrefix="ward-help"
            className={s.tabs}
          />
        )}
      </div>

      {searching ? (
        <div id="ward-help-found" className={s.panel} aria-live="polite">
          <HelpFindResults
            found={found}
            query={query}
            role={role}
            active={active}
            onChoose={choose}
            onShowMe={onShowMe}
            canShow={canShow}
            onUseTyped={(words) => {
              setLiteral(true);
              typed(words);
            }}
          />
        </div>
      ) : suggesting ? (
        <div className={s.panel}>
          <HelpTryAsking examples={examples} onPick={typed} />
        </div>
      ) : inView ? (
        <div className={s.panel}>
          {view === "keys" ? (
            <HelpKeys role={role} onBack={() => onView("tasks")} />
          ) : (
            <HelpDesk
              role={role}
              deskName={deskLabel(role)}
              home={deskHref}
              onBack={() => onView("tasks")}
              onClose={onClose}
              screenName={screenName}
            />
          )}
        </div>
      ) : (
        <TabPanel idPrefix="ward-help" id={tab} className={s.panel}>
          {tab === "tasks" ? (
            <HelpTasks
              key={task}
              role={role}
              home={deskHref}
              pathname={pathname}
              screen={screen}
              onClose={onClose}
              onShowMe={onShowMe}
              onTour={onTour}
              onSearch={() => field.current?.focus()}
              openTask={task}
              screenName={screenName}
              showMeOn={showMeOn}
            />
          ) : null}
          {tab === "questions" ? <HelpQuestions screen={screen} /> : null}
          {tab === "reference" ? (
            <HelpReference
              terms={terms}
              siteCodes={siteCodes}
              role={role}
              deskName={deskLabel(role)}
              onKeys={() => onView("keys")}
            />
          ) : null}
          {tab === "new" ? (
            <HelpNews
              entries={NEWS}
              unread={unread}
              onSeen={() => {
                markWhatsNewSeen();
                setUnread(0);
              }}
            />
          ) : null}
        </TabPanel>
      )}
    </Sheet>
  );
}

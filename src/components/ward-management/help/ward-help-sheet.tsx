"use client";

import { useEffectiveWardAccess } from "../shell/ward-access-store";

import { BookOpen, CircleHelp, Keyboard, Library, Search, Sparkles, UserRound, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { navigateWithDirtyGuard } from "@/components/ward-management/use-dirty-state-guard";

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
import { howToFor } from "./ward-help-access";
import { HOW_TO_IDS, HOW_TOS } from "./ward-help-howto";
import { aroundId } from "./ward-help-screen-tours";
import { helpSuggestionId, GhostCompletion, HelpSuggestList } from "./ward-help-suggest-list";
import { typeAheadHelp, type HelpSuggestion } from "./ward-help-suggest";
import { useHelpUsed } from "./ward-help-usage";
import { howToHref } from "./ward-help-href";
import { canShowTask, HelpTasks } from "./ward-help-jobs";
import s from "./ward-help-panel.module.css";
import { HelpQuestions, HelpReference, QUESTIONS_ICON } from "./ward-help-reference-tabs";
import type { HelpSearchResult } from "./ward-help-search-index";
import { useTourRole, type WardTourRole } from "./ward-help-store";
import { tasksForDesk } from "./ward-help-task-list";
import { useTourFacts } from "./ward-tour-facts";
import { HelpDesk, HelpKeys, HelpNews } from "./ward-help-views";
import { WardHelpChecklistView } from "./ward-help-checklist-view";
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

/**
 * What this device can point with (2 Nov 2026). A phone-sized screen with a keyboard or trackpad
 * (a tablet with a keyboard case) still gets Shortcuts, and a touch-only screen of any size is not
 * shown keyboard hints it cannot use.
 */
function pointerQuery(query: string): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}
function subscribePointer(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const lists = ["(any-pointer: fine)", "(any-pointer: coarse)"].map((query) => window.matchMedia(query));
  for (const list of lists) list.addEventListener?.("change", onChange);
  return () => {
    for (const list of lists) list.removeEventListener?.("change", onChange);
  };
}
function usePointer(): { fine: boolean; touchOnly: boolean } {
  const fine = useSyncExternalStore(
    subscribePointer,
    () => pointerQuery("(any-pointer: fine)"),
    () => false,
  );
  const coarse = useSyncExternalStore(
    subscribePointer,
    () => pointerQuery("(any-pointer: coarse)"),
    () => false,
  );
  return { fine, touchOnly: coarse && !fine };
}

/** The real list (the `whats-new/` entry files), oldest first. */
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
/** Row ids of the suggestions list are `${SUGGEST_ID}-${index}`; the list is `${SUGGEST_ID}-list`. */
const SUGGEST_ID = "ward-help-suggest";

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
  const access = useEffectiveWardAccess();
  const { home, deskHome } = useTourFacts(role);
  const deskHref = deskHome ?? home;
  const phone = useIsPhone();
  const pointer = usePointer();
  const keysOn = !phone || pointer.fine;
  const used = useHelpUsed(HOW_TO_IDS);
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
  const [previousOpenTask, setPreviousOpenTask] = useState(openTask);
  if (previousOpenTask !== openTask) {
    setPreviousOpenTask(openTask);
    if (openTask !== undefined) setTask(openTask);
  }
  const [previousAsk, setPreviousAsk] = useState(ask);
  if (previousAsk !== ask) {
    setPreviousAsk(ask);
    if (ask !== undefined) setQuery(ask);
  }
  const [checklist, setChecklist] = useState<string>();
  const [unread, setUnread] = useState(readUnread);
  const field = useRef<HTMLInputElement>(null);
  // Try asking sits outside the field, so Tab from the field moves into it instead of losing focus.
  const tryAsking = useRef<HTMLDivElement>(null);
  const focusStays = (next: EventTarget | null) =>
    next instanceof Node && (next === field.current || Boolean(tryAsking.current?.contains(next)));
  const found = useMemo(
    () => (query.trim() ? findInHelp(query, role, terms, !literal) : undefined),
    [query, role, terms, literal],
  );
  const rows = foundRows(found);
  // Suggestions as you type (2 Nov 2026): worked out in render from the words and this device's
  // usage counts by how-to id; never stored. A clinical question gets none (only Help's fixed reply).
  const usedMap = useMemo(() => new Map(used.map(({ id, count }) => [id, count])), [used]);
  const suggested = useMemo(() => typeAheadHelp(query, role, terms, usedMap), [query, role, terms, usedMap]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  // Esc or a pick hides the list until the words change again.
  const [dismissed, setDismissed] = useState(false);
  // Whether the arrow keys have gone on past the suggestions into the answers underneath.
  const [inRows, setInRows] = useState(false);
  const showList =
    query.trim().length > 0 && focused && !dismissed && found?.kind !== "clinical" && suggested.suggestions.length > 0;
  const suggestions = showList ? suggested.suggestions : [];
  const nothingFound = found?.kind === "results" && !found.best && found.groups.length === 0;
  const completion = showList ? suggested.completion : undefined;
  const canShow = (id: string) => {
    const each = HOW_TOS.find((howTo) => howTo.id === id);
    return Boolean(each && canShowTask(each, role, deskHref, phone, showMeOn, pathname, access));
  };

  // Questions to try (2 Nov 2026): the desk's jobs most used on this device (else its first two),
  // this screen's walk round and its own questions, then a word people mix up. At most five.
  const examples = useMemo(() => {
    const desk = tasksForDesk(role, access);
    const mostUsed = used.flatMap((entry) => desk.filter((task) => task.id === entry.id));
    const jobs = [...mostUsed, ...desk]
      .filter((task, index, all) => all.indexOf(task) === index)
      .slice(0, 2)
      .map((each) => `How do I ${each.title.charAt(0).toLowerCase()}${each.title.slice(1)}?`);
    const around = screen ? HOW_TOS.find((each) => each.id === aroundId(screen.id))?.title : undefined;
    const asked = (screen?.questions ?? []).slice(0, 2).map((each) => each.question);
    return [
      ...new Set([...jobs, ...(around ? [around] : []), ...asked, "What does Held up mean?", "Is my change saved?"]),
    ].slice(0, 5);
  }, [access, role, screen, used]);

  const tab = tabFor(view);
  const QuestionsIcon = QUESTIONS_ICON;
  const tabs = [
    {
      id: "tasks" as const,
      label: (
        <>
          <BookOpen aria-hidden="true" strokeWidth={1.75} />
          How to
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
    setActiveSuggestion(-1);
    setInRows(false);
    setDismissed(false);
    field.current?.focus();
  };

  /** New words in the field: the list shows again from the top, with nothing chosen yet. */
  const fieldWords = (words: string) => {
    setQuery(words);
    setLiteral(false);
    setActive(0);
    setActiveSuggestion(-1);
    setInRows(false);
    setDismissed(false);
  };

  const choose = (result: HelpSearchResult) => {
    // Accepting a result ends suggestion mode so the chosen answer shows straight away.
    setFocused(false);
    const howTo = result.key.startsWith("howto:")
      ? HOW_TOS.find((each) => each.id === result.key.slice("howto:".length))
      : undefined;
    const mine = howTo ? howToFor(howTo, role, access) : !result.desks || result.desks.includes(role);
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
      navigateWithDirtyGuard(() => {
        onClose();
        const [path, tab] = href.split("#");
        // A tab on this screen goes by native fragment navigation, which Settings listens for.
        if (tab && path === pathname) {
          if (window.location.hash !== `#${tab}`) window.location.hash = tab;
        } else router.push(href);
      });
    }
  };

  /**
   * A suggestion picked: a job opens in How to, a walk round starts Show me where it can play, and a
   * word, question, screen or shortcut becomes the search so the full answer shows underneath.
   */
  const pick = (suggestion: HelpSuggestion) => {
    setActiveSuggestion(-1);
    setDismissed(true);
    const id = suggestion.howToId;
    const howTo = id ? HOW_TOS.find((each) => each.id === id) : undefined;
    if (id && howTo && suggestion.kind === "walk" && canShow(id)) {
      setFocused(false);
      setQuery("");
      onShowMe(id);
      return;
    }
    // A walk round that cannot play here falls through to its answer in search (How to never
    // lists walk rounds, so it could not show it there).
    if (id && howTo && suggestion.kind !== "walk" && howToFor(howTo, role, access)) {
      setFocused(false);
      setQuery("");
      setTask(id);
      onView("tasks");
      return;
    }
    // Another desk's job, and every other kind: its answer, read in full by the search below.
    setQuery(suggestion.text);
    setLiteral(false);
    setActive(0);
    field.current?.focus();
  };

  /** The caret sits after the last letter, with nothing selected. */
  const caretAtEnd = (input: HTMLInputElement) =>
    input.selectionStart === input.value.length && input.selectionEnd === input.value.length;

  const onFieldKey = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = suggestions.length;
    if (completion && (event.key === "Tab" || (event.key === "ArrowRight" && caretAtEnd(event.currentTarget)))) {
      // Only a completion to take keeps Tab here; with none, Tab moves focus on as usual.
      if (event.key === "Tab" && (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      setQuery(completion);
      setActive(0);
      setActiveSuggestion(-1);
      setInRows(false);
      return;
    }
    if (event.key === "Escape" && showList) {
      // First Esc hides the suggestions; the next clears the words (below).
      event.preventDefault();
      event.stopPropagation();
      setDismissed(true);
      setActiveSuggestion(-1);
    } else if (event.key === "Escape" && query) {
      event.preventDefault();
      event.stopPropagation();
      setQuery("");
      setActiveSuggestion(-1);
      setDismissed(false);
    } else if (event.key === "ArrowDown" && count && activeSuggestion < count - 1 && !inRows) {
      // Down moves through the suggestions first, then on into the answers underneath.
      event.preventDefault();
      setActiveSuggestion(activeSuggestion + 1);
    } else if (event.key === "ArrowDown" && count && !inRows) {
      event.preventDefault();
      setActiveSuggestion(rows.length ? -1 : 0);
      setInRows(rows.length > 0);
      setActive(0);
    } else if (event.key === "ArrowUp" && count && activeSuggestion >= 0) {
      event.preventDefault();
      setActiveSuggestion(activeSuggestion - 1);
    } else if (event.key === "ArrowUp" && count && inRows && active === 0) {
      event.preventDefault();
      setInRows(false);
      setActiveSuggestion(count - 1);
    } else if (event.key === "Enter" && suggestions[activeSuggestion]) {
      event.preventDefault();
      pick(suggestions[activeSuggestion]);
    } else if (event.key === "ArrowDown" && rows.length) {
      event.preventDefault();
      setInRows(true);
      setActive((active + 1) % rows.length);
    } else if (event.key === "ArrowUp" && rows.length) {
      event.preventDefault();
      setInRows(true);
      setActive((active - 1 + rows.length) % rows.length);
    } else if (event.key === "Enter" && rows[active]) {
      event.preventDefault();
      choose(rows[active]);
    }
  };

  const searching = query.trim().length > 0;
  const suggesting = !searching && focused;
  const inView = view === "desk" || view === "keys" || (view === "checklist" && Boolean(checklist));

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
            <UserRound aria-hidden="true" strokeWidth={1.75} />
            {deskLabel(role)}
          </span>
          {screen ? (
            <span>
              You are on <b>{screen.title}</b>
            </span>
          ) : null}
        </p>
      }
      // A right panel on a computer; on a phone (through 48rem) a near-full bottom sheet whose header
      // controls stay below the top safe area (Josh, 2 Nov 2026).
      placement="responsive-right"
      mobilePlacement="bottom"
      mobileBreakpoint="phone"
      mobileHeaderSafeArea="padding"
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
          {keysOn ? (
            <button
              type="button"
              className={s.footButton}
              aria-current={view === "keys" ? "true" : undefined}
              onClick={() => onView(view === "keys" ? "tasks" : "keys")}
              data-testid="ward-help-shortcuts"
            >
              <Keyboard aria-hidden="true" strokeWidth={1.75} />
              Shortcuts
              {pointer.touchOnly ? null : <kbd aria-hidden="true">?</kbd>}
            </button>
          ) : null}
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
            onChange={(event) => fieldWords(event.target.value)}
            onKeyDown={onFieldKey}
            onFocus={() => setFocused(true)}
            onBlur={(event) => {
              if (focusStays(event.relatedTarget)) return;
              // A pointer press on a suggestion can blur first, so close only once focus has settled away.
              window.setTimeout(() => {
                if (!focusStays(document.activeElement)) setFocused(false);
              }, 150);
            }}
            placeholder="Ask a question or search Help"
            aria-label="Search Help"
            // A combobox (2 Nov 2026): the suggestions list while it shows, else the answers below.
            role="combobox"
            aria-autocomplete="both"
            aria-expanded={showList}
            aria-controls={showList ? `${SUGGEST_ID}-list` : searching ? "ward-help-found" : undefined}
            aria-activedescendant={
              activeSuggestion >= 0 && suggestions[activeSuggestion]
                ? helpSuggestionId(SUGGEST_ID, activeSuggestion)
                : searching && rows.length
                  ? `ward-help-found-${active}`
                  : undefined
            }
            autoComplete="off"
            spellCheck={false}
            data-testid="ward-help-search"
          />
          <GhostCompletion typed={query} completion={completion} className={s.ghost} />
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
                <X aria-hidden="true" strokeWidth={1.75} />
              </button>
            ) : phone || pointer.touchOnly ? null : (
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

      {/* While suggestions show for an unfinished word, a "No match" line below them would only
          contradict them, so it waits until the words match nothing on their own. */}
      {showList ? (
        <div className={s.suggest} data-testid="ward-help-suggestions">
          <HelpSuggestList
            suggestions={suggestions}
            activeIndex={activeSuggestion}
            onPick={pick}
            idPrefix={SUGGEST_ID}
            label="Suggestions"
          />
        </div>
      ) : null}
      {/* One short polite line, in place of reading the list out at each key press. It stays mounted
          (so it is heard) and has no status role, so Help's one status line stays the answer count
          or the clinical reply. */}
      <span className="sr-only" aria-live="polite" aria-atomic="true" data-testid="ward-help-suggest-summary">
        {showList ? "Suggestions are listed below the search box" : ""}
      </span>
      {searching && showList && nothingFound ? null : searching ? (
        <div id="ward-help-found" className={s.panel}>
          <HelpFindResults
            found={found}
            query={query}
            role={role}
            active={activeSuggestion >= 0 ? -1 : active}
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
        <div
          ref={tryAsking}
          className={s.panel}
          onBlur={(event) => {
            if (!focusStays(event.relatedTarget)) setFocused(false);
          }}
        >
          <HelpTryAsking examples={examples} onPick={typed} />
        </div>
      ) : inView ? (
        <div className={s.panel}>
          {view === "keys" ? (
            <HelpKeys role={role} onBack={() => onView("tasks")} />
          ) : view === "checklist" && checklist ? (
            <WardHelpChecklistView
              id={checklist}
              role={role}
              home={deskHref}
              onBack={() => onView("tasks")}
              onClose={onClose}
              onShowMe={onShowMe}
              screenName={screenName}
              showMeOn={showMeOn}
            />
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
              onOpenChecklist={(id) => {
                setChecklist(id);
                onView("checklist");
              }}
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

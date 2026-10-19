"use client";

import { lockPageScroll } from "@/components/wf/sheet-focus";
import { isGlobalSearchShortcut } from "@/components/ward-management/search/search-shortcut";
import { revealWardOption } from "@/components/ward-management/ward-scroll";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  useDeferredValue,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { handOffPatientSearchText, isNewTabClick } from "@/components/ward-management/search/patient-query-handoff";
import { refusalFor } from "@/components/ward-management/search/search-refusals";
import {
  CORE_SEARCH_VIEWS,
  searchIntentLabel,
  searchWardFlow,
} from "@/components/ward-management/search/ward-smart-search";
import { GlobalSearchPreview } from "@/components/ward-management/search/global-search-preview";
import { buildCensus } from "@/components/ward-management/search/patient-census";
import { answerQuestion } from "@/components/ward-management/search/search-answers";
import { dueSoonThresholdsOf } from "@/components/ward-management/ward-clock";
import { StatusGlyph, useIsPhone } from "@/components/wf";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";

import type { InboxItem } from "@/components/ward-management/ward-derivations";
import { WARD_ADD_PERSON_HREF, WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { setDeskRole } from "@/components/ward-management/ward-role-gate";
import { useOptionalWardFlow } from "@/components/ward-management/ward-flow-provider";
import { DEMO_CONTROLS_OFF } from "@/components/ward-management/ward-flow-raise";
import { dispatchPersonaSyncForRole } from "@/components/ward-management/settings/persona-sync";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { formatDateOfBirth, type Patient } from "@/components/ward-management/ward-patients";
import { ChevronRight, CornerDownLeft, Search, X } from "lucide-react";

import styles from "./ward-global-search.module.css";
import {
  needsYouMeta,
  patientResultTitle,
  smartSearchGroups,
  type SearchResultGroup,
  type SearchResultItem,
} from "./ward-global-search-groups";
import { SearchResultIcon } from "./ward-global-search-icon";

export {
  needsYouMeta,
  patientResultTitle,
  smartSearchGroups,
  type SearchResultGroup,
  type SearchResultItem,
} from "./ward-global-search-groups";
export { SearchResultIcon } from "./ward-global-search-icon";

/**
 * WARD FLOW'S GLOBAL SEARCH — one control, mounted once in the header of every ward route.
 *
 * OWNER RULING: this is the one part of the chrome that does NOT adapt between roles. Same
 * position, same width, same keyboard shortcut everywhere a coordinator, an ED psychiatrist or a
 * ward manager works, so a habit learned in one role works in every other. The only thing that may
 * differ is a small "scope" chip — and that difference belongs to the CALLER, not to this file.
 *
 * ⚠️ THIS COMPONENT CONTAINS NO ROLE LOGIC AT ALL. It takes `scope` as a plain `ReactNode` and
 * renders whatever it is given, unexamined. It does not know what a role is, does not branch on
 * one, and does not read `WardRole` from `ward-derivations.ts`. Whoever wires this into a header
 * decides what the chip says; this file only reserves the slot.
 *
 * PALETTE (Josh, 8 Oct 2026, option B of the global search mockups). The field stays where it is in
 * the header. Focusing it opens a glass palette under the bar, over a soft scrim: kind chips with
 * counts, the grouped list on the left and a preview of the highlighted row on the right, so the
 * name, UMRN, age and stage can be checked before anyone leaves the page. Before anything is typed
 * it offers the caller's own Tasks ("Needs you now"), records opened this session, four common
 * screens and two actions. The keyboard contract below is unchanged.
 *
 * DATA: it calls the same matching functions the existing search console does, rather than
 * inventing a second definition of "matches" — `findPatients` (`ward-patients.ts`) for people and
 * `searchMovements` (`ward-derivations.ts`) for open movements. `searchMovements` applies `isOpen`
 * first and unconditionally, so a movement that has closed or arrived can never appear here, the
 * same rule the patient-search console and every other Ward Flow board already keep.
 *
 * QUEUED REFERRALS ARE A RESULT KIND (search review, 19 October 2026). Until then they were left
 * out because a referral had no page of its own; `referralBoardHref` now opens one referral on the
 * board, so each referral row carries its record to a real destination. Only queued referrals still
 * awaiting an answer are listed, the same rule `searchPatients` keeps.
 *
 * COMMON QUESTIONS ("over 24 hours", "no bed yet", "Form 1A") are answered from the Patients page's
 * census while the palette is open (`search/search-answers.ts`), and the preview takes each
 * person's "where now" and next step from the same census, so the two screens never disagree.
 *
 * NAVIGATION: every real link is a `next/link` `<Link>`, so a plain click, a middle click and a
 * ctrl/cmd-click all behave exactly as a browser link should — nothing here intercepts those.
 * `onNavigate` exists only so a test can observe which record a click or an Enter-key selection
 * was headed for without needing a router in the tree; when it is supplied, a plain unmodified left
 * click and a keyboard selection call it instead of letting the anchor navigate for real. When it
 * is absent (real usage), a plain click on a result falls through to the anchor's own navigation
 * untouched, and a keyboard Enter selection uses `next/navigation`'s router — the one path that has
 * no anchor of its own to fall back on, because the option the keyboard has moved to is named by
 * `aria-activedescendant`, not by the browser's own focus.
 *
 * KEYBOARD: the input keeps focus throughout, per the ARIA textbox-with-listbox-popup pattern this
 * codebase already uses for `PatientTypeahead` — ArrowDown/ArrowUp move the active row,
 * Home/End jump to the ends, Enter selects the active row (and does nothing when none is active,
 * so a stray Enter does not navigate anywhere a coordinator has not actually pointed at), and
 * Escape clears the query outright rather than merely closing the popup — this control is reached
 * the same way from every screen, so a coordinator moving on to a new search should not have to
 * clear a leftover value by hand first.
 *
 * ⚠️ NO `role="combobox"` ON THE INPUT, and this is deliberate rather than an oversight. Putting
 * that role on the input replaces its implicit `textbox` role, and `aria-expanded` is not a valid
 * state on a plain textbox — so the ARIA 1.2 combobox role and the textbox role cannot both be
 * correct on the same element without contradicting each other. `aria-haspopup`, `aria-controls`,
 * `aria-activedescendant` and `aria-autocomplete` are all valid on a textbox, so the input stays a
 * real, unambiguous textbox with those states layered on rather than a mislabelled combobox.
 *
 * THE SAME SHORTCUT EVERYWHERE: "/" or Ctrl/Cmd+K focuses this control from anywhere on the page,
 * unless the keypress is already headed for another field — matching the shortcut this app's own
 * `universal-search-command-surface.tsx` already uses for its global search, so a habit learned on
 * one Ward Flow screen is the same habit the rest of the app already teaches.
 */
export type WardGlobalSearchProps = {
  movements: Movement[];
  patients: readonly Patient[];
  /** D-39: a journey linked through a referral needs the referral to find its UMRN. */
  referrals?: Parameters<typeof searchWardFlow>[0]["referrals"];
  units: Unit[];
  /**
   * The one thing that may differ by role — rendered exactly as given, with no interpretation.
   * Absent means no chip at all, which is a legitimate rendering, not a missing one.
   */
  scope?: ReactNode;
  /**
   * Drives navigation without a router, so a test can assert exactly which record a selection was
   * headed for. Real usage should normally omit this and let `next/link` and the app router handle
   * it — see the file header for exactly which paths this does and does not intercept.
   */
  onNavigate?: (href: string) => void;
  /**
   * The caller's own Tasks list, already gated to the role (the header passes the same list its
   * Tasks drawer shows). The first few lead the palette before anything is typed. Absent or empty
   * means no "Needs you now" group, never an ungated network list.
   */
  tasks?: readonly InboxItem[];
  /** Lifts the palette above open sheets, for a header that stays live over a sheet below it. */
  aboveSheets?: boolean;
  /** Opens the full Tasks list (the header's drawer). Absent means no "See all tasks" control. */
  onSeeAllTasks?: () => void;
  /** Booked planned admissions, so search finds the same overdue rows the task count holds. */
  plannedAdmissions?: Parameters<typeof searchWardFlow>[0]["plannedAdmissions"];
  /** The Ward Flow clock, for waits in the preview. Absent means waits are simply not shown. */
  now?: number;
  label?: string;
  placeholder?: string;
  /** Text typed into the phone's placeholder field before this loaded (`ward-global-search-lazy.tsx`). */
  initialQuery?: string;
  /** The phone's placeholder field: on mount this takes over its focus and caret, if it had them. */
  takeFocusFrom?: RefObject<HTMLInputElement | null>;
};

/**
 * A SHORT LIST, NOT A CATALOGUE. This is chrome that sits above every screen's own content, not a
 * replacement for the dedicated search console — a coordinator wanting the full result set already
 * has `/ward-flow/search` for that. Applied per kind so a query that matches many movements
 * cannot crowd every person result off the bottom of a short popup.
 */
const MAX_RESULTS_PER_GROUP = 6;

/** The full search console, linked from the palette footer. No query travels in the URL. */
const PATIENT_SEARCH_HREF = "/ward-flow/search";

/**
 * THE KIND CHIPS ALONG THE TOP OF THE PALETTE. "All" keeps the short list per kind; a single kind
 * shows that kind's matches up to `FULL_RESULTS_PER_GROUP`, so a chip is also how someone sees
 * more than six of one thing without leaving the page. Places folds wards, EDs and teams together,
 * the same three groups the engine leads with for a place query.
 */
type KindFilter = "all" | "answers" | "people" | "movements" | "referrals" | "places" | "forms" | "views" | "tasks";

const KIND_FILTERS: readonly { key: KindFilter; label: string; groups: readonly string[] }[] = [
  { key: "all", label: "All", groups: [] },
  // A common question ("over 24 hours") answered from the Patients page's census (search-answers.ts).
  { key: "answers", label: "Answers", groups: ["answers"] },
  { key: "people", label: "People", groups: ["people", "similar"] },
  { key: "movements", label: "Movements", groups: ["movements"] },
  { key: "referrals", label: "Referrals", groups: ["referrals"] },
  { key: "places", label: "Places", groups: ["beds", "wards", "eds", "teams"] },
  { key: "forms", label: "Forms", groups: ["forms"] },
  { key: "views", label: "Views", groups: ["views"] },
  { key: "tasks", label: "Tasks", groups: ["tasks"] },
];

const FULL_RESULTS_PER_GROUP = 40;

/** The screens offered before anything is typed: the four a coordinator jumps to most. */
const START_VIEW_KEYS = ["capacity", "delays", "referrals", "handover"] as const;

const START_ACTIONS: readonly SearchResultItem[] = [
  {
    kind: "action",
    kindLabel: "Action",
    id: "new-referral",
    title: "New referral",
    meta: "",
    href: WARD_REFERRAL_INTAKE_HREF,
  },
  {
    kind: "action",
    kindLabel: "Action",
    id: "add-patient",
    title: "Add patient",
    meta: "",
    href: WARD_ADD_PERSON_HREF,
  },
];

const NEEDS_YOU_LIMIT = 3;
const RECENT_LIMIT = 4;

/*
 * ⚠️ RECENT RECORDS LIVE IN THIS MODULE'S MEMORY ONLY, NEVER IN BROWSER STORAGE. They last as long
 * as the page does (client navigation keeps them, a reload clears them) and they hold the row as it
 * was shown: ids, names and hrefs, none of which is typed text. Ward Flow's rule is that nothing a
 * person types reaches storage, and keeping these off storage keeps that rule without a review.
 */
let sessionRecents: readonly SearchResultItem[] = [];
const NO_RECENTS: readonly SearchResultItem[] = [];
const recentsListeners = new Set<() => void>();

/** A small store, so the React Compiler sees the list change as an input rather than a module read. */
function setSessionRecents(next: readonly SearchResultItem[]) {
  sessionRecents = next;
  recentsListeners.forEach((listener) => listener());
}

function subscribeRecents(listener: () => void) {
  recentsListeners.add(listener);
  return () => {
    recentsListeners.delete(listener);
  };
}

const recentsSnapshot = () => sessionRecents;
const serverRecentsSnapshot = () => NO_RECENTS;

function useSessionRecents() {
  return useSyncExternalStore(subscribeRecents, recentsSnapshot, serverRecentsSnapshot);
}

function rememberRecent(item: SearchResultItem) {
  if (item.kind === "action") return;
  setSessionRecents([item, ...sessionRecents.filter((recent) => recent.href !== item.href)].slice(0, RECENT_LIMIT));
}

/** Test seam: recents are module memory, so a suite that asserts the start screen clears them first. */
export function clearGlobalSearchRecents() {
  setSessionRecents(NO_RECENTS);
}

/** The header's bottom edge, so the scrim and palette start under the bar rather than covering it. */
/** The width where the open search is a full screen sheet (`.popup` in the module's phone block). */
const PHONE_SEARCH_QUERY = "(max-width: 48rem)";

/** The phone sheet's top: the open field's bottom edge (the bar's top or the status bar, plus the bar). */
const PHONE_SHEET_TOP = "calc(max(var(--wgs-bar-top, 0px), env(safe-area-inset-top, 0px)) + var(--wgs-bar-h, 3.5rem))";

/*
 * Whether the phone sheet is showing, read from the same query as the stylesheet. The phone sheet
 * has no preview pane, so the preview (which derives a patient's stage, waits and links) is not
 * built there at all rather than built and hidden on every keystroke.
 */
function useIsPhoneSearch() {
  return useIsPhone();
}

function headerBottom(root: HTMLElement | null): number {
  if (!root) return 0;
  const bar = root.closest("header") ?? root;
  return Math.max(0, Math.round(bar.getBoundingClientRect().bottom));
}

/**
 * The header's own top edge and height. The compact bar lays the open field over the bar itself,
 * so it needs the bar's height, not its bottom edge: anything above the bar (a banner, a scrolled
 * offset) once made the field as tall as the bar's bottom edge, a giant pill (Josh, 11 Oct 2026).
 */
function headerBox(root: HTMLElement | null): { top: number; height: number } {
  if (!root) return { top: 0, height: 0 };
  const bar = root.closest("header") ?? root;
  const rect = bar.getBoundingClientRect();
  return { top: Math.max(0, Math.round(rect.top)), height: Math.max(0, Math.round(rect.height)) };
}

export function WardGlobalSearch({
  movements,
  patients,
  referrals,
  units,
  tasks,
  aboveSheets = false,
  onSeeAllTasks,
  plannedAdmissions,
  now,
  scope,
  onNavigate,
  label = "Search",
  placeholder = "Search people and movements…",
  initialQuery = "",
  takeFocusFrom,
}: WardGlobalSearchProps) {
  const id = useId();
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const demoOffId = `${id}-demo-off`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const nameFor = usePatientNameDisplay();
  const wardFlow = useOptionalWardFlow();
  const demoOff = wardFlow?.demoControlsAvailable === false;
  const preparing = wardFlow?.sessionAdopted === false;

  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hoverIndex, setHoverIndex] = useState(-1);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [top, setTop] = useState(0);
  const [barBox, setBarBox] = useState<{ top: number; height: number }>({ top: 0, height: 0 });
  const recents = useSessionRecents();
  const [showShortcuts, setShowShortcuts] = useState(false);

  const trimmed = deferredQuery.trim();
  const lookup = useMemo(() => ({ patients, referrals, movements }), [patients, referrals, movements]);
  const isStart = trimmed.length === 0;
  const showQuickCommands = isStart || /^(switch|clock|reset|handover|shortcuts|\?)/i.test(trimmed);
  const shortcutsExpanded = showShortcuts || trimmed === "?" || /^shortcuts/i.test(trimmed);

  const smartResults = useMemo(
    () =>
      trimmed.length === 0
        ? null
        : searchWardFlow({
            query: trimmed,
            patients,
            movements,
            units,
            referrals,
            now,
            limitPerGroup: FULL_RESULTS_PER_GROUP,
            plannedAdmissions,
          }),
    [trimmed, patients, movements, units, referrals, now, plannedAdmissions],
  );

  const refusal = trimmed.length === 0 ? undefined : refusalFor(trimmed);

  /*
   * The Patients page's census, built only while the palette is open: it answers the common
   * questions ("over 24 hours") and gives the preview each person's "where now" and next step, so
   * the header and the Patients page cannot disagree. Outside a provider (tests) there is none, and
   * search simply has no answers and no "where now" line.
   */
  const admissions = wardFlow?.admissions;
  const configuration = wardFlow?.configuration;
  const censusDayZero = wardFlow?.dayZero;
  const census = useMemo(
    () =>
      !open || !admissions || !censusDayZero || now === undefined
        ? null
        : buildCensus({
            movements,
            referrals: [...(referrals ?? [])],
            units,
            patients: [...patients],
            admissions,
            plannedAdmissions,
            now,
            thresholds: dueSoonThresholdsOf(configuration),
            dayZero: censusDayZero,
          }),
    [open, admissions, censusDayZero, now, movements, referrals, units, patients, plannedAdmissions, configuration],
  );
  const answer = useMemo(
    () => (trimmed.length === 0 || refusal ? undefined : answerQuestion(trimmed, census, FULL_RESULTS_PER_GROUP)),
    [trimmed, refusal, census],
  );

  // Groups cut at the full limit: the engine's, plus the answer group when more rows answer it.
  const truncatedGroups = useMemo(() => {
    const engine = smartResults?.truncatedGroups ?? [];
    return answer && answer.total > answer.rows.length ? [...engine, "answers"] : engine;
  }, [smartResults, answer]);

  /** Every matched group in full (up to the full limit), in the engine's intent order. */
  const allGroups = useMemo(
    () => (!smartResults || refusal ? [] : smartSearchGroups(smartResults, trimmed, units, lookup, answer)),
    [smartResults, refusal, trimmed, units, lookup, answer],
  );

  const kindCounts = useMemo(() => {
    const counts = new Map<KindFilter, number>();
    for (const filter of KIND_FILTERS) {
      counts.set(
        filter.key,
        allGroups
          .filter((group) => filter.key === "all" || filter.groups.includes(group.key))
          .reduce((sum, group) => sum + group.items.length, 0),
      );
    }
    return counts;
  }, [allGroups]);

  /** What someone sees before typing: live work, recent records, common screens and actions. */
  const startGroups = useMemo(() => {
    const g: SearchResultGroup[] = [];
    const allNeeds = tasks ?? [];
    const needs = allNeeds.slice(0, NEEDS_YOU_LIMIT);
    if (needs.length > 0) {
      g.push({
        key: "needs",
        // shell-4: a cut list says so, with the full count the Tasks badge shows.
        heading:
          allNeeds.length > needs.length ? `Needs you now · ${needs.length} of ${allNeeds.length}` : "Needs you now",
        items: needs.map((task) => ({
          kind: "task",
          kindLabel: "Task",
          id: task.id,
          title: task.title,
          // D-39: a person is named by UMRN, never by a WF journey number, in every shape of id.
          // shell-4: the patient's name leads, so a phone (no preview pane) still names them.
          meta: needsYouMeta(task, lookup, nameFor),
          href: task.href ?? movementHref(task.movementId),
          movementId: task.movementId,
          tone: task.tone,
        })),
      });
    }
    if (recents.length > 0) {
      g.push({ key: "recent", heading: "Recent", items: [...recents] });
    }
    g.push({
      key: "goto",
      heading: "Go to",
      items: START_VIEW_KEYS.flatMap((key) => {
        const view = CORE_SEARCH_VIEWS.find((candidate) => candidate.key === key);
        return view
          ? [
              {
                kind: "view",
                kindLabel: "View",
                id: view.key,
                title: view.title,
                meta: view.description ?? "",
                href: view.href,
              },
            ]
          : [];
      }),
    });
    g.push({ key: "do", heading: "Do", items: [...START_ACTIONS] });
    return g;
  }, [tasks, recents, lookup, nameFor]);

  // A chosen kind with nothing for the current query falls back to All, so a new query never shows
  // a false "No matches" while the chips beside it count real results.
  const activeKind: KindFilter = (kindCounts.get(kindFilter) ?? 0) > 0 ? kindFilter : "all";

  const groups = useMemo(() => {
    if (isStart) return startGroups;
    const filter = KIND_FILTERS.find((candidate) => candidate.key === activeKind) ?? KIND_FILTERS[0];
    if (filter.key === "all") {
      return allGroups.map((group) => ({ ...group, items: group.items.slice(0, MAX_RESULTS_PER_GROUP) }));
    }
    return allGroups.filter((group) => filter.groups.includes(group.key));
  }, [isStart, startGroups, allGroups, activeKind]);

  const options = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  /** Returned counts; truncated groups explicitly say that more matches exist. */
  const fullGroupCounts = useMemo(
    () => new Map(allGroups.map((group) => [group.key, group.items.length] as const)),
    [allGroups],
  );

  /*
   * The popup stays mounted while React catches up with the typed text. Hiding it for that one
   * render unmounted the list, dropped data-open and released the phone scroll lock on every
   * keystroke, which read as a flash on iPhone. Stale rows stay visible but cannot be picked by
   * keyboard until `resultsCurrent` is true again.
   */
  const showPopup = open;
  const resultsCurrent = deferredQuery === query;

  /*
   * THE ACTIVE ROW RESETS WHENEVER THE OPTION LIST CHANGES IDENTITY — same render-phase adjustment
   * `PatientTypeahead` uses and the same reason: an effect would leave one frame where a changed
   * list is painted with a stale row still marked active, and on a control whose Enter key
   * navigates, that frame is the one where Enter would go to a record nobody is looking at.
   */
  const optionsKey = useMemo(() => options.map((option) => option.href).join("|"), [options]);
  const [seenOptionsKey, setSeenOptionsKey] = useState(optionsKey);
  if (optionsKey !== seenOptionsKey) {
    setSeenOptionsKey(optionsKey);
    setActiveIndex(-1);
    setHoverIndex(-1);
  }

  /** The preview follows the pointer, then the keyboard, then falls back to the first row. */
  const previewIndex = hoverIndex >= 0 ? hoverIndex : activeIndex >= 0 ? activeIndex : 0;
  const isPhone = useIsPhoneSearch();
  const previewItem = refusal || isPhone ? undefined : options[previewIndex];

  /*
   * D1-style fix, same reason `PatientTypeahead` carries it: the list clips with its own scrollbar,
   * and ArrowDown/End can move `activeIndex` to a row that is scrolled out of view.
   * Reveal the option inside the list only; `scrollIntoView` also moved the page behind it.
   */
  useEffect(() => {
    if (!showPopup || !resultsCurrent || activeIndex < 0) return;
    revealWardOption(document.getElementById(`${id}-opt-${activeIndex}`));
  }, [activeIndex, showPopup, resultsCurrent, id]);

  /*
   * THE PALETTE IS PORTALLED TO THE BODY, BECAUSE THE BAR IS GLASS. `backdrop-filter` on the
   * header makes it the containing block for anything fixed inside it, so a fixed palette mounted
   * in place would be clipped to the bar. Its top is measured from the bar's own bottom edge, which
   * also follows the phone bar as it condenses on scroll.
   *
   * A LAYOUT EFFECT, so the first painted frame already has the measured top and bar height: with a
   * plain effect the phone sheet painted one frame at the top of the screen over the field, then
   * jumped (Josh, 12 Oct 2026). Every later measure is one per animation frame, and a scroll inside
   * the palette's own list is ignored, so scrolling results does not re-measure the header.
   *
   * The on-screen keyboard's height (layout viewport minus the visual viewport) is written straight
   * to the palette as `--wgs-kb`, not kept in state, so a keyboard resize never re-renders the rows.
   * The phone sheet pads its bottom by it, so the footer sits just above the keyboard.
   */
  useLayoutEffect(() => {
    if (!showPopup) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      setTop(headerBottom(rootRef.current));
      const box = headerBox(rootRef.current);
      setBarBox((current) => (current.top === box.top && current.height === box.height ? current : box));
      const viewport = window.visualViewport;
      const keyboard =
        viewport && viewport.scale <= 1
          ? Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
          : 0;
      paletteRef.current?.style.setProperty("--wgs-kb", `${keyboard}px`);
    };
    const schedule = (event?: Event) => {
      const target = event?.target;
      if (target instanceof Node && paletteRef.current?.contains(target)) return;
      if (!frame) frame = window.requestAnimationFrame(() => measure());
    };
    measure();
    window.addEventListener("resize", schedule);
    // Capture includes the desktop work column, whose scroll never reaches the window.
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    return () => {
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [showPopup]);

  // Phone (Josh, 11 Oct 2026, iPhone Safari): the search fills the screen, so the page behind it
  // must not scroll. When it could, Safari grew and shrank its toolbar under the open search, which
  // cut off the search's top and left the page showing below its footer.
  useEffect(() => {
    if (!showPopup) return;
    const phone = window.matchMedia(PHONE_SEARCH_QUERY);
    // The shared counted lock also holds the phone work column (`[data-wf-scroller]`), which is
    // what scrolls on phone. Follows the width while open, so turning a tablet keeps it right.
    let release: (() => void) | null = null;
    const apply = () => {
      if (phone.matches && !release) release = lockPageScroll();
      else if (!phone.matches && release) {
        release();
        release = null;
      }
    };
    apply();
    phone.addEventListener("change", apply);
    return () => {
      phone.removeEventListener("change", apply);
      release?.();
    };
  }, [showPopup]);

  function close() {
    setOpen(false);
    setActiveIndex(-1);
    setHoverIndex(-1);
  }

  useEffect(() => {
    if (!open) return;
    function onDocumentPointerDown(event: globalThis.MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || paletteRef.current?.contains(target)) return;
      close();
    }
    document.addEventListener("mousedown", onDocumentPointerDown);
    return () => document.removeEventListener("mousedown", onDocumentPointerDown);
  }, [open]);

  // "/" or Ctrl/Cmd K focuses this from anywhere (`search/search-shortcut.ts`).
  useEffect(() => {
    function onWindowKeyDown(event: globalThis.KeyboardEvent) {
      if (!isGlobalSearchShortcut(event)) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, []);

  // Mount only: the phone's placeholder field had focus, so this one takes it (and opens, as a tap
  // would) with the caret where it was. It runs before the placeholder is removed, so the focus
  // moves straight from one field to the other and a phone keyboard stays open.
  const [handOffFrom] = useState(takeFocusFrom);
  useLayoutEffect(() => {
    const from = handOffFrom?.current;
    const input = inputRef.current;
    if (!from || !input || document.activeElement !== from) return;
    input.focus();
    if (from.selectionStart !== null && from.selectionEnd !== null) {
      input.setSelectionRange(from.selectionStart, from.selectionEnd, from.selectionDirection ?? undefined);
    }
  }, [handOffFrom]);

  function remember(href: string) {
    const item = options.find((option) => option.href === href);
    if (item) {
      rememberRecent(item);
    }
  }

  /**
   * Leaving the page can unmount a form with unsaved fields. Ask the composed leave guard first
   * (it prompts once if ANY mounted guard is dirty) and stay put when the answer is no.
   */
  function confirmLeave(): boolean {
    const confirmNavigation = (window as typeof window & { __wardFlowConfirmNavigation?: () => boolean })
      .__wardFlowConfirmNavigation;
    return !confirmNavigation || confirmNavigation();
  }

  /** `confirmed` is true when the caller has already asked, so the person is never asked twice. */
  function select(href: string, confirmed = false) {
    if (!confirmed && !confirmLeave()) return;
    remember(href);
    close();
    if (onNavigate) onNavigate(href);
    else router.push(href);
  }

  /**
   * Only intercepts when a test has supplied `onNavigate`, and only for the plain click a real
   * anchor would otherwise have handled itself. A modified click (middle button, ctrl/cmd, shift)
   * on a current row is left completely alone in every case, real or tested, because that is the browser's own
   * "open in a new tab/window" gesture and this control has no business overriding it.
   */
  function onOptionClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!onNavigate) {
      // A real link navigates itself; the palette only closes behind it and keeps the record.
      remember(href);
      close();
      return;
    }
    event.preventDefault();
    // A real anchor click was already confirmed by the dirty-state guard's own click handler.
    select(href, true);
  }

  /** A preview action is a plain link too, with the same modified-click rule as a row. */
  function onPreviewOpen(event: MouseEvent<HTMLAnchorElement>, href: string) {
    // Preview actions use real links too, so apply the stale-result guard before remembering or
    // allowing plain, modified, or assistive-technology activation to leave this page.
    if (!resultsCurrent) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (previewItem) {
      rememberRecent(previewItem);
    }
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    close();
    if (onNavigate) {
      event.preventDefault();
      onNavigate(href);
    }
  }

  function chooseKind(next: KindFilter) {
    setKindFilter(next);
    setActiveIndex(-1);
    setHoverIndex(-1);
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setQuery("");
      setKindFilter("all");
      close();
      return;
    }
    if (!showPopup || !resultsCurrent || options.length === 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHoverIndex(-1);
      setActiveIndex((current) => (current + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHoverIndex(-1);
      setActiveIndex((current) => (current <= 0 ? options.length - 1 : current - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setHoverIndex(-1);
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setHoverIndex(-1);
      setActiveIndex(options.length - 1);
    } else if (event.key === "Enter") {
      // No active row means nobody has been pointed at yet — Enter belongs to whatever else might
      // want it (a surrounding form), and must never be turned into a navigation nobody chose.
      if (activeIndex >= 0) {
        event.preventDefault();
        select(options[activeIndex].href);
      }
    } else if (event.key === "Tab" && !event.shiftKey && !isStart && groups.length > 1) {
      // Tab jumps to the next group's first row, the way the palette's footer says it does. From the
      // last group it is an ordinary Tab, so focus moves on and onBlur closes the palette.
      const current = activeIndex >= 0 ? options[activeIndex] : undefined;
      const groupAt = current ? groups.findIndex((group) => group.items.includes(current)) : -1;
      if (groupAt === groups.length - 1) return;
      const next = groups[groupAt + 1];
      event.preventDefault();
      setHoverIndex(-1);
      setActiveIndex(options.indexOf(next.items[0]));
    }
  }

  const resultCount = isStart ? 0 : options.length;
  // The listbox the field controls: the active row's group, else the first group shown.
  const controlledGroupKey =
    options.length === 0
      ? undefined
      : (groups.find((group) => activeIndex >= 0 && group.items.includes(options[activeIndex]))?.key ?? groups[0]?.key);

  const palette = showPopup ? (
    <>
      <div
        className={styles.scrim}
        data-above-sheets={aboveSheets || undefined}
        style={{ top }}
        aria-hidden="true"
        data-testid="ward-global-search-scrim"
        onMouseDown={() => close()}
      />
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- catches Escape or arrow keys bubbling up from the focused control inside */}
      <div
        ref={paletteRef}
        className={styles.popup}
        data-above-sheets={aboveSheets || undefined}
        // The floating palette sits 8px under the bar. The phone sheet starts at the bottom of the
        // open field, which ward-bar.module.css paints from the top of the screen (under the status
        // bar) to the bar's bottom edge, so the two meet with no gap and no overlap.
        style={
          {
            top: isPhone ? PHONE_SHEET_TOP : top + 8,
            ...(barBox.height > 0 ? { "--wgs-bar-h": `${barBox.height}px`, "--wgs-bar-top": `${barBox.top}px` } : {}),
          } as CSSProperties
        }
        data-testid="ward-global-search-popup"
        data-start={isStart || undefined}
        // Clicking inside keeps focus in the header field, so the keyboard contract never breaks
        // and a link's click still lands after the press.
        onMouseDown={(event) => event.preventDefault()}
      >
        {isStart ? null : (
          <div className={styles.kinds} role="group" aria-label="Show only">
            {KIND_FILTERS.map((filter) => {
              const count = kindCounts.get(filter.key) ?? 0;
              return (
                <button
                  key={filter.key}
                  type="button"
                  className={styles.kind}
                  aria-pressed={activeKind === filter.key}
                  data-empty={count === 0 || undefined}
                  disabled={count === 0 && filter.key !== "all"}
                  onClick={() => chooseKind(filter.key)}
                  data-testid={`ward-global-search-kind-${filter.key}`}
                >
                  {filter.label}
                  <span className={styles.kindCount}>
                    {refusal ? 0 : count}
                    {!refusal && truncatedGroups.some((key) => filter.key === "all" || filter.groups.includes(key))
                      ? "+"
                      : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className={styles.split} data-has-preview={Boolean(previewItem) || undefined}>
          <div className={styles.listPane}>
            {refusal || isStart ? null : (
              <p className={styles.intent} data-testid="ward-global-search-intent">
                {smartResults ? searchIntentLabel(smartResults.intent, trimmed) : ""}
              </p>
            )}
            {refusal ? (
              <p className={styles.refusal} data-testid="ward-global-search-refusal">
                {refusal.sentence}
              </p>
            ) : options.length === 0 ? (
              <div className={styles.empty} data-testid="ward-global-search-empty">
                <Search className={styles.emptyIcon} aria-hidden="true" />
                <span className={styles.emptyTitle}>{answer ? answer.question.heading : "No matches found"}</span>
                <p className={styles.emptyDescription}>
                  {answer
                    ? "Nobody on the Patients page matches this right now."
                    : `No matches for “${trimmed}”. This does not say whether the person or movement exists, only that this search did not find one.`}
                </p>
              </div>
            ) : (
              /* Design audit DA-05: a listbox may hold only options, so each group is its own listbox,
                 named by its heading, and the group's "See all" and "Show all" buttons sit beside it
                 rather than inside it. The field's aria-controls follows the group being browsed. */
              <div id={listId} className={styles.list}>
                {groups.map((group) => (
                  <div key={group.key} className={styles.groupItem}>
                    <div>
                      <span className={styles.group} data-testid={`ward-global-search-group-${group.key}`}>
                        <span id={`${listId}-${group.key}-heading`}>{group.heading}</span>
                        {isStart ? null : (
                          <span className={styles.groupCount}>
                            {fullGroupCounts.get(group.key) ?? group.items.length}
                            {truncatedGroups.includes(group.key) ? "+" : ""}
                          </span>
                        )}
                        {group.key === "needs" && onSeeAllTasks ? (
                          <button
                            type="button"
                            className={styles.showAll}
                            onClick={() => {
                              close();
                              onSeeAllTasks();
                            }}
                            data-testid="ward-global-search-see-all-tasks"
                          >
                            See all tasks
                          </button>
                        ) : null}
                        {(() => {
                          // Audit round 2 (S-33): All cuts each group at six; offer the rest through
                          // that group's kind chip rather than stopping silently.
                          const full = fullGroupCounts.get(group.key) ?? 0;
                          const kind = KIND_FILTERS.find((filter) => filter.groups.includes(group.key));
                          if (isStart || activeKind !== "all" || !kind || full <= group.items.length) return null;
                          return (
                            <button
                              type="button"
                              className={styles.showAll}
                              onClick={() => chooseKind(kind.key)}
                              data-testid={`ward-global-search-show-all-${group.key}`}
                            >
                              {truncatedGroups.includes(group.key) ? "Show first" : "Show all"} {full}
                            </button>
                          );
                        })()}
                      </span>
                      {truncatedGroups.includes(group.key) ? (
                        <p className={styles.emptyDescription}>
                          First {fullGroupCounts.get(group.key)} matches. Refine your search to see other matches.
                        </p>
                      ) : null}
                    </div>
                    <ul
                      id={`${listId}-${group.key}`}
                      role="listbox"
                      aria-labelledby={`${listId}-${group.key}-heading`}
                      className={styles.groupList}
                    >
                      {group.items.map((item) => {
                        const index = options.indexOf(item);
                        return (
                          <li
                            key={`${group.key}-${item.kind}-${item.id}`}
                            role="presentation"
                            className={styles.optionItem}
                          >
                            <Link
                              id={`${id}-opt-${index}`}
                              href={item.href}
                              role="option"
                              aria-selected={resultsCurrent && activeIndex === index}
                              aria-disabled={!resultsCurrent || undefined}
                              tabIndex={-1}
                              // Stale rows stay mounted to avoid the popup flash, but never open a
                              // result for text that is no longer in the field. The footer link is
                              // not a result, so it keeps working.
                              onClick={(event) => {
                                if (resultsCurrent) {
                                  onOptionClick(event, item.href);
                                  return;
                                }
                                event.preventDefault();
                                event.stopPropagation();
                              }}
                              onAuxClick={(event) => {
                                if (!resultsCurrent) {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }
                              }}
                              onMouseEnter={() => setHoverIndex(index)}
                              className={styles.option}
                              data-active={(resultsCurrent && activeIndex === index) || undefined}
                              data-previewed={previewIndex === index || undefined}
                              data-testid={`ward-global-search-result-${item.kind}-${item.id}`}
                            >
                              <span className={styles.itemIconBox} aria-hidden="true">
                                {item.tone ? (
                                  <StatusGlyph tone={item.tone} />
                                ) : (
                                  <SearchResultIcon kind={item.kind} id={item.id} />
                                )}
                              </span>
                              <span className={styles.resultContent}>
                                <span className={styles.resultTitle}>{patientResultTitle(item, nameFor)}</span>
                                <span className={styles.resultMeta}>
                                  {item.umrn ? (
                                    <>
                                      <span className={styles.umrn}>{item.umrn}</span>
                                      {item.dateOfBirth ? (
                                        <span>born {formatDateOfBirth(item.dateOfBirth)}</span>
                                      ) : null}
                                    </>
                                  ) : item.readyBeds !== undefined && !item.meta ? (
                                    <span>
                                      {item.siteName} · {item.readyBeds} ready
                                    </span>
                                  ) : item.meta ? (
                                    <span>{item.meta}</span>
                                  ) : null}
                                </span>
                              </span>
                              <span className={styles.resultKind}>{item.kindLabel}</span>
                              <span className={styles.actionHint} aria-hidden="true">
                                <CornerDownLeft className={styles.actionHintIcon} aria-hidden="true" />
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {showQuickCommands && !refusal ? (
              <div
                role="group"
                aria-label="Quick commands"
                className={styles.quickCommands}
                data-testid="ward-global-search-quick-commands"
              >
                <span className={styles.group} data-testid="ward-global-search-group-commands">
                  <span>Quick commands</span>
                </span>
                {demoOff ? (
                  <p id={demoOffId} className={styles.commandNote} data-testid="ward-global-search-demo-off">
                    {DEMO_CONTROLS_OFF}
                  </p>
                ) : null}
                <div className={styles.commandList}>
                  <button
                    type="button"
                    className={styles.commandBtn}
                    disabled={!resultsCurrent || demoOff}
                    aria-describedby={demoOff ? demoOffId : undefined}
                    data-testid="ward-global-search-cmd-advance-clock"
                    onClick={() => {
                      if (wardFlow) {
                        wardFlow.dispatch({
                          type: "ADVANCE_CLOCK",
                          role: "demo",
                          now: now ?? wardFlow.now,
                          minutes: 15,
                        });
                      }
                      close();
                    }}
                  >
                    <span className={styles.commandLabel}>Advance demo clock +15m</span>
                    <kbd className={styles.hintKbd}>+15m</kbd>
                  </button>
                  <button
                    type="button"
                    className={styles.commandBtn}
                    disabled={!resultsCurrent}
                    data-testid="ward-global-search-cmd-desk-coordinator"
                    onClick={() => {
                      // Ask before the desk or persona changes, so cancelling leaves everything as it was.
                      if (!confirmLeave()) return;
                      setDeskRole("coordinator", "/ward-flow");
                      dispatchPersonaSyncForRole("coordinator");
                      select("/ward-flow", true);
                    }}
                  >
                    <span className={styles.commandLabel}>Switch to Coordinator desk</span>
                    <kbd className={styles.hintKbd}>Coordinator</kbd>
                  </button>
                  <button
                    type="button"
                    className={styles.commandBtn}
                    disabled={!resultsCurrent}
                    data-testid="ward-global-search-cmd-desk-ward"
                    onClick={() => {
                      // Ask before the desk or persona changes, so cancelling leaves everything as it was.
                      if (!confirmLeave()) return;
                      setDeskRole("ward", "/ward-flow/wards");
                      dispatchPersonaSyncForRole("ward");
                      select("/ward-flow/wards", true);
                    }}
                  >
                    <span className={styles.commandLabel}>Switch to Ward desk</span>
                    <kbd className={styles.hintKbd}>Ward</kbd>
                  </button>
                  <button
                    type="button"
                    className={styles.commandBtn}
                    disabled={!resultsCurrent}
                    data-testid="ward-global-search-cmd-desk-ed"
                    onClick={() => {
                      // Ask before the desk or persona changes, so cancelling leaves everything as it was.
                      if (!confirmLeave()) return;
                      setDeskRole("ed", "/ward-flow/ed");
                      dispatchPersonaSyncForRole("ed");
                      select("/ward-flow/ed", true);
                    }}
                  >
                    <span className={styles.commandLabel}>Switch to ED desk</span>
                    <kbd className={styles.hintKbd}>ED</kbd>
                  </button>
                  <button
                    type="button"
                    className={styles.commandBtn}
                    disabled={!resultsCurrent}
                    data-testid="ward-global-search-cmd-desk-officer"
                    onClick={() => {
                      // Ask before the desk or persona changes, so cancelling leaves everything as it was.
                      if (!confirmLeave()) return;
                      setDeskRole("officer", "/ward-flow/transport/officer");
                      dispatchPersonaSyncForRole("officer");
                      select("/ward-flow/transport/officer", true);
                    }}
                  >
                    <span className={styles.commandLabel}>Switch to Transport desk</span>
                    <kbd className={styles.hintKbd}>Transport</kbd>
                  </button>
                  <button
                    type="button"
                    className={styles.commandBtn}
                    disabled={!resultsCurrent}
                    data-testid="ward-global-search-cmd-handover"
                    onClick={() => select("/ward-flow/handover")}
                  >
                    <span className={styles.commandLabel}>Open Handover sheet</span>
                    <kbd className={styles.hintKbd}>/handover</kbd>
                  </button>
                  <button
                    type="button"
                    className={styles.commandBtn}
                    disabled={!resultsCurrent}
                    aria-expanded={shortcutsExpanded}
                    data-testid="ward-global-search-cmd-shortcuts"
                    onClick={() => setShowShortcuts((prev) => !prev)}
                  >
                    <span className={styles.commandLabel}>Keyboard shortcuts (?)</span>
                    <kbd className={styles.hintKbd}>?</kbd>
                  </button>
                </div>
                {shortcutsExpanded ? (
                  <div
                    className={styles.shortcutsSheet}
                    role="region"
                    aria-label="Keyboard shortcuts"
                    data-testid="ward-global-search-shortcuts-sheet"
                  >
                    <span className={styles.shortcutRow}>
                      <span>Global search &amp; commands</span>
                      <span>
                        <kbd className={styles.hintKbd}>Ctrl+K</kbd> <kbd className={styles.hintKbd}>/</kbd>
                      </span>
                    </span>
                    <span className={styles.shortcutRow}>
                      <span>New referral</span>
                      <kbd className={styles.hintKbd}>Shift+R</kbd>
                    </span>
                    <span className={styles.shortcutRow}>
                      <span>Tasks drawer</span>
                      <kbd className={styles.hintKbd}>Shift+T</kbd>
                    </span>
                    <span className={styles.shortcutRow}>
                      <span>Activity drawer</span>
                      <kbd className={styles.hintKbd}>Shift+A</kbd>
                    </span>
                    <span className={styles.shortcutRow}>
                      <span>Toggle navigation rail</span>
                      <kbd className={styles.hintKbd}>[</kbd>
                    </span>
                    <span className={styles.shortcutRow}>
                      <span>Dismiss / clear</span>
                      <kbd className={styles.hintKbd}>Esc</kbd>
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {previewItem ? (
            <div
              className={styles.previewPane}
              inert={!resultsCurrent || undefined}
              aria-disabled={!resultsCurrent || undefined}
            >
              <GlobalSearchPreview
                item={previewItem}
                patients={patients}
                referrals={referrals}
                movements={movements}
                units={units}
                now={now}
                dayZero={wardFlow?.dayZero}
                census={census}
                onOpen={onPreviewOpen}
              />
            </div>
          ) : null}
        </div>

        <div className={styles.resultsFooter} data-testid="ward-global-search-footer">
          <div className={styles.footerHints} aria-hidden="true" data-kbd-hint="">
            <span className={styles.hintItem}>
              <kbd className={styles.hintKbd}>↑</kbd>
              <kbd className={styles.hintKbd}>↓</kbd>
              <span className={styles.hintLabel}>Navigate</span>
            </span>
            <span className={styles.hintItem}>
              <kbd className={styles.hintKbd}>↵</kbd>
              <span className={styles.hintLabel}>Select</span>
            </span>
            {isStart ? null : (
              <span className={styles.hintItem}>
                <kbd className={styles.hintKbd}>Tab</kbd>
                <span className={styles.hintLabel}>Next group</span>
              </span>
            )}
            <span className={styles.hintItem}>
              <kbd className={styles.hintKbd}>Esc</kbd>
              <span className={styles.hintLabel}>Dismiss</span>
            </span>
          </div>
          <Link
            href={PATIENT_SEARCH_HREF}
            className={styles.fullSearch}
            onClick={(event) => {
              handOffPatientSearchText(isNewTabClick(event) ? undefined : query);
              onOptionClick(event, PATIENT_SEARCH_HREF);
            }}
            data-testid="ward-global-search-full"
          >
            Full patient search
            <ChevronRight className={styles.fullSearchIcon} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </>
  ) : null;

  return (
    <div
      className={styles.root}
      ref={rootRef}
      data-testid="ward-global-search"
      data-open={showPopup || undefined}
      // Focus moving anywhere outside the field, its Clear and Cancel buttons and the palette closes
      // the palette, so a keyboard user is never left with a scrim over the control they moved on to
      // (design audit DA-04, WCAG 2.4.11). Checked here rather than on the input because Cancel and
      // the palette's own buttons can hold focus too; the portalled palette's blurs bubble here
      // through React. A blur with no next target (a row unmounting) leaves the palette as it is.
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (!next || rootRef.current?.contains(next) || paletteRef.current?.contains(next)) return;
        close();
      }}
      // The compact bar lays the open field over itself at the bar's measured height.
      style={
        barBox.height > 0
          ? ({ "--wgs-bar-h": `${barBox.height}px`, "--wgs-bar-top": `${barBox.top}px` } as CSSProperties)
          : undefined
      }
    >
      {scope !== undefined ? (
        <span className={styles.scopeChip} data-testid="ward-global-search-scope">
          {scope}
        </span>
      ) : null}
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.controlBox}>
        <Search className={styles.icon} width={16} height={16} aria-hidden="true" />
        <input
          id={id}
          ref={inputRef}
          className={styles.input}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          enterKeyHint="search"
          spellCheck={false}
          aria-haspopup="listbox"
          aria-controls={showPopup && controlledGroupKey ? `${listId}-${controlledGroupKey}` : undefined}
          aria-activedescendant={resultsCurrent && activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-describedby={hintId}
          placeholder={preparing ? "Preparing search…" : placeholder}
          disabled={preparing}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
            setHoverIndex(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          data-testid="ward-global-search-input"
        />
        {query.length === 0 ? (
          <kbd aria-hidden="true" className={styles.shortcut} data-ward-search-shortcut>
            /
          </kbd>
        ) : null}
        {query.length > 0 ? (
          <button
            type="button"
            className={styles.clear}
            data-testid="ward-global-search-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setKindFilter("all");
              setActiveIndex(-1);
              setHoverIndex(-1);
              inputRef.current?.focus();
            }}
          >
            <X className={styles.clearIcon} width={12} height={12} aria-hidden="true" />
            <span className={styles.clearText}>Clear</span>
          </button>
        ) : null}
        {/* Phone only (the compact bar shows it while the palette is open): the field takes over the
            bar, and this is the one way back out on a touch screen with no Esc key. */}
        {showPopup ? (
          <button
            type="button"
            className={styles.cancel}
            data-testid="ward-global-search-cancel"
            onClick={() => {
              setQuery("");
              setKindFilter("all");
              close();
              inputRef.current?.blur();
            }}
          >
            Cancel
          </button>
        ) : null}
      </div>
      <span className={styles.guidance} id={hintId}>
        {preparing ? (
          "Preparing workspace. Search will be available shortly."
        ) : (
          <>
            Press <kbd>/</kbd> or <kbd>Ctrl K</kbd> to search from anywhere. <kbd>Esc</kbd> clears.
          </>
        )}
      </span>
      {/* Announced for a screen-reader user, the same reason `PatientTypeahead` announces its own
          count: the list changes under someone who cannot see it change. */}
      <p className="sr-only" role="status" aria-live="polite">
        {preparing
          ? "Preparing workspace. Search will be available shortly."
          : refusal
            ? refusal.sentence
            : trimmed.length === 0
              ? ""
              : resultCount === 0
                ? "No matches."
                : `${resultCount} invented ${resultCount === 1 ? "result" : "results"} found.`}
      </p>
      {palette && typeof document !== "undefined" ? createPortal(palette, document.body) : null}
    </div>
  );
}

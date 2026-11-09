"use client";

import { navigateWithDirtyGuard } from "@/components/ward-management/use-dirty-state-guard";

import { lockPageScroll } from "@/components/wf/sheet-focus";
import { isGlobalSearchShortcut } from "@/components/ward-management/search/search-shortcut";
import { revealWardOption } from "@/components/ward-management/ward-scroll";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  useDeferredValue,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
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
import { useIsPhone, WF_PHONE_QUERY } from "@/components/wf";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";

import type { InboxItem } from "@/components/ward-management/ward-derivations";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { useDeskRoleSwitch } from "@/components/ward-management/ward-role-gate";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useOptionalWardFlow } from "@/components/ward-management/ward-flow-provider";
import { DEMO_CONTROLS_OFF } from "@/components/ward-management/ward-flow-raise";
import { dispatchPersonaSyncForRole } from "@/components/ward-management/settings/persona-sync";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { foldPatientSearchText, type Patient } from "@/components/ward-management/ward-patients";
import { ChevronRight, Search, X } from "lucide-react";

import styles from "./ward-global-search.module.css";
import {
  needsYouMeta,
  censusRowItem,
  recentViewItem,
  smartSearchGroups,
  closingFirst,
  type HelpPreviewSource,
  type HelpSearchRows,
  type SearchResultGroup,
  type SearchResultItem,
  START_ACTIONS,
} from "./ward-global-search-groups";
import { SearchOptionBody } from "./ward-global-search-option-body";
import { WardSearchCommands } from "./ward-global-search-commands";
import { WardSearchKeyHints } from "./ward-global-search-key-hints";
import { askWardHelp, looksLikeHelpQuestion } from "./help/ward-help-events";
import { useWardFeatureFlag } from "./shell/ward-feature-flag-store";
import { useAccessNavFilter } from "./shell/ward-access";
import { useSearchMyViews } from "./ward-global-search-my-views";
import { recentsLifetimeNow, rememberRecent, useSessionRecents } from "./ward-global-search-recents";
import {
  EmptyTry,
  PhoneSheet,
  permittedSearchResult,
  QuickPatient,
  SHEET_KINDS,
  TryAsking,
  quickPatientHref,
  withGoTo,
} from "./ward-global-search-smart";

export {
  patientResultTitle,
  smartSearchGroups,
  type SearchResultGroup,
  type SearchResultItem,
} from "./ward-global-search-groups";
export { SearchResultIcon } from "./ward-global-search-icon";
export { clearGlobalSearchRecents } from "./ward-global-search-recents";
export { permittedSearchResult } from "./ward-global-search-smart";

/**
 * Global search keeps its position, width and keyboard shortcut across desks (owner ruling).
 * Callers supply the scope chip. Shared catalogue matches use the menu's own-place destination
 * adaptation followed by the caller's permission checks.
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
 * NAVIGATION: real links preserve plain, middle and modified clicks. `onNavigate` lets tests observe
 * their destination. Keyboard selection uses the router because aria-activedescendant keeps focus
 * on the textbox; imperative transitions ask the composed unsaved-work guard first.
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
  /**
   * Whether the header drawer is the bed coordinator's actionable Alerts queue (D-61). The drawer
   * is called Alerts on every desk (design audit 2, 5 Nov 2026), so search always says Alerts and
   * this flag no longer changes a word. Kept so callers need no change.
   */
  tasksAreAlerts?: boolean;
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
  /** Opaque lifetime from the host. Null means no current authorised snapshot; no role logic here. */
  accessLifetime?: string | null;
  /** Caller-owned navigation permissions; the shared matcher and public place catalogue stay role-blind. */
  canOpenHref?: (href: string) => boolean;
  canRunAction?: (action: "new-referral" | "add-patient" | "advance-clock") => boolean;
  /** Help's answers for the typed words, from the caller (`ward-global-search-help.tsx`). */
  findHelp?: (query: string) => HelpSearchRows;
  /** Runs a chosen Help row; false means follow its link as usual. */
  onHelpResult?: (id: string) => boolean;
  /** A Help row's answer, steps and Show me for the preview pane, from the same caller. */
  helpPreview?: HelpPreviewSource;
};

const NO_HELP: HelpSearchRows = { items: [] };

const allowSearchChoice = () => true;

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
type KindFilter =
  | "all"
  | "answers"
  | "people"
  | "movements"
  | "referrals"
  | "places"
  | "forms"
  | "views"
  | "tasks"
  | "contacts"
  | "help";

const KIND_FILTERS: readonly { key: KindFilter; label: string; groups: readonly string[] }[] = [
  { key: "all", label: "All", groups: [] },
  // A common question ("over 24 hours") answered from the Patients page's census (search-answers.ts).
  { key: "answers", label: "Answers", groups: ["answers"] },
  { key: "people", label: "People", groups: ["people"] },
  { key: "movements", label: "Movements", groups: ["movements"] },
  { key: "referrals", label: "Referrals", groups: ["referrals"] },
  { key: "places", label: "Places", groups: ["beds", "wards", "eds", "teams", "suburbs"] },
  { key: "forms", label: "Forms", groups: ["forms"] },
  { key: "views", label: "Views", groups: ["myviews", "views"] },
  { key: "tasks", label: "Alerts", groups: ["tasks"] },
  { key: "contacts", label: "Contacts", groups: ["contacts"] },
  { key: "help", label: "Help", groups: ["help"] },
];

/** The header drawer is Alerts on every desk (DESIGN-SYSTEM §6). */
const ALERTS_WORD = { many: "Alerts", one: "Alert" } as const;

const FULL_RESULTS_PER_GROUP = 40;

/** The screens offered before anything is typed: the four a coordinator jumps to most. */
const START_VIEW_KEYS = ["capacity", "delays", "referrals", "handover"] as const;

const NEEDS_YOU_LIMIT = 3;

/** The header's bottom edge, so the scrim and palette start under the bar rather than covering it. */
/** The width where the open search is a full screen sheet (`.popup` in the module's phone block). */
const PHONE_SEARCH_QUERY = WF_PHONE_QUERY;

/** The phone sheet's top: the open field's bottom edge (the bar's top or the status bar, plus the bar). */
const PHONE_SHEET_TOP = "calc(max(var(--wgs-bar-top, 0px), env(safe-area-inset-top, 0px)) + 4.25rem)";

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

export { WardPublicSearch } from "./ward-public-search";

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
  accessLifetime = "standalone",
  canOpenHref = allowSearchChoice,
  canRunAction = allowSearchChoice,
  findHelp,
  onHelpResult,
  helpPreview,
}: WardGlobalSearchProps) {
  const id = useId();
  // One word on every desk: the header drawer is Alerts (DESIGN-SYSTEM §6, design audit 2).
  const tasksWord = ALERTS_WORD;
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const demoOffId = `${id}-demo-off`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const deskSwitch = useDeskRoleSwitch();
  // Search audit, 8 Nov 2026: the desk's role leads with its own kind of place (`searchGroupOrder`).
  const deskRole = useEffectiveWardAccess().role;
  const nameFor = usePatientNameDisplay();
  const wardFlow = useOptionalWardFlow();
  const demoOff = wardFlow?.demoControlsAvailable === false;
  const preparing = wardFlow?.sessionAdopted === false;
  const accessNav = useAccessNavFilter();
  const permittedResult = useCallback(
    (item: SearchResultItem) => {
      // Match the catalogue first, then apply the menu's own-place destination and gate.
      const adapted = item.kind === "view" ? accessNav([{ ...item, label: item.title }]) : [item];
      return adapted.flatMap((shown) => permittedSearchResult(shown, canOpenHref, canRunAction));
    },
    [accessNav, canOpenHref, canRunAction],
  );

  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hoverIndex, setHoverIndex] = useState(-1);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [top, setTop] = useState(0);
  const [barBox, setBarBox] = useState<{ top: number; height: number }>({ top: 0, height: 0 });
  const recentRecords = useSessionRecents(accessLifetime);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const trimmed = deferredQuery.trim();
  const askHelpOn = useWardFeatureFlag("help-ask");
  const lookup = useMemo(() => ({ patients, referrals, movements }), [patients, referrals, movements]);
  const isStart = trimmed.length === 0;
  const showQuickCommands = isStart || /^(switch|clock|reset|handover|shortcuts|save|\?)/i.test(trimmed);
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
            limitPerGroup: Number.POSITIVE_INFINITY,
            plannedAdmissions,
            admissions: wardFlow?.admissions,
          }),
    [trimmed, patients, movements, units, referrals, now, plannedAdmissions, wardFlow?.admissions],
  );

  const literalPerson = patients.some((patient) =>
    [
      patient.givenName,
      patient.familyName,
      `${patient.givenName} ${patient.familyName}`,
      `${patient.familyName}, ${patient.givenName}`,
    ].some((name) => foldPatientSearchText(name) === foldPatientSearchText(trimmed)),
  );
  const refusal = trimmed.length === 0 || literalPerson ? undefined : refusalFor(trimmed);
  const help = useMemo(
    () => (!findHelp || refusal || trimmed.length === 0 ? NO_HELP : findHelp(trimmed)),
    [findHelp, refusal, trimmed],
  );

  /*
   * The Patients page's census, built only while the palette is open: it answers the common
   * questions ("over 24 hours") and gives the preview each person's "where now" and next step, so
   * the header and the Patients page cannot disagree. Outside a provider (tests) there is none, and
   * search simply has no answers and no "where now" line.
   */
  const admissions = wardFlow?.admissions;
  const leaveBeds = wardFlow?.leaveBeds;
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
            leaveBeds,
            now,
            thresholds: dueSoonThresholdsOf(configuration),
            dayZero: censusDayZero,
          }),
    [
      open,
      admissions,
      leaveBeds,
      censusDayZero,
      now,
      movements,
      referrals,
      units,
      patients,
      plannedAdmissions,
      configuration,
    ],
  );
  const answer = useMemo(
    () => (trimmed.length === 0 || refusal ? undefined : answerQuestion(trimmed, census, FULL_RESULTS_PER_GROUP)),
    [trimmed, refusal, census],
  );

  const recents = useMemo(
    () =>
      (!open ? [] : recentRecords).flatMap((recent): SearchResultItem[] => {
        if (recent.kind === "task") {
          const task = tasks?.find((candidate) => candidate.id === recent.id);
          return task
            ? [
                {
                  kind: "task",
                  kindLabel: "Alert",
                  id: task.id,
                  title: task.title,
                  meta: needsYouMeta(task, lookup, nameFor),
                  href: task.href ?? movementHref(task.movementId),
                  movementId: task.movementId,
                  tone: task.tone,
                },
              ]
            : [];
        }
        if (recent.kind === "stay") {
          const row = census?.rows.find((candidate) => candidate.kind === "admission" && candidate.key === recent.id);
          return row ? [censusRowItem(row)] : [];
        }
        // The catalogue row only: the start groups' permittedResult pass applies the menu's own-place
        // destination and then the caller's route permission, so a revoked screen still drops out.
        if (recent.kind === "view") return recentViewItem(recent.id);
        let query = recent.id;
        if (recent.kind === "person") {
          const patient = patients.find((candidate) => candidate.id === recent.id);
          if (!patient) return [];
          query = patient.umrn;
        }
        if (recent.kind === "bed") {
          const split = recent.id.lastIndexOf(":");
          const unit = units.find((candidate) => candidate.id === recent.id.slice(0, split));
          if (!unit) return [];
          query = `${unit.name} bed ${recent.id.slice(split + 1)}`;
        }
        const current = searchWardFlow({
          query,
          patients,
          movements,
          units,
          referrals,
          now,
          plannedAdmissions,
          admissions,
          limitPerGroup: Number.POSITIVE_INFINITY,
        });
        const item = smartSearchGroups(current, query, units, lookup)
          .flatMap((group) => group.items)
          .find((candidate) => candidate.kind === recent.kind && candidate.id === recent.id);
        return item ? [item] : [];
      }),
    [
      open,
      recentRecords,
      tasks,
      lookup,
      nameFor,
      census,
      units,
      patients,
      movements,
      referrals,
      now,
      plannedAdmissions,
      admissions,
    ],
  );

  // Apply navigation permission before the display limit: inaccessible catalogue rows must
  // never consume the only slot in which a permitted team could appear.
  const permittedGroups = useMemo(
    () =>
      (!smartResults || refusal
        ? []
        : smartSearchGroups(smartResults, trimmed, units, lookup, answer, help.items, deskRole)
      )
        .map((group) => ({ ...group, items: group.items.flatMap(permittedResult) }))
        .filter((group) => group.items.length > 0),
    [smartResults, refusal, trimmed, units, lookup, answer, help, permittedResult, deskRole],
  );
  const truncatedGroups = useMemo(
    () => [
      ...permittedGroups.filter((group) => group.items.length > FULL_RESULTS_PER_GROUP).map((group) => group.key),
      ...(answer && answer.total > answer.rows.length ? ["answers"] : []),
    ],
    [permittedGroups, answer],
  );
  // My views (feature 45): a person's saved screens lead when their name matches.
  const myViews = useSearchMyViews(open, trimmed, permittedResult);
  const allGroups = useMemo(
    () => [
      ...(myViews.matchGroup ? [myViews.matchGroup] : []),
      ...permittedGroups.map((group) => ({
        ...group,
        items: group.items.slice(0, FULL_RESULTS_PER_GROUP),
      })),
    ],
    [permittedGroups, myViews.matchGroup],
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

  /** The four common screens: the start screen's Go to, and the empty state's Try. */
  const startViews = useMemo(() => {
    const views = accessNav(CORE_SEARCH_VIEWS.map((view) => ({ ...view, id: view.key, label: view.title })));
    const usual = START_VIEW_KEYS.flatMap((key) => {
      const view = views.find((candidate) => candidate.key === key);
      return view && canOpenHref(view.href) ? [view] : [];
    });
    return usual.length ? usual : views.filter((view) => canOpenHref(view.href)).slice(0, 4);
  }, [accessNav, canOpenHref]);

  /** What someone sees before typing: live work, recent records, common screens and actions. */
  const startGroups = useMemo(() => {
    const g: SearchResultGroup[] = [];
    // Search redesign (Josh, 4 Nov 2026): the common screens lead, as a row of tiles above the lists.
    g.push({
      key: "goto",
      heading: "Go to",
      items: startViews.map((view) => ({
        kind: "view",
        kindLabel: "View",
        id: view.key,
        title: view.title,
        meta: view.description ?? "",
        href: view.href,
      })),
    });
    const allNeeds = tasks ?? [];
    const needs = allNeeds.slice(0, NEEDS_YOU_LIMIT);
    if (needs.length > 0) {
      g.push({
        key: "needs",
        // shell-4: a cut list says so, with the full count the Tasks badge shows.
        heading:
          // UX audit (21 Oct 2026): named after the drawer it previews, as "Needs you" is Home's list.
          allNeeds.length > needs.length ? `${tasksWord.many} · ${needs.length} of ${allNeeds.length}` : tasksWord.many,
        items: needs.map((task) => ({
          kind: "task",
          kindLabel: "Alert",
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
    if (myViews.startGroup) g.push(myViews.startGroup);
    if (recents.length > 0) {
      g.push({ key: "recent", heading: "Recent", items: [...recents] });
    }
    g.push({
      key: "do",
      heading: "Do",
      items: START_ACTIONS.filter(
        (item) => canOpenHref(item.href) && canRunAction(item.id as "new-referral" | "add-patient"),
      ),
    });
    return g
      .map((group) => ({ ...group, items: group.items.flatMap(permittedResult) }))
      .filter((group) => group.items.length > 0);
  }, [
    tasks,
    recents,
    lookup,
    nameFor,
    tasksWord,
    startViews,
    myViews.startGroup,
    canOpenHref,
    canRunAction,
    permittedResult,
  ]);

  // A chosen kind with nothing for the current query falls back to All, so a new query never shows
  // a false "No matches" while the chips beside it count real results.
  const activeKind: KindFilter = (kindCounts.get(kindFilter) ?? 0) > 0 ? kindFilter : "all";

  const groups = useMemo(() => {
    if (isStart) return startGroups;
    const filter = KIND_FILTERS.find((candidate) => candidate.key === activeKind) ?? KIND_FILTERS[0];
    if (filter.key === "all") {
      const cut = allGroups.map((group) => ({ ...group, items: group.items.slice(0, MAX_RESULTS_PER_GROUP) }));
      return withGoTo(cut, allGroups, trimmed);
    }
    return allGroups.filter((group) => filter.groups.includes(group.key));
  }, [isStart, startGroups, allGroups, activeKind, trimmed]);

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
  const optionsKey = useMemo(
    () => JSON.stringify([trimmed, options.map(({ kind, id, href }) => [kind, id, href])]),
    [options, trimmed],
  );
  const [seenOptionsKey, setSeenOptionsKey] = useState(optionsKey);
  // The Go to row is active without anyone choosing it: Enter opens it, but Home, End and Tab keep
  // their editing and group jobs until the arrows have moved (search audit, 3 Nov 2026).
  const [autoActive, setAutoActive] = useState(false);
  if (optionsKey !== seenOptionsKey) {
    setSeenOptionsKey(optionsKey);
    // Before typing, Go to leads as tiles but nothing is chosen for the person.
    const leadsWithMatch = !isStart && groups[0]?.key === "goto";
    setActiveIndex(leadsWithMatch ? 0 : -1);
    setAutoActive(leadsWithMatch);
    setHoverIndex(-1);
  }

  /** The preview follows the pointer, then the keyboard, then falls back to the first row. */
  const previewIndex = hoverIndex >= 0 ? hoverIndex : activeIndex >= 0 ? activeIndex : 0;
  const isPhone = useIsPhoneSearch();
  const previewItem = refusal || isPhone ? undefined : options[previewIndex];
  /*
   * PHONE PREVIEW SHEET (Josh, 3 Nov 2026). The phone has no preview pane, so a tap on a person,
   * movement, referral or task first shows the same preview as a sheet over the results, with its
   * own Open buttons. Screens, places and actions still open straight away.
   */
  const [sheetItem, setSheetItem] = useState<SearchResultItem | undefined>(undefined);
  const phoneSheetItem =
    isPhone && sheetItem
      ? options.find((item) => item.kind === sheetItem.kind && item.id === sheetItem.id && item.href === sheetItem.href)
      : undefined;

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
      // The floating panel centres under the search box, not the window.
      const field = rootRef.current?.getBoundingClientRect();
      if (field && field.width > 0) {
        paletteRef.current?.style.setProperty("--wgs-anchor-x", `${Math.round(field.left + field.width / 2)}px`);
      }
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

  // Set by Cancel when it hands focus back to the field, so that focus does not reopen the palette.
  const skipOpenOnFocusRef = useRef(false);

  function close() {
    setSheetItem(undefined);
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
      rememberRecent(item, accessLifetime);
    }
  }

  /** P141 (Josh, 27 Oct 2026, 10:12 PM AWST): the search box clears after a result opens. */
  function clearAfterOpen() {
    setQuery("");
    close();
  }

  /** Help choices share the same unsaved-work decision as route navigation. */
  function openedAsHelp(item: SearchResultItem | undefined): boolean {
    if (item?.kind !== "help" || !onHelpResult) return false;
    navigateWithDirtyGuard(() => {
      if (accessLifetime === null || recentsLifetimeNow() !== accessLifetime) return;
      if (onHelpResult(item.id)) clearAfterOpen();
      else if (item.href !== "") select(item.href, true);
    });
    return true;
  }

  function select(href: string, confirmed = false) {
    if (accessLifetime === null || recentsLifetimeNow() !== accessLifetime) return;
    const go = () => {
      if (recentsLifetimeNow() !== accessLifetime) return;
      remember(href);
      clearAfterOpen();
      if (onNavigate) onNavigate(href);
      else router.push(href);
    };
    if (confirmed) go();
    else navigateWithDirtyGuard(go);
  }

  /** Test routing intercepts plain clicks only; modified clicks retain the browser's link behaviour. */
  function onOptionClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!onNavigate) {
      remember(href);
      clearAfterOpen();
      return;
    }
    event.preventDefault();
    select(href, true);
  }

  /** A preview action is a plain link too, with the same modified-click rule as a row. */
  function onPreviewOpen(event: MouseEvent<HTMLAnchorElement>, href: string) {
    // Guard stale previews before any browser or keyboard activation.
    if (!resultsCurrent || accessLifetime === null || recentsLifetimeNow() !== accessLifetime) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const opened = phoneSheetItem ?? previewItem;
    if (opened) {
      rememberRecent(opened, accessLifetime);
    }
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    clearAfterOpen();
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
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
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
      setAutoActive(false);
      setActiveIndex((current) => (current + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHoverIndex(-1);
      setAutoActive(false);
      setActiveIndex((current) => (current <= 0 ? options.length - 1 : current - 1));
    } else if (event.key === "Home" && activeIndex >= 0 && !autoActive) {
      event.preventDefault();
      setHoverIndex(-1);
      setActiveIndex(0);
    } else if (event.key === "End" && activeIndex >= 0 && !autoActive) {
      event.preventDefault();
      setHoverIndex(-1);
      setActiveIndex(options.length - 1);
    } else if (event.key === "Enter") {
      // Enter opens only an explicitly selected result.
      if (activeIndex >= 0) {
        event.preventDefault();
        const active = options[activeIndex];
        if (!openedAsHelp(active) && active.href !== "") select(active.href);
      }
    } else if (event.key === "Tab" && !event.shiftKey && !isStart && groups.length > 1) {
      // Tab jumps to the next group's first row, the way the palette's footer says it does. From the
      // last group it is an ordinary Tab, so focus moves on and onBlur closes the palette.
      const current = activeIndex >= 0 && !autoActive ? options[activeIndex] : undefined;
      const groupAt = current ? groups.findIndex((group) => group.items.includes(current)) : -1;
      if (groupAt === groups.length - 1) return;
      const next = groups[groupAt + 1];
      event.preventDefault();
      setAutoActive(false);
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
        style={{ top: isPhone ? 0 : top }} // Phone: the frost covers the whole screen (4 Nov 2026).
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
        aria-busy={!resultsCurrent || undefined}
        data-start={isStart || undefined}
        // Clicking inside keeps focus in the header field, so the keyboard contract never breaks
        // and a link's click still lands after the press.
        onMouseDown={(event) => event.preventDefault()}
      >
        {/* No chips when nothing matched: a lone "All 0" chip says nothing the empty message does not. */}
        {isStart || (kindCounts.get("all") ?? 0) === 0 ? null : (
          <div className={styles.kinds} role="group" aria-label="Show only">
            {KIND_FILTERS.map((filter) => {
              const count = kindCounts.get(filter.key) ?? 0;
              // UX audit (21 Oct 2026): a kind with nothing found is left out rather than shown at 0.
              if (count === 0 && filter.key !== "all" && activeKind !== filter.key) return null;
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
                  {filter.key === "tasks" ? tasksWord.many : filter.label}
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
            {help.note && !refusal ? (
              <p className={styles.refusal} data-testid="ward-global-search-help-note">
                {help.note}
              </p>
            ) : null}
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
                    : `Nothing found for “${trimmed}”. That does not mean the person or movement does not exist.`}
                </p>
                {answer ? null : <EmptyTry views={startViews} onClick={onOptionClick} />}
                {askHelpOn && !answer && looksLikeHelpQuestion(trimmed) ? (
                  <button
                    type="button"
                    className={styles.askHelp}
                    onClick={() => {
                      close();
                      askWardHelp(trimmed);
                    }}
                    data-testid="ward-global-search-ask-help"
                  >
                    Ask Help: {trimmed}
                  </button>
                ) : null}
              </div>
            ) : (
              /* Design audit DA-05: a listbox may hold only options, so each group is its own listbox,
                 named by its heading, and the group's "See all" and "Show all" buttons sit beside it
                 rather than inside it. The field's aria-controls follows the group being browsed. */
              <div id={listId} className={styles.list}>
                {isStart && census ? (
                  <TryAsking
                    census={census}
                    onAsk={(phrase) => {
                      setQuery(phrase);
                      inputRef.current?.focus();
                    }}
                  />
                ) : null}
                {groups.map((group) => (
                  <div key={group.key} className={styles.groupItem} data-goto={group.key === "goto" || undefined}>
                    <div>
                      <span className={styles.group} data-testid={`ward-global-search-group-${group.key}`}>
                        <span id={`${listId}-${group.key}-heading`}>
                          {group.key === "tasks" ? tasksWord.many : group.heading}
                        </span>
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
                            See all {tasksWord.many.toLowerCase()}
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
                        const optionBody = (
                          <SearchOptionBody
                            item={item}
                            nameFor={nameFor}
                            taskWord={tasksWord.one}
                            highlight={isStart ? "" : trimmed}
                          />
                        );
                        return (
                          <li
                            key={`${group.key}-${item.kind}-${item.id}`}
                            role="presentation"
                            className={styles.optionItem}
                          >
                            {item.href === "" ? (
                              // A Help answer with nowhere to go opens in Help itself, so it is a
                              // button, never a link to this same page.
                              <button
                                type="button"
                                id={`${id}-opt-${index}`}
                                role="option"
                                aria-selected={resultsCurrent && activeIndex === index}
                                aria-disabled={!resultsCurrent || undefined}
                                tabIndex={-1}
                                onClick={() => {
                                  if (
                                    resultsCurrent &&
                                    accessLifetime !== null &&
                                    recentsLifetimeNow() === accessLifetime
                                  ) {
                                    openedAsHelp(item);
                                  }
                                }}
                                onMouseEnter={() => setHoverIndex(index)}
                                className={styles.option}
                                data-active={(resultsCurrent && activeIndex === index) || undefined}
                                data-previewed={previewIndex === index || undefined}
                                data-testid={`ward-global-search-result-${item.kind}-${item.id}`}
                              >
                                {optionBody}
                              </button>
                            ) : (
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
                                  if (
                                    resultsCurrent &&
                                    accessLifetime !== null &&
                                    recentsLifetimeNow() === accessLifetime
                                  ) {
                                    const plain = !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
                                    if (event.button === 0 && plain && openedAsHelp(item)) {
                                      event.preventDefault();
                                      return;
                                    }
                                    if (event.button === 0 && plain && isPhone && SHEET_KINDS.has(item.kind)) {
                                      event.preventDefault();
                                      setSheetItem(item);
                                      return;
                                    }
                                    onOptionClick(event, item.href);
                                    return;
                                  }
                                  event.preventDefault();
                                  event.stopPropagation();
                                }}
                                onAuxClick={(event) => {
                                  if (
                                    !resultsCurrent ||
                                    accessLifetime === null ||
                                    recentsLifetimeNow() !== accessLifetime
                                  ) {
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
                                {optionBody}
                              </Link>
                            )}
                            {isPhone || previewIndex !== index || !resultsCurrent ? null : (
                              <QuickPatient
                                href={quickPatientHref(item, patients)}
                                canOpenHref={canOpenHref}
                                onClick={onOptionClick}
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {showQuickCommands && !refusal ? (
              <WardSearchCommands
                demoOff={demoOff}
                demoOffId={demoOffId}
                demoOffText={DEMO_CONTROLS_OFF}
                resultsCurrent={resultsCurrent}
                canRunAction={canRunAction}
                canOpenHref={canOpenHref}
                shortcutsExpanded={shortcutsExpanded}
                onToggleShortcuts={() => setShowShortcuts((previous) => !previous)}
                savedHere={myViews.savedHere}
                onToggleSaveView={myViews.toggleHere}
                onAdvanceClock={() => {
                  if (wardFlow)
                    wardFlow.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: now ?? wardFlow.now, minutes: 15 });
                  close();
                }}
                onSwitchDesk={(role, href) => {
                  navigateWithDirtyGuard(() => {
                    if (deskSwitch.shared) {
                      if (deskSwitch.canSwitch) deskSwitch.switchDesk(role, href);
                      return;
                    }
                    deskSwitch.switchDesk(role, href);
                    dispatchPersonaSyncForRole(role, undefined, href);
                    select(href, true);
                  });
                }}
                onHandover={() => select("/ward-flow/handover")}
              />
            ) : null}
          </div>

          {previewItem ? (
            <div
              className={styles.previewPane}
              inert={!resultsCurrent || undefined}
              aria-disabled={!resultsCurrent || undefined}
            >
              <GlobalSearchPreview
                canOpenHref={canOpenHref}
                item={previewItem}
                patients={patients}
                referrals={referrals}
                movements={movements}
                units={units}
                now={now}
                dayZero={wardFlow?.dayZero}
                census={census}
                onOpen={onPreviewOpen}
                help={helpPreview && closingFirst(helpPreview, clearAfterOpen)}
              />
            </div>
          ) : null}
        </div>

        {phoneSheetItem ? (
          <PhoneSheet title={phoneSheetItem.title} inert={!resultsCurrent} onClose={() => setSheetItem(undefined)}>
            <GlobalSearchPreview
              canOpenHref={canOpenHref}
              item={phoneSheetItem}
              patients={patients}
              referrals={referrals}
              movements={movements}
              units={units}
              now={now}
              dayZero={wardFlow?.dayZero}
              census={census}
              onOpen={onPreviewOpen}
            />
          </PhoneSheet>
        ) : null}

        <div className={styles.resultsFooter} data-testid="ward-global-search-footer">
          <WardSearchKeyHints isStart={isStart} />
          {canOpenHref(PATIENT_SEARCH_HREF) ? (
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
          ) : null}
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
          onFocus={() => {
            if (skipOpenOnFocusRef.current) {
              skipOpenOnFocusRef.current = false;
              return;
            }
            setOpen(true);
          }}
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
            onClick={(event) => {
              setQuery("");
              setKindFilter("all");
              close();
              // DR-08: from a keyboard (no pointer, so `detail` is 0) focus goes back to the search
              // control in the bar, closed, rather than to the page body. A tap still blurs, so the
              // phone keyboard goes down.
              if (event.detail === 0) {
                skipOpenOnFocusRef.current = true;
                inputRef.current?.focus();
              } else {
                inputRef.current?.blur();
              }
            }}
          >
            <X className={styles.cancelIcon} width={18} height={18} aria-hidden="true" />
            <span className={styles.cancelText}>Cancel</span>
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
          : !resultsCurrent
            ? "Updating search…"
            : refusal
              ? refusal.sentence
              : trimmed.length === 0
                ? ""
                : resultCount === 0
                  ? (help.note ?? "No matches.")
                  : `${resultCount} invented ${resultCount === 1 ? "result" : "results"} found.`}
      </p>
      {palette && typeof document !== "undefined" ? createPortal(palette, document.body) : null}
    </div>
  );
}

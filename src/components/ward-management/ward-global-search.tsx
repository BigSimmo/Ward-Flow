"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Fragment,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import { refusalFor } from "@/components/ward-management/search/search-refusals";
import {
  CORE_SEARCH_VIEWS,
  searchGroupOrder,
  searchIntentLabel,
  searchWardFlow,
} from "@/components/ward-management/search/ward-smart-search";
import {
  GlobalSearchPreview,
  type GlobalSearchPreviewItem,
} from "@/components/ward-management/search/global-search-preview";
import { StatusGlyph } from "@/components/wf";

import { destinationUnit, stageCopy, type InboxItem } from "@/components/ward-management/ward-derivations";
import { WARD_ADD_PERSON_HREF, WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";
import { movementHref, patientHref } from "@/components/ward-management/shell/ward-facade";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { patientDisplayName, type Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart2,
  BedSingle,
  Building2,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Clock,
  CornerDownLeft,
  FileText,
  Hospital,
  Inbox,
  LayoutDashboard,
  PhoneCall,
  Plus,
  Route,
  Scale,
  Search,
  Settings,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";

import styles from "./ward-global-search.module.css";

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
 * ⚠️ QUEUED REFERRALS ARE DELIBERATELY NOT A THIRD RESULT KIND HERE. `searchPatients` in
 * `ward-derivations.ts` also returns referral hits, and this control could call it — but a
 * referral has no page of its own (`/mockups/ward-flow/referrals` is a board, not a per-record
 * route), so a referral row here would have nowhere honest to send a click. The brief for this
 * control requires every result to carry its record to a real destination; a kind with no
 * destination is not a smaller version of that requirement, it is a different one this file does
 * not attempt. The existing `/mockups/ward-flow/search` console remains the place a referral is
 * found.
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
  /** Booked planned admissions, so search finds the same overdue rows the task count holds. */
  plannedAdmissions?: Parameters<typeof searchWardFlow>[0]["plannedAdmissions"];
  /** The Ward Flow clock, for waits in the preview. Absent means waits are simply not shown. */
  now?: number;
  label?: string;
  placeholder?: string;
};

/**
 * A SHORT LIST, NOT A CATALOGUE. This is chrome that sits above every screen's own content, not a
 * replacement for the dedicated search console — a coordinator wanting the full result set already
 * has `/mockups/ward-flow/search` for that. Applied per kind so a query that matches many movements
 * cannot crowd every person result off the bottom of a short popup.
 */
const MAX_RESULTS_PER_GROUP = 6;

/** The full search console, linked from the palette footer. No query travels in the URL. */
const PATIENT_SEARCH_HREF = "/mockups/ward-flow/search";

function SearchResultIcon({ kind, id }: { kind: string; id?: string }) {
  switch (kind) {
    case "person":
      return <UserRound className={styles.itemIcon} aria-hidden="true" />;
    case "movement":
      return <Route className={styles.itemIcon} aria-hidden="true" />;
    case "ward":
      return <BedSingle className={styles.itemIcon} aria-hidden="true" />;
    case "ed":
      return <Hospital className={styles.itemIcon} aria-hidden="true" />;
    case "community":
      return <Users className={styles.itemIcon} aria-hidden="true" />;
    case "form":
      return <FileText className={styles.itemIcon} aria-hidden="true" />;
    case "task":
      return <CheckSquare className={styles.itemIcon} aria-hidden="true" />;
    case "action":
      return id === "add-patient" ? (
        <UserPlus className={styles.itemIcon} aria-hidden="true" />
      ) : (
        <Plus className={styles.itemIcon} aria-hidden="true" />
      );
    case "view": {
      switch (id) {
        case "delays":
          return <Clock className={styles.itemIcon} aria-hidden="true" />;
        case "movements":
          return <ArrowRightLeft className={styles.itemIcon} aria-hidden="true" />;
        case "handover":
          return <ClipboardList className={styles.itemIcon} aria-hidden="true" />;
        case "capacity":
          return <BedSingle className={styles.itemIcon} aria-hidden="true" />;
        case "escalation":
          return <AlertTriangle className={styles.itemIcon} aria-hidden="true" />;
        case "statistics":
          return <BarChart2 className={styles.itemIcon} aria-hidden="true" />;
        case "on-call":
          return <PhoneCall className={styles.itemIcon} aria-hidden="true" />;
        case "hub":
          return <Building2 className={styles.itemIcon} aria-hidden="true" />;
        case "settings":
          return <Settings className={styles.itemIcon} aria-hidden="true" />;
        case "legal-forms":
          return <Scale className={styles.itemIcon} aria-hidden="true" />;
        case "referrals":
          return <Inbox className={styles.itemIcon} aria-hidden="true" />;
        case "community":
          return <Users className={styles.itemIcon} aria-hidden="true" />;
        default:
          return <LayoutDashboard className={styles.itemIcon} aria-hidden="true" />;
      }
    }
    default:
      return <Search className={styles.itemIcon} aria-hidden="true" />;
  }
}

/*
 * ⚠️ **BOTH HREFS COME FROM THE FACADE NOW, AND THIS FILE BUILDS NEITHER.** Until 2026-09-10 this
 * module held its own `personHref` and `movementHref`, private to it — two builders for two routes
 * that four other files also link to. `shell/ward-facade.ts` is the one place either route is
 * written down, so a route that changes changes once. They take an ID rather than the record, which
 * is why the call sites below read `patientHref(patient.id)` rather than `personHref(patient)`.
 */

type SearchResultItem = GlobalSearchPreviewItem & {
  kindLabel: string;
  umrn?: string;
  dateOfBirth?: string;
  readyBeds?: number;
  siteName?: string;
};

type SearchResultGroup = {
  key: string;
  heading: string;
  items: SearchResultItem[];
};

/**
 * THE KIND CHIPS ALONG THE TOP OF THE PALETTE. "All" keeps the short list per kind; a single kind
 * shows that kind's matches up to `FULL_RESULTS_PER_GROUP`, so a chip is also how someone sees
 * more than six of one thing without leaving the page. Places folds wards, EDs and teams together,
 * the same three groups the engine leads with for a place query.
 */
type KindFilter = "all" | "people" | "movements" | "places" | "forms" | "views" | "tasks";

const KIND_FILTERS: readonly { key: KindFilter; label: string; groups: readonly string[] }[] = [
  { key: "all", label: "All", groups: [] },
  { key: "people", label: "People", groups: ["people"] },
  { key: "movements", label: "Movements", groups: ["movements"] },
  { key: "places", label: "Places", groups: ["wards", "eds", "teams"] },
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
let sessionRecents: SearchResultItem[] = [];

function rememberRecent(item: SearchResultItem) {
  if (item.kind === "action") return;
  sessionRecents = [item, ...sessionRecents.filter((recent) => recent.href !== item.href)].slice(0, RECENT_LIMIT);
}

/** Test seam: recents are module memory, so a suite that asserts the start screen clears them first. */
export function clearGlobalSearchRecents() {
  sessionRecents = [];
}

/** The header's bottom edge, so the scrim and palette start under the bar rather than covering it. */
function headerBottom(root: HTMLElement | null): number {
  if (!root) return 0;
  const bar = root.closest("header") ?? root;
  return Math.max(0, Math.round(bar.getBoundingClientRect().bottom));
}

export function WardGlobalSearch({
  movements,
  patients,
  units,
  tasks,
  plannedAdmissions,
  now,
  scope,
  onNavigate,
  label = "Search",
  placeholder = "Search people and movements…",
}: WardGlobalSearchProps) {
  const id = useId();
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hoverIndex, setHoverIndex] = useState(-1);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [top, setTop] = useState(0);
  const [recentsVersion, setRecentsVersion] = useState(0);

  const trimmed = deferredQuery.trim();
  const isStart = trimmed.length === 0;

  const smartResults = useMemo(
    () =>
      trimmed.length === 0
        ? null
        : searchWardFlow({
            query: trimmed,
            patients,
            movements,
            units,
            now,
            limitPerGroup: FULL_RESULTS_PER_GROUP,
            plannedAdmissions,
          }),
    [trimmed, patients, movements, units, now, plannedAdmissions],
  );

  const refusal = trimmed.length === 0 ? undefined : refusalFor(trimmed);

  /** Every matched group in full (up to the full limit), in the engine's intent order. */
  const allGroups = useMemo(() => {
    if (!smartResults || refusal) return [];
    const g: SearchResultGroup[] = [];

    if (smartResults.people.length > 0) {
      g.push({
        key: "people",
        heading: "People",
        items: smartResults.people.map((p) => ({
          kind: "person",
          kindLabel: "Person",
          id: p.id,
          title: patientDisplayName(p),
          meta: `${p.umrn} · born ${p.dateOfBirth}`,
          umrn: p.umrn,
          dateOfBirth: p.dateOfBirth,
          href: patientHref(p.id),
        })),
      });
    }

    if (smartResults.movements.length > 0) {
      g.push({
        key: "movements",
        heading: "Movements",
        items: smartResults.movements.map((m) => {
          const dest = destinationUnit(m, units);
          // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
          return {
            kind: "movement",
            kindLabel: "Movement",
            id: m.id,
            title: resolveSubjectPatient(m, { patients, movements }).displayName,
            meta: `${m.id} · ${stageCopy[m.stage].label}${dest ? ` · ${dest.name}` : ""}`,
            href: movementHref(m.id),
          };
        }),
      });
    }

    if (smartResults.wards.length > 0) {
      g.push({
        key: "wards",
        heading: "Wards",
        items: smartResults.wards.map((w) => ({
          kind: "ward",
          kindLabel: "Ward",
          id: w.unit.id,
          title: w.unit.name,
          meta: `${w.siteName} · ${w.readyBeds === null ? "ready beds not recorded" : `${w.readyBeds} ready`}`,
          siteName: w.siteName,
          readyBeds: w.readyBeds ?? undefined,
          href: w.href,
        })),
      });
    }

    if (smartResults.emergencyDepartments.length > 0) {
      g.push({
        key: "eds",
        heading: "ED",
        items: smartResults.emergencyDepartments.map((e) => ({
          kind: "ed",
          kindLabel: "ED",
          id: e.ed.id,
          title: `${e.ed.name} (${e.ed.siteCode})`,
          meta: "Emergency Department",
          href: e.href,
        })),
      });
    }

    if (smartResults.communityTeams.length > 0) {
      g.push({
        key: "teams",
        heading: "Community",
        items: smartResults.communityTeams.map((c) => ({
          kind: "community",
          kindLabel: "Community",
          id: c.team.id,
          title: c.team.name,
          meta: "Community Mental Health Team",
          href: c.href,
        })),
      });
    }

    if (smartResults.legalForms.length > 0) {
      g.push({
        key: "forms",
        heading: "Legal",
        items: smartResults.legalForms.map((f) => ({
          kind: "form",
          kindLabel: "Legal Form",
          id: f.form.code.toLowerCase(),
          title: `Form ${f.form.code}`,
          meta: f.title,
          href: f.href,
        })),
      });
    }

    if (smartResults.views.length > 0) {
      g.push({
        key: "views",
        heading: "Screens",
        items: smartResults.views.map((v) => ({
          kind: "view",
          kindLabel: "View",
          id: v.view.key,
          title: v.view.title,
          meta: v.view.description ?? "View",
          href: v.href,
        })),
      });
    }

    if (smartResults.tasks.length > 0) {
      g.push({
        key: "tasks",
        heading: "Tasks",
        items: smartResults.tasks.map((t) => ({
          kind: "task",
          kindLabel: "Task",
          id: t.task.id,
          title: t.task.title,
          meta: t.task.detail,
          href: t.href,
          movementId: t.task.movementId,
          tone: t.task.tone,
        })),
      });
    }

    const order = searchGroupOrder(smartResults.intent, trimmed);
    const position = new Map<string, number>(order.map((key, index) => [key, index]));
    g.sort((left, right) => (position.get(left.key) ?? order.length) - (position.get(right.key) ?? order.length));
    return g;
  }, [smartResults, refusal, trimmed, units, patients, movements]);

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
    void recentsVersion;
    const g: SearchResultGroup[] = [];
    const needs = (tasks ?? []).slice(0, NEEDS_YOU_LIMIT);
    if (needs.length > 0) {
      g.push({
        key: "needs",
        heading: "Needs you now",
        items: needs.map((task) => ({
          kind: "task",
          kindLabel: "Task",
          id: task.id,
          title: task.title,
          meta: task.detail,
          href: task.href ?? movementHref(task.movementId),
          movementId: task.movementId,
          tone: task.tone,
        })),
      });
    }
    if (sessionRecents.length > 0) {
      g.push({ key: "recent", heading: "Recent", items: sessionRecents });
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
  }, [tasks, recentsVersion]);

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

  const showPopup = open && deferredQuery === query;

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
  const previewItem = refusal ? undefined : options[previewIndex];

  /*
   * D1-style fix, same reason `PatientTypeahead` carries it: the list clips with its own scrollbar,
   * and ArrowDown/End can move `activeIndex` to a row that is scrolled out of view.
   * `block: "nearest"` moves the list only as far as it has to.
   */
  useEffect(() => {
    if (!showPopup || activeIndex < 0) return;
    document.getElementById(`${id}-opt-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, showPopup, id]);

  /*
   * THE PALETTE IS PORTALLED TO THE BODY, BECAUSE THE BAR IS GLASS. `backdrop-filter` on the
   * header makes it the containing block for anything fixed inside it, so a fixed palette mounted
   * in place would be clipped to the bar. Its top is measured from the bar's own bottom edge, which
   * also follows the phone bar as it condenses on scroll.
   */
  useEffect(() => {
    if (!showPopup) return;
    const measure = () => setTop(headerBottom(rootRef.current));
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
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

  /*
   * THE ONE SHORTCUT, EVERYWHERE. Matches `universal-search-command-surface.tsx`'s own global
   * shortcut exactly — same keys, same guard against hijacking a keystroke meant for another field
   * — so this is the same habit a coordinator already has from the rest of the app, not a second
   * one to learn for Ward Flow alone.
   */
  useEffect(() => {
    function onWindowKeyDown(event: globalThis.KeyboardEvent) {
      const slashShortcut = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
      const commandShortcut = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey;
      if (!slashShortcut && !commandShortcut) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, []);

  function remember(href: string) {
    const item = options.find((option) => option.href === href);
    if (item) {
      rememberRecent(item);
      setRecentsVersion((version) => version + 1);
    }
  }

  function select(href: string) {
    remember(href);
    close();
    if (onNavigate) onNavigate(href);
    else router.push(href);
  }

  /**
   * Only intercepts when a test has supplied `onNavigate`, and only for the plain click a real
   * anchor would otherwise have handled itself. A modified click (middle button, ctrl/cmd, shift)
   * is left completely alone in every case, real or tested, because that is the browser's own
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
    select(href);
  }

  /** A preview action is a plain link too, with the same modified-click rule as a row. */
  function onPreviewOpen(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (previewItem) {
      rememberRecent(previewItem);
      setRecentsVersion((version) => version + 1);
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
    if (!showPopup || options.length === 0) {
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

  const palette = showPopup ? (
    <>
      <div
        className={styles.scrim}
        style={{ top }}
        aria-hidden="true"
        data-testid="ward-global-search-scrim"
        onMouseDown={() => close()}
      />
      <div
        ref={paletteRef}
        className={styles.popup}
        style={{ top: top + 8 }}
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
                  <span className={styles.kindCount}>{refusal ? 0 : count}</span>
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
                <span className={styles.emptyTitle}>No matches found</span>
                <p className={styles.emptyDescription}>
                  No matches for “{trimmed}”. Nothing here says whether the person or movement exists — only that this
                  did not find one.
                </p>
              </div>
            ) : (
              <ul id={listId} role="listbox" aria-label="Search results" className={styles.list}>
                {groups.map((group) => (
                  <Fragment key={group.key}>
                    <li role="presentation" className={styles.groupItem}>
                      <span className={styles.group} data-testid={`ward-global-search-group-${group.key}`}>
                        <span>{group.heading}</span>
                        {isStart ? null : <span className={styles.groupCount}>{group.items.length}</span>}
                      </span>
                    </li>
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
                            aria-selected={activeIndex === index}
                            tabIndex={-1}
                            onClick={(event) => onOptionClick(event, item.href)}
                            onMouseEnter={() => setHoverIndex(index)}
                            className={styles.option}
                            data-active={activeIndex === index || undefined}
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
                              <span className={styles.resultTitle}>{item.title}</span>
                              <span className={styles.resultMeta}>
                                {item.umrn ? (
                                  <>
                                    <span className={styles.umrn}>{item.umrn}</span>
                                    {item.dateOfBirth ? <span>born {item.dateOfBirth}</span> : null}
                                  </>
                                ) : item.readyBeds !== undefined ? (
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
                  </Fragment>
                ))}
              </ul>
            )}
          </div>

          {previewItem ? (
            <div className={styles.previewPane}>
              <GlobalSearchPreview
                item={previewItem}
                patients={patients}
                movements={movements}
                units={units}
                now={now}
                onOpen={onPreviewOpen}
              />
            </div>
          ) : null}
        </div>

        <div className={styles.resultsFooter} data-testid="ward-global-search-footer">
          <div className={styles.footerHints} aria-hidden="true">
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
            onClick={(event) => onOptionClick(event, PATIENT_SEARCH_HREF)}
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
      // The compact bar lays the open field over itself at the bar's measured height.
      style={top > 0 ? ({ "--wgs-bar-h": `${top}px` } as CSSProperties) : undefined}
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
          enterKeyHint="search"
          spellCheck={false}
          aria-haspopup="listbox"
          aria-controls={showPopup && options.length > 0 ? listId : undefined}
          aria-activedescendant={activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-describedby={hintId}
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
            setHoverIndex(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={(event) => {
            // Tabbing on to the next header control closes the palette, so a keyboard user is never
            // left with a scrim over the page they moved on to.
            const next = event.relatedTarget as Node | null;
            if (next && (rootRef.current?.contains(next) || paletteRef.current?.contains(next))) return;
            if (next) close();
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
        Press <kbd>/</kbd> or <kbd>Ctrl K</kbd> to search from anywhere. <kbd>Esc</kbd> clears.
      </span>
      {/* Announced for a screen-reader user, the same reason `PatientTypeahead` announces its own
          count: the list changes under someone who cannot see it change. */}
      <p className="sr-only" role="status" aria-live="polite">
        {refusal
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

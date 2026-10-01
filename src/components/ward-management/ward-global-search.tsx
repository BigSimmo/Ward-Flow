"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import { searchWardFlow } from "@/components/ward-management/search/ward-smart-search";

import { destinationUnit, stageCopy } from "@/components/ward-management/ward-derivations";
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
  ClipboardList,
  Clock,
  CornerDownLeft,
  FileText,
  Hospital,
  Inbox,
  LayoutDashboard,
  PhoneCall,
  Route,
  Scale,
  Search,
  Settings,
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
 * one Ward Flow screen is the same habit the rest of PsychSift already teaches.
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

type SearchResultItem = {
  kind: string;
  kindLabel: string;
  id: string;
  title: string;
  meta: string;
  href: string;
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

export function WardGlobalSearch({
  movements,
  patients,
  units,
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
  const router = useRouter();

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmed = deferredQuery.trim();

  const smartResults = useMemo(
    () =>
      trimmed.length === 0
        ? null
        : searchWardFlow({
            query: trimmed,
            patients,
            movements,
            units,
            limitPerGroup: MAX_RESULTS_PER_GROUP,
          }),
    [trimmed, patients, movements, units],
  );

  const groups = useMemo(() => {
    if (!smartResults) return [];
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
            meta: `${stageCopy[m.stage].label}${dest ? ` · ${dest.name}` : ""}`,
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
        heading: "Emergency Departments",
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
        heading: "Community Teams",
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
        heading: "Legal Forms",
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
        heading: "Core Views",
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
        heading: "Action Tasks",
        items: smartResults.tasks.map((t) => ({
          kind: "task",
          kindLabel: "Task",
          id: t.task.id,
          title: t.task.title,
          meta: t.task.detail,
          href: t.href,
        })),
      });
    }

    return g;
  }, [smartResults, units, patients, movements]);

  const options = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const showPopup = open && deferredQuery === query && query.trim().length > 0 && trimmed.length > 0;

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
  }

  /*
   * D1-style fix, same reason `PatientTypeahead` carries it: the popup clips at `max-height: 24rem`
   * with its own scrollbar, and ArrowDown/End can move `activeIndex` to a row that is scrolled out
   * of view. `block: "nearest"` moves the popup only as far as it has to.
   */
  useEffect(() => {
    if (!showPopup || activeIndex < 0) return;
    document.getElementById(`${id}-opt-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, showPopup, id]);

  useEffect(() => {
    if (!open) return;
    function onDocumentPointerDown(event: globalThis.MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
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

  function select(href: string) {
    setOpen(false);
    setActiveIndex(-1);
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
    if (!onNavigate) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    select(href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setQuery("");
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!showPopup || options.length === 0) {
      if (event.key === "ArrowDown" && trimmed.length > 0) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? options.length - 1 : current - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (event.key === "Enter") {
      // No active row means nobody has been pointed at yet — Enter belongs to whatever else might
      // want it (a surrounding form), and must never be turned into a navigation nobody chose.
      if (activeIndex >= 0) {
        event.preventDefault();
        select(options[activeIndex].href);
      }
    }
  }

  return (
    <div className={styles.root} ref={rootRef} data-testid="ward-global-search">
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
          spellCheck={false}
          aria-haspopup="listbox"
          aria-controls={showPopup ? listId : undefined}
          aria-activedescendant={activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-describedby={hintId}
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
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
              setOpen(false);
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
          >
            <X className={styles.clearIcon} width={12} height={12} aria-hidden="true" />
            <span className={styles.clearText}>Clear</span>
          </button>
        ) : null}
      </div>

      <span className={styles.guidance} id={hintId}>
        Press <kbd>/</kbd> or <kbd>Ctrl K</kbd> to search from anywhere. <kbd>Esc</kbd> clears.
      </span>

      {/* Announced for a screen-reader user, the same reason `PatientTypeahead` announces its own
          count: the list changes under someone who cannot see it change. */}
      <p className="sr-only" role="status" aria-live="polite">
        {trimmed.length === 0
          ? ""
          : options.length === 0
            ? "No matches."
            : `${options.length} invented ${options.length === 1 ? "result" : "results"} found.`}
      </p>

      {showPopup ? (
        <div className={styles.popup} data-testid="ward-global-search-popup">
          {options.length === 0 ? (
            <div className={styles.empty} data-testid="ward-global-search-empty">
              <Search className={styles.emptyIcon} aria-hidden="true" />
              <span className={styles.emptyTitle}>No matches found</span>
              <p className={styles.emptyDescription}>
                No matches for “{trimmed}”. Nothing here says whether the person or movement exists — only that this did
                not find one.
              </p>
            </div>
          ) : (
            <ul id={listId} role="listbox" aria-label="Search results" className={styles.list}>
              {groups.map((group) => (
                <Fragment key={group.key}>
                  <li role="presentation" className={styles.groupItem}>
                    <span className={styles.group}>
                      <span>{group.heading}</span>
                      <span className={styles.groupCount}>{group.items.length}</span>
                    </span>
                  </li>
                  {group.items.map((item) => {
                    const index = options.indexOf(item);
                    return (
                      <li key={`${item.kind}-${item.id}`} role="presentation" className={styles.optionItem}>
                        <Link
                          id={`${id}-opt-${index}`}
                          role="option"
                          aria-selected={activeIndex === index}
                          href={item.href}
                          onClick={(event) => onOptionClick(event, item.href)}
                          className={`${styles.option}${activeIndex === index ? ` ${styles.optionActive}` : ""}`}
                          data-testid={`ward-global-search-result-${item.kind}-${item.id}`}
                        >
                          <div className={styles.itemIconBox} data-kind={item.kind} aria-hidden="true">
                            <SearchResultIcon kind={item.kind} id={item.id} />
                          </div>

                          <div className={styles.resultContent}>
                            <div className={styles.resultHeader}>
                              <span className={styles.resultTitle}>{item.title}</span>
                              <div className={styles.resultEnd}>
                                <span className={styles.resultKind} data-kind={item.kind}>
                                  {item.kindLabel}
                                </span>
                                <span className={styles.actionHint} aria-hidden="true" title="Press Enter to open">
                                  <CornerDownLeft className={styles.actionHintIcon} aria-hidden="true" />
                                </span>
                              </div>
                            </div>
                            <div className={styles.resultMeta}>
                              {item.umrn ? (
                                <>
                                  <span className={styles.umrnPill}>{item.umrn}</span>
                                  {item.dateOfBirth ? <span>born {item.dateOfBirth}</span> : null}
                                </>
                              ) : item.readyBeds !== undefined ? (
                                <>
                                  <span>{item.siteName}</span>
                                  <span>·</span>
                                  <span className={styles.readyBedsPill} data-available={item.readyBeds > 0}>
                                    {item.readyBeds} ready
                                  </span>
                                </>
                              ) : (
                                <span>{item.meta}</span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </Fragment>
              ))}
            </ul>
          )}

          {/*
           * STANDARD §8.6'S FIXED RESULTS FOOTER, VERBATIM, BOTH HALVES — this is the surface
           * §8.6 governs, so it takes the whole sentence: "Names are invented. Search never
           * returns a risk score, an acuity score or a best match." Shown every time the popup is
           * shown, matched or empty — the empty state is exactly where the "nobody matches" claim
           * most needs a marker beside it, not less.
           *
           * §8.3's page-level markers (the bar's prototype tooltip, the rail foot) are both VISUAL
           * and both OUTSIDE this popup, so neither stands in for a marker inside it — that gap is
           * the reason this footer exists rather than a reason to skip it (BRIEF-AV-search-marker.md).
           */}
          {/*
           * ⚠️ THE TWO `<span>`S SIT ON ONE JSX LINE, SEPARATED BY A LITERAL SPACE, NOT TWO. JSX
           * strips a run of whitespace between elements when it contains a newline, so writing
           * these on separate lines (as the flex layout alone would suggest) renders the two
           * halves with NO space between them — "invented.Search" — which is not the verbatim
           * sentence §8.6 requires. Kept on one line so the source itself carries the fix rather
           * than relying on a reader to remember it.
           */}
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
              <span className={styles.hintItem}>
                <kbd className={styles.hintKbd}>Esc</kbd>
                <span className={styles.hintLabel}>Dismiss</span>
              </span>
            </div>
            <p className={styles.footerDisclaimer}>
              <span>Names are invented.</span>{" "}
              <span>Search never returns a risk score, an acuity score or a best match.</span>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Fragment,
  useContext,
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
import { CHROME_ROLE_LABELS, wardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { WardFlowContext } from "@/components/ward-management/ward-flow-provider";

export type WardChromeSearchProps = {
  movements?: Movement[];
  patients?: readonly Patient[];
  units?: Unit[];
  scope?: ReactNode;
  onNavigate?: (href: string) => void;
  label?: string;
  placeholder?: string;
};

const MAX_RESULTS_PER_GROUP = 6;

type SearchResultItem = {
  kind: string;
  kindLabel: string;
  id: string;
  title: string;
  meta: string;
  umrn?: string;
  dateOfBirth?: string;
  readyBeds?: number;
  href: string;
};

type SearchResultGroup = {
  key: string;
  heading: string;
  items: SearchResultItem[];
};

/**
 * **WARD CHROME SEARCH — elevated patient search flyout with ARIA combobox attributes.**
 *
 * Provides:
 * - ARIA combobox pattern (role="combobox", aria-expanded, aria-controls, aria-autocomplete="list")
 * - High-contrast dark theme background and crisp borders via semantic design tokens
 * - Tabular UMRNs and bed numbers with font-variant-numeric: tabular-nums
 * - Smooth keyboard navigation (ArrowUp, ArrowDown, Esc, Enter, Home, End, /, Ctrl/Cmd+K)
 * - 48px minimum tap targets on all result items and the clear button
 * - Zero raw hex codes or bare rgb/rgba colors
 */
export function WardChromeSearch({
  movements: propsMovements,
  patients: propsPatients,
  units: propsUnits,
  scope: propsScope,
  onNavigate,
  label = "Search",
  placeholder = "Search a patient, bed, ward, form or task",
}: WardChromeSearchProps = {}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const context = useContext(WardFlowContext);

  // Memoised so the empty-array fallback keeps one identity across renders (the search memos below
  // depend on these).
  const movements = useMemo(() => propsMovements ?? context?.movements ?? [], [propsMovements, context?.movements]);
  const patients = useMemo(() => propsPatients ?? context?.patients ?? [], [propsPatients, context?.patients]);
  const units = useMemo(() => propsUnits ?? context?.units ?? [], [propsUnits, context?.units]);

  const role = wardChromeRole(pathname);
  const scope = propsScope ?? CHROME_ROLE_LABELS[role];

  const id = useId();
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmed = query.trim();

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
            plannedAdmissions: context?.plannedAdmissions,
          }),
    [trimmed, patients, movements, units, context?.plannedAdmissions],
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
          return {
            kind: "movement",
            kindLabel: "Movement",
            id: m.id,
            title: m.id,
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
        })),
      });
    }

    return g;
  }, [smartResults, units]);

  const options = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const showPopup = open && trimmed.length > 0;

  const optionsKey = useMemo(() => options.map((option) => option.href).join("|"), [options]);
  const [seenOptionsKey, setSeenOptionsKey] = useState(optionsKey);
  if (optionsKey !== seenOptionsKey) {
    setSeenOptionsKey(optionsKey);
    setActiveIndex(-1);
  }

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
      if (activeIndex >= 0) {
        event.preventDefault();
        select(options[activeIndex].href);
      }
    }
  }

  return (
    <div
      ref={rootRef}
      data-testid="ward-chrome-search"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: "100%",
        maxWidth: "28rem",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {scope ? (
        <span
          data-testid="ward-chrome-search-scope"
          style={{
            marginRight: "0.5rem",
            padding: "0.25rem 0.5rem",
            borderRadius: "var(--radius-sm, 0.25rem)",
            background: "var(--surface)",
            color: "var(--ink-soft, var(--muted))",
            fontSize: "var(--text-3xs, 0.6875rem)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            border: "1px solid var(--line-strong, var(--line))",
            whiteSpace: "nowrap",
          }}
        >
          {scope}
        </span>
      ) : null}

      <label htmlFor={id} className="sr-only">
        {label}
      </label>

      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          width: "100%",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 20 20"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "0.75rem",
            pointerEvents: "none",
            color: "var(--ink-soft, var(--muted))",
          }}
        >
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12.8 12.8 17 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>

        <input
          id={id}
          ref={inputRef}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-expanded={showPopup}
          aria-controls={showPopup ? listId : undefined}
          aria-activedescendant={activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-describedby={hintId}
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          data-testid="ward-chrome-search-input"
          style={{
            minHeight: "var(--ward-tap, 48px)",
            width: "100%",
            borderRadius: "var(--radius-md, 0.375rem)",
            border: "1px solid var(--line-strong, var(--line))",
            background: "var(--surface)",
            color: "var(--ink)",
            paddingLeft: "2.25rem",
            paddingRight: query.length > 0 ? "3.25rem" : "2.25rem",
            fontSize: "0.875rem",
            fontVariantNumeric: "tabular-nums",
            outline: "none",
          }}
        />

        {query.length === 0 ? (
          <kbd
            aria-hidden="true"
            data-ward-search-shortcut
            style={{
              position: "absolute",
              right: "0.75rem",
              padding: "0.125rem 0.375rem",
              fontSize: "0.75rem",
              borderRadius: "var(--radius-sm, 0.25rem)",
              border: "1px solid var(--line)",
              color: "var(--ink-soft, var(--muted))",
              background: "var(--surface)",
              pointerEvents: "none",
            }}
          >
            /
          </kbd>
        ) : null}

        {query.length > 0 ? (
          <button
            type="button"
            data-testid="ward-chrome-search-clear"
            onClick={() => {
              setQuery("");
              setOpen(false);
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
            style={{
              position: "absolute",
              right: "0.25rem",
              minHeight: "var(--ward-tap, 48px)",
              minWidth: "var(--ward-tap, 48px)",
              padding: "0 0.5rem",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              color: "var(--ink-soft, var(--muted))",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      <span className="sr-only" id={hintId}>
        Press / or Ctrl K to search from anywhere. Esc clears.
      </span>

      <p className="sr-only" role="status" aria-live="polite">
        {trimmed.length === 0 ? "" : options.length === 0 ? "No matches." : `${options.length} invented results found.`}
      </p>

      {showPopup ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          data-testid="ward-chrome-search-popup"
          style={{
            position: "absolute",
            top: "calc(100% + 0.375rem)",
            left: 0,
            right: 0,
            minWidth: "22rem",
            maxWidth: "34rem",
            maxHeight: "26rem",
            overflowY: "auto",
            borderRadius: "var(--radius-md, 0.5rem)",
            border: "1px solid var(--line-strong)",
            background: "var(--surface)",
            color: "var(--ink)",
            boxShadow: "0 10px 25px var(--scrim, var(--lift))",
            zIndex: 100,
            padding: "0.5rem 0",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {options.length === 0 ? (
            <p
              data-testid="ward-chrome-search-empty"
              style={{
                margin: 0,
                padding: "1rem 1.25rem",
                color: "var(--ink-soft, var(--muted))",
                fontSize: "0.875rem",
                lineHeight: 1.4,
              }}
            >
              No matches for “{trimmed}”. Nothing here says whether the person or record exists — only that this search
              did not find one.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {groups.map((group) => (
                <Fragment key={group.key}>
                  <div
                    role="presentation"
                    style={{
                      padding: "0.5rem 1rem 0.25rem",
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "var(--ink-soft, var(--muted))",
                      borderTop: group.key !== groups[0].key ? "1px solid var(--line)" : "none",
                    }}
                  >
                    {group.heading}
                  </div>
                  {group.items.map((item) => {
                    const index = options.indexOf(item);
                    const isActive = activeIndex === index;
                    return (
                      <Link
                        key={`${item.kind}-${item.id}`}
                        id={`${id}-opt-${index}`}
                        role="option"
                        aria-selected={isActive}
                        href={item.href}
                        onClick={(event) => onOptionClick(event, item.href)}
                        data-testid={`ward-chrome-search-result-${item.kind}-${item.id}`}
                        style={{
                          minHeight: "var(--ward-tap, 48px)",
                          minWidth: "var(--ward-tap, 48px)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.5rem 1rem",
                          textDecoration: "none",
                          color: "var(--ink)",
                          background: isActive ? "var(--surface-subtle, var(--lift))" : "transparent",
                          outline: "none",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                          <span
                            style={{
                              fontSize: "0.875rem",
                              fontWeight: 600,
                              color: "var(--ink)",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {item.title}
                          </span>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--ink-soft, var(--muted))",
                              fontVariantNumeric: "tabular-nums",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.umrn ? (
                              <>
                                <span style={{ fontVariantNumeric: "tabular-nums" }}>{item.umrn}</span>
                                {item.dateOfBirth ? (
                                  <>
                                    {" "}
                                    · born{" "}
                                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{item.dateOfBirth}</span>
                                  </>
                                ) : null}
                              </>
                            ) : item.readyBeds !== undefined ? (
                              <>
                                <span style={{ fontVariantNumeric: "tabular-nums" }}>{item.readyBeds}</span> ready
                              </>
                            ) : (
                              item.meta
                            )}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: "0.6875rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            padding: "0.125rem 0.375rem",
                            borderRadius: "var(--radius-sm, 0.25rem)",
                            border: "1px solid var(--line)",
                            color: "var(--ink-soft, var(--muted))",
                            background: "var(--surface)",
                            marginLeft: "0.5rem",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.kindLabel}
                        </span>
                      </Link>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          )}

          <p
            data-testid="ward-chrome-search-footer"
            style={{
              margin: "0.5rem 0 0",
              padding: "0.5rem 1rem 0.25rem",
              borderTop: "1px solid var(--line)",
              fontSize: "0.6875rem",
              color: "var(--ink-soft, var(--muted))",
              lineHeight: 1.35,
            }}
          >
            <span>Names are invented.</span>{" "}
            <span>Search never returns a risk score, an acuity score or a best match.</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

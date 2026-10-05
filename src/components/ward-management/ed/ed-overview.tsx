"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Hospital, Plus, Search } from "lucide-react";
import styles from "./ed-overview.module.css";

export type EdOverviewDepartment = {
  id: string;
  name: string;
  code: string;
  service: string;
  waiting: number;
  longest: string;
  breaches: number;
};

type Props = {
  departmentId: string;
  departments: EdOverviewDepartment[];
  figures: { label: string; value: string | number }[];
  onRaiseReferral: () => void;
  referralOpen?: boolean;
};

const serviceNames: Record<string, string> = {
  "East Metro": "EMHS",
  "North Metro": "NMHS",
  "South Metro": "SMHS",
  "Children's": "CAHS",
  "Child and Adolescent": "CAHS",
};
const shortName = (name: string) => name.replace(/ Emergency Department$/, "");

export function EdOverview({ departmentId, departments, figures, onRaiseReferral, referralOpen = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showFigures, setShowFigures] = useState(true);
  const [query, setQuery] = useState("");
  const [service, setService] = useState("all");
  const [canScroll, setCanScroll] = useState({ left: false, right: false });
  const rail = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const currentIndex = departments.findIndex((department) => department.id === departmentId);
  const current = departments[currentIndex];
  const previous = departments[(currentIndex - 1 + departments.length) % departments.length];
  const next = departments[(currentIndex + 1) % departments.length];
  const filtered = departments.filter(
    (department) =>
      (service === "all" || department.service === service) &&
      `${department.name} ${department.code}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function updateScroll() {
    const element = rail.current;
    if (element)
      setCanScroll({
        left: element.scrollLeft > 2,
        right: element.scrollLeft + element.clientWidth < element.scrollWidth - 2,
      });
  }

  useEffect(() => {
    if (!expanded || !rail.current) return;
    updateScroll();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(updateScroll);
    observer?.observe(rail.current);
    return () => observer?.disconnect();
  }, [expanded, query, service]);

  function scroll(direction: number) {
    const element = rail.current;
    if (!element) return;
    element.scrollBy({
      left: direction * Math.max(element.clientWidth * 0.75, 210),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  if (!current || !previous || !next) return null;

  return (
    <section
      className={styles.overview}
      aria-label="Emergency department overview"
      data-testid={`ward-ed-card-${departmentId}`}
    >
      <div className={styles.heading}>
        <div className={styles.identity}>
          <span className={styles.monogram} aria-hidden="true">
            {current.code}
          </span>
          <div>
            <div className={styles.titleLine}>
              <h1>{shortName(current.name)}</h1>
              <span className={styles.serviceTag}>{current.service}</span>
            </div>
            <p>
              Emergency department · Psychiatry <span>· Synthetic data</span>
            </p>
          </div>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.raise}
            data-testid="ward-ed-raise-referral-toggle"
            aria-expanded={referralOpen}
            aria-controls="ward-ed-referral-intake"
            onClick={onRaiseReferral}
          >
            <Plus aria-hidden="true" />
            Raise referral
          </button>
          <button
            type="button"
            className={styles.figuresToggle}
            aria-pressed={showFigures}
            aria-controls="ward-ed-figures"
            onClick={() => setShowFigures((shown) => !shown)}
          >
            Figures <span className={styles.switch} aria-hidden="true" />
          </button>
          <div className={styles.adjacent} role="group" aria-label="Switch department">
            <Link
              href={`/mockups/ward-flow/ed/${previous.id}`}
              aria-label={`Previous department: ${previous.name}`}
              title="Previous ED"
            >
              <ChevronLeft aria-hidden="true" />
            </Link>
            <Link
              href={`/mockups/ward-flow/ed/${next.id}`}
              aria-label={`Next department: ${next.name}`}
              title="Next ED"
            >
              <ChevronRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
      <dl
        id="ward-ed-figures"
        className={styles.figures}
        hidden={!showFigures}
        aria-label="Selected department record counts"
      >
        {figures.map((figure) => (
          <div key={figure.label}>
            <dt>{figure.label}</dt>
            <dd>{figure.value}</dd>
          </div>
        ))}
      </dl>
      <button
        ref={trigger}
        type="button"
        className={styles.otherToggle}
        aria-expanded={expanded}
        aria-controls="edNetworkDrawer"
        onClick={() => setExpanded((open) => !open)}
      >
        <span>
          <Hospital aria-hidden="true" />
          <strong>Other EDs</strong>
          <span>{Math.max(departments.length - 1, 0)} departments</span>
        </span>
        <span>
          {expanded ? "Close" : "Browse"}
          <ChevronDown aria-hidden="true" />
        </span>
      </button>
      {expanded && (
        <section
          id="edNetworkDrawer"
          className={styles.browser}
          aria-label="Browse emergency departments"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setExpanded(false);
              trigger.current?.focus();
            }
          }}
        >
          <div className={styles.tools}>
            <label className={styles.search}>
              <Search aria-hidden="true" />
              <input
                type="search"
                aria-label="Find an emergency department"
                placeholder="Find an ED…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <select aria-label="Health service" value={service} onChange={(event) => setService(event.target.value)}>
              <option value="all">All services</option>
              {[...new Set(departments.map((department) => department.service))].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <span className={styles.results} role="status">
              {query || service !== "all"
                ? `${filtered.length} of ${departments.length} EDs`
                : `${departments.length} EDs`}
              <span className="sr-only"> · Synthetic data</span>
            </span>
            <div className={styles.scrollControls} role="group" aria-label="Scroll departments">
              <button
                type="button"
                disabled={!canScroll.left}
                aria-label="Scroll departments left"
                onClick={() => scroll(-1)}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={!canScroll.right}
                aria-label="Scroll departments right"
                onClick={() => scroll(1)}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>
          <div
            ref={rail}
            className={styles.rail}
            tabIndex={0}
            onScroll={updateScroll}
            aria-label="Emergency departments, scroll horizontally"
          >
            {filtered.map((department) => (
              <Link
                key={department.id}
                href={`/mockups/ward-flow/ed/${department.id}`}
                className={styles.card}
                data-ed={department.id}
                data-current={department.id === departmentId ? "true" : undefined}
                aria-current={department.id === departmentId ? "page" : undefined}
              >
                <span className={styles.cardTop}>
                  <strong>{department.code}</strong>
                  <span title={department.service}>{serviceNames[department.service] ?? department.service}</span>
                </span>
                <span className={styles.cardName}>{shortName(department.name)}</span>
                <span className={styles.cardMetrics}>
                  <span>
                    <b>{department.waiting}</b>
                    <small>{department.waiting ? "waiting" : "on list"}</small>
                  </span>
                  <span>
                    <small>Longest</small>
                    <strong>{department.longest}</strong>
                  </span>
                </span>
                {(department.id === departmentId || department.breaches > 0) && (
                  <span className={styles.cardStatus}>
                    {department.id === departmentId && (
                      <span>
                        <Check aria-hidden="true" />
                        Current ED
                      </span>
                    )}
                    {department.breaches > 0 && (
                      <span className={styles.warning}>△ {department.breaches} over target</span>
                    )}
                  </span>
                )}
              </Link>
            ))}
            {filtered.length === 0 && (
              <p className={styles.empty}>No departments match. Try another name or service.</p>
            )}
          </div>
        </section>
      )}
    </section>
  );
}

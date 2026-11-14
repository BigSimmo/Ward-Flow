"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { Button, StatusGlyph } from "@/components/wf";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { ED_SEVERE_PRESSURE_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";

import {
  HANDOVER_GROUPS,
  type ClinicalFact,
  type EdClinicalRow,
  type WardClinicalRow,
} from "./tv-clinical-derivations";
import { SAMPLE_OBSERVATION_MIX_LABEL } from "@/components/ward-management/ward-sample-choices";
import styles from "./tv-clinical.module.css";

/**
 * THE CLINICAL TV BOARDS (Josh, 4 Nov 2026: "a ward screen for ward handovers and for staff to see
 * all the useful patient details ... and a handover version. Also a version for ED with a patient
 * progress list"). Read only. Each board shows one page of rows and turns the page on its own, so a
 * wall screen never scrolls and its text never shrinks to fit. Every tone also says itself in words.
 */

/** How long a page stays up before the board turns it (Q5, 4 Nov 2026). */
const TV_PAGE_SECONDS = 20;

/**
 * True when the system or the Ward accessibility setting asks for reduced motion
 * (`data-reduced-motion` on the root, set by ward-accessibility.tsx). The board then never turns
 * its own pages; Next page still does.
 */
function motionReduced(): boolean {
  if (typeof window === "undefined") return false;
  return (
    document.documentElement.hasAttribute("data-reduced-motion") ||
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  );
}

type Paging = {
  page: number;
  pages: number;
  perPage: number;
  /** The viewer pressed Pause. Hover and focus inside the board hold the page without this. */
  paused: boolean;
  /** Reduced motion is asked for, so the board never turns on its own. */
  still: boolean;
  togglePaused: () => void;
  next: () => void;
};

/**
 * One page of rows that fits the screen. It starts at `most` rows and drops one at a time while the
 * list runs past its own box, so a long name or a wrapped form line
 * moves a row to the next page instead of off the bottom. A resize starts again from `most`.
 * The page turns every TV_PAGE_SECONDS unless the viewer paused it, the pointer or focus is inside
 * the board, or reduced motion is asked for (WCAG 2.2.2).
 */
function usePage(target: RefObject<HTMLElement | null>, count: number, most: number): Paging {
  const [perPage, setPerPage] = useState(most);
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);
  const held = useRef(false);
  const pages = Math.max(1, Math.ceil(count / perPage));
  useLayoutEffect(() => {
    const element = target.current;
    if (!element || perPage <= 3) return;
    // The clinical screen is exactly one window tall (bed-meeting-tv.module.css), so the list's
    // own box is the space a page has. Measured after layout, one row at a time.
    const frame = window.requestAnimationFrame(() => {
      if (element.scrollHeight > element.clientHeight + 1) setPerPage((current) => Math.max(3, current - 1));
    });
    return () => window.cancelAnimationFrame(frame);
  });
  useEffect(() => {
    const reset = () => setPerPage(most);
    window.addEventListener("resize", reset);
    return () => window.removeEventListener("resize", reset);
  }, [most]);
  useEffect(() => {
    const read = () => setStill(motionReduced());
    read();
    const query =
      typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    query?.addEventListener?.("change", read);
    const watcher = typeof MutationObserver === "function" ? new MutationObserver(read) : null;
    watcher?.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduced-motion"] });
    return () => {
      query?.removeEventListener?.("change", read);
      watcher?.disconnect();
    };
  }, []);
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    let hovered = false;
    let focused = false;
    const sync = () => {
      held.current = hovered || focused;
    };
    const enter = () => ((hovered = true), sync());
    const leave = () => ((hovered = false), sync());
    const focusIn = () => ((focused = true), sync());
    const focusOut = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Node && element.contains(event.relatedTarget))) focused = false;
      sync();
    };
    element.addEventListener("mouseenter", enter);
    element.addEventListener("mouseleave", leave);
    element.addEventListener("focusin", focusIn);
    element.addEventListener("focusout", focusOut);
    return () => {
      element.removeEventListener("mouseenter", enter);
      element.removeEventListener("mouseleave", leave);
      element.removeEventListener("focusin", focusIn);
      element.removeEventListener("focusout", focusOut);
      held.current = false;
    };
  }, [target]);
  useEffect(() => {
    if (pages <= 1 || paused || still) return;
    const timer = window.setInterval(() => {
      if (held.current) return;
      setPage((current) => (current + 1) % pages);
    }, TV_PAGE_SECONDS * 1000);
    return () => window.clearInterval(timer);
  }, [pages, paused, still]);
  return {
    page: page % pages,
    pages,
    perPage,
    paused,
    still,
    togglePaused: () => setPaused((current) => !current),
    next: () => setPage((current) => ((current % pages) + 1) % pages),
  };
}

function PageMark({ paging, noun }: { paging: Paging; noun: string }) {
  const { page, pages, paused, still, togglePaused, next } = paging;
  if (pages <= 1) return null;
  return (
    <div className={styles.pageMark} data-testid="tv-clinical-page">
      <span>
        Page {page + 1} of {pages}, {noun}
      </span>
      <span className={styles.pageControls}>
        {still ? null : (
          <Button size="sm" variant="ghost" onClick={togglePaused}>
            {paused ? "Resume" : "Pause"}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={next}>
          Next page
        </Button>
        <span className={styles.dots} aria-hidden="true">
          {Array.from({ length: pages }, (_, index) => (
            <i key={index} data-on={index === page || undefined} />
          ))}
        </span>
      </span>
    </div>
  );
}

export function Fact({ fact, empty = "" }: { fact: ClinicalFact | null; empty?: string }) {
  if (!fact) return <span className={styles.quiet}>{empty}</span>;
  return (
    <span className={styles.fact} data-tone={fact.tone}>
      {fact.tone ? <StatusGlyph tone={fact.tone} size={12} /> : null}
      {fact.text}
    </span>
  );
}

function Risks({ risks }: { risks: string[] }) {
  if (risks.length === 0) return <span className={styles.quiet}>None recorded</span>;
  return (
    <span className={styles.risks}>
      {risks.map((risk) => (
        <span key={risk} className={styles.risk}>
          {risk}
        </span>
      ))}
    </span>
  );
}

export function Summary({
  items,
}: {
  items: { label: string; value: number; tone?: "danger" | "warning"; note?: string }[];
}) {
  return (
    <ul className={styles.summary} aria-label="At a glance">
      {items.map((item) => (
        <li
          key={item.label}
          data-tone={item.value > 0 ? item.tone : undefined}
          data-zero={item.value === 0 ? "" : undefined}
        >
          <b>{item.value}</b>
          {item.label}
          {item.note ? (
            <small className={styles.summaryNote} data-testid="tv-summary-note">
              {item.note}
            </small>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

const WHERE_WORD: Record<WardClinicalRow["where"], string> = {
  ward: "On the ward",
  leave: "On leave",
  awol: "Absent without leave",
  incoming: "Coming in",
  ed: "At an ED",
};

/* --------------------------------------------------------------------------------------------- *
 * Ward clinical board: every bed, one row each.
 * --------------------------------------------------------------------------------------------- */

const WARD_ROWS_MOST = 14;

export function WardClinicalTvView({ rows, footer }: { rows: WardClinicalRow[]; footer: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const paging = usePage(ref, rows.length, WARD_ROWS_MOST);
  const { page, perPage } = paging;
  const shown = rows.slice(page * perPage, (page + 1) * perPage);
  const count = (test: (row: WardClinicalRow) => boolean) => rows.filter(test).length;
  return (
    <>
      <Summary
        items={[
          { label: "patients", value: rows.filter((row) => row.where !== "incoming").length },
          {
            label: "on constant obs",
            value: count((row) => row.constantObs),
            tone: "warning",
            // Review question 8 (D-189 item 2): the sample day's observation levels, labelled as on the ward page.
            note: SAMPLE_OBSERVATION_MIX_LABEL,
          },
          { label: "on leave", value: count((row) => row.where === "leave") },
          { label: "absent without leave", value: count((row) => row.where === "awol"), tone: "danger" },
          // D-210 (Josh, 14 Nov 2026), ruling 3: only the amber rows, Ending soon in the Settings soon warning.
          { label: "forms ending soon", value: count((row) => row.legal?.tone === "warning"), tone: "warning" },
          { label: "coming in", value: count((row) => row.where === "incoming") },
          { label: "home today", value: count((row) => row.goingToday) },
        ]}
      />
      <section ref={ref} className={styles.board} aria-label="Every bed" data-testid="ward-clinical-board">
        {rows.length === 0 ? (
          <p className={styles.empty}>Nobody is in a bed on this ward</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Bed</th>
                <th scope="col">Patient</th>
                <th scope="col">Obs</th>
                <th scope="col">Risk flags</th>
                <th scope="col">Legal</th>
                <th scope="col">Where and plan</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.key} data-where={row.where} data-testid="ward-clinical-row">
                  <td className={styles.bed}>{row.bed}</td>
                  <td>
                    <span className={styles.name}>{row.name}</span>{" "}
                    <span className={styles.day}>
                      {row.dayNumber === null ? WHERE_WORD[row.where] : `Day ${row.dayNumber}`}
                      {row.arrivedToday && row.where !== "incoming" ? ", arrived today" : ""}
                    </span>
                  </td>
                  <td>
                    <Fact fact={row.obs} />
                  </td>
                  <td>
                    <Risks risks={row.risks} />
                  </td>
                  <td>
                    <Fact fact={row.legal} empty="Not recorded" />
                  </td>
                  <td>
                    {row.whereabouts ? <Fact fact={row.whereabouts} /> : null}
                    {row.plan ? (
                      <span className={styles.plan}>
                        <Fact fact={row.plan} />
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <PageMark paging={paging} noun="beds by number" />
      </section>
      {footer}
    </>
  );
}

/* --------------------------------------------------------------------------------------------- *
 * Ward handover board: what needs the next shift, then every bed in short.
 * --------------------------------------------------------------------------------------------- */

const HANDOVER_ROWS_MOST = 20;

export function WardHandoverTvView({ rows, footer }: { rows: WardClinicalRow[]; footer: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const paging = usePage(ref, rows.length, HANDOVER_ROWS_MOST);
  const { page, perPage } = paging;
  const shown = rows.slice(page * perPage, (page + 1) * perPage);
  const groups = HANDOVER_GROUPS.map((group) => ({
    ...group,
    items: rows.flatMap((row) =>
      row.attention
        .filter((item) => item.group === group.id)
        .map((item) => ({ ...item, key: `${row.key}-${group.id}`, bed: row.bed, name: row.name })),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <div className={styles.handover}>
        <section
          className={styles.attention}
          aria-labelledby="tv-handover-attention"
          data-testid="ward-handover-attention"
        >
          <h2 id="tv-handover-attention" className={styles.paneTitle}>
            Needs attention this shift
          </h2>
          {groups.length === 0 ? (
            <p className={styles.empty}>Nothing flagged for this shift</p>
          ) : (
            <div className={styles.groups}>
              {groups.map((group) => (
                <section key={group.id} className={styles.group} aria-label={group.title} data-group={group.id}>
                  <h3>
                    {group.title} <span className={styles.groupCount}>{group.items.length}</span>
                  </h3>
                  <ol>
                    {group.items.slice(0, 4).map((item) => (
                      <li key={item.key}>
                        <span className={styles.groupBed}>{item.bed}</span>
                        <span className={styles.groupWho}>{item.name}</span>
                        <span className={styles.groupWhat}>
                          <Fact fact={{ text: item.text, tone: item.tone }} />
                        </span>
                      </li>
                    ))}
                  </ol>
                  {group.items.length > 4 ? <p className={styles.more}>and {group.items.length - 4} more</p> : null}
                </section>
              ))}
            </div>
          )}
        </section>
        <section
          ref={ref}
          className={styles.everyBed}
          aria-labelledby="tv-handover-beds"
          data-testid="ward-handover-beds"
        >
          <h2 id="tv-handover-beds" className={styles.paneTitle}>
            Every bed
          </h2>
          <ol className={styles.compact}>
            {shown.map((row) => (
              <li key={row.key} data-where={row.where}>
                <span className={styles.groupBed}>{row.bed}</span>
                <span className={styles.groupWho}>{row.name}</span>
                <span className={styles.compactNote}>
                  {row.where === "ward" ? row.obs.text.replace(/, .*$/, "") : WHERE_WORD[row.where]}
                </span>
              </li>
            ))}
          </ol>
          <PageMark paging={paging} noun="beds" />
        </section>
      </div>
      {footer}
    </>
  );
}

/* --------------------------------------------------------------------------------------------- *
 * ED clinical board: the ED handover table, made for a wall.
 * --------------------------------------------------------------------------------------------- */

const ED_ROWS_MOST = 10;

export function EdClinicalTvView({
  rows,
  accessTargetMinutes,
  footer,
}: {
  rows: EdClinicalRow[];
  accessTargetMinutes: number;
  footer: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const paging = usePage(ref, rows.length, ED_ROWS_MOST);
  const { page, perPage } = paging;
  const shown = rows.slice(page * perPage, (page + 1) * perPage);
  const targetHours = Math.round(accessTargetMinutes / 60);
  const bandTitle: Record<EdClinicalRow["band"], string> = {
    over: `Over ${targetHours} hours, past the access target`,
    eight: `${ED_SEVERE_PRESSURE_WAIT_MINUTES / 60} to ${targetHours} hours`,
    under: `Under ${ED_SEVERE_PRESSURE_WAIT_MINUTES / 60} hours`,
  };
  const body: ReactNode[] = [];
  shown.forEach((row, index) => {
    if (index === 0 || shown[index - 1].band !== row.band) {
      const inBand = rows.filter((candidate) => candidate.band === row.band).length;
      body.push(
        <tr key={`band-${row.band}`} className={styles.band} data-band={row.band}>
          <th colSpan={7} scope="rowgroup">
            {row.band === "under" ? null : <StatusGlyph tone={row.band === "over" ? "danger" : "warning"} size={12} />}
            {bandTitle[row.band]} <span className={styles.groupCount}>{inBand}</span>
          </th>
        </tr>,
      );
    }
    body.push(
      <tr key={row.id} data-band={row.band} data-testid="ed-clinical-row">
        <td>
          <span className={styles.name}>{row.name}</span>
          <span className={styles.meta}>Urgency {row.urgency}</span>
        </td>
        <td className={styles.wait}>{splitDuration(row.waitMinutes)}</td>
        <td className={styles.bed}>{row.bay || "Not recorded"}</td>
        <td>
          <Fact fact={row.legal} empty="Not recorded" />
        </td>
        <td>
          <Fact fact={row.obs} />
          {row.risks.length > 0 ? (
            <span className={styles.plan}>
              <Risks risks={row.risks} />
            </span>
          ) : null}
        </td>
        <td>
          {row.checks.map((check) => (
            <span key={check.text} className={styles.line}>
              <Fact fact={check} />
            </span>
          ))}
        </td>
        <td>
          <span className={styles.line}>
            <Fact fact={row.referral} />
          </span>
          <span className={styles.next}>
            <Fact fact={row.next} />
          </span>
        </td>
      </tr>,
    );
  });

  return (
    <>
      <Summary
        items={[
          { label: "waiting", value: rows.length },
          {
            label: `past ${targetHours} hours`,
            value: rows.filter((row) => row.band === "over").length,
            tone: "danger",
          },
          { label: "under a form", value: rows.filter((row) => row.underForm).length },
          { label: "not yet reviewed", value: rows.filter((row) => !row.reviewed).length },
          { label: "no bed yet", value: rows.filter((row) => row.noBedYet).length },
        ]}
      />
      <section ref={ref} className={styles.board} aria-label="Patient progress" data-testid="ed-clinical-board">
        {rows.length === 0 ? (
          <p className={styles.empty}>Nobody waiting for a mental health bed</p>
        ) : (
          <table className={styles.table} data-kind="ed">
            <thead>
              <tr>
                <th scope="col">Patient</th>
                <th scope="col">In ED</th>
                <th scope="col">Bay</th>
                <th scope="col">Legal</th>
                <th scope="col">Obs and risk</th>
                <th scope="col">Checks</th>
                <th scope="col">Referral and next</th>
              </tr>
            </thead>
            <tbody>{body}</tbody>
          </table>
        )}
        <PageMark paging={paging} noun="longest in ED first" />
      </section>
      {footer}
    </>
  );
}

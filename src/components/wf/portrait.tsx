"use client";

import { ChevronRight, PanelRightOpen } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "./button";
import { cx } from "./cx";
import { PhoneSheet } from "./phone";
import { StatusGlyph, type WfTone } from "./status-glyph";
import styles from "./portrait.module.css";

/**
 * iPad portrait pattern (device audit, 11 Oct 2026, Recommended point 5; owner pick A): at 820px a
 * wide table becomes list rows and the page's rail becomes a slide-over. Shared by any page that
 * has a wide table and a rail (Handover and Delays first). Desktop and phone keep their own
 * layouts; a page renders these parts only when `useIsTabletPortrait()` is true.
 */

export type PortraitRowData = {
  id: string;
  /** Surname first, as on every list. Truncates first. */
  name: string;
  /** UMRN and one short fact. */
  sub?: string;
  /** The row's figure (wait, due time). Mono, never truncated. */
  figure: ReactNode;
  /** One word under the figure, e.g. "waited". */
  figureNote?: string;
  /** Tone lives in the glyph, never the words. */
  tone?: WfTone;
  /** The next step, as words. */
  next?: string;
  /** Act now: the thin red edge on this row only. */
  actNow?: boolean;
  selected?: boolean;
  dim?: boolean;
};

export type PortraitGroup = {
  id: string;
  title: string;
  /** Group head glyph. */
  tone?: WfTone;
  /** One short reason line, e.g. "Ward to clear". */
  note?: string;
  rows: PortraitRowData[];
};

export function PortraitList({
  groups,
  onOpen,
  label,
  footer,
}: {
  groups: PortraitGroup[];
  onOpen: (id: string) => void;
  label: string;
  footer?: ReactNode;
}) {
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string) =>
    setFolded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className={styles.list} aria-label={label} data-testid="wf-portrait-list">
      {groups.map((group) => {
        if (group.rows.length === 0) return null;
        const isFolded = folded.has(group.id);
        return (
          <div key={group.id} className={styles.group}>
            <button
              type="button"
              className={styles.groupHead}
              aria-expanded={!isFolded}
              onClick={() => toggle(group.id)}
            >
              <ChevronRight size={14} aria-hidden="true" className={styles.groupChevron} data-open={!isFolded} />
              {group.tone ? <StatusGlyph tone={group.tone} size={9} /> : null}
              <span className={styles.groupTitle}>{group.title}</span>
              <span className={styles.groupCount}>{group.rows.length}</span>
              {group.note ? <span className={styles.groupNote}>{group.note}</span> : null}
            </button>
            {isFolded ? null : (
              <ul className={styles.rows}>
                {group.rows.map((row) => (
                  <li
                    key={row.id}
                    className={cx(styles.row, row.actNow && styles.actNow)}
                    data-selected={row.selected ? "true" : undefined}
                    data-dim={row.dim ? "true" : undefined}
                  >
                    <button
                      type="button"
                      className={styles.rowButton}
                      onClick={() => onOpen(row.id)}
                      aria-label={`${row.name}${row.next ? `, next: ${row.next}` : ""}`}
                    >
                      <span className={styles.lead}>{row.tone ? <StatusGlyph tone={row.tone} size={9} /> : null}</span>
                      <span className={styles.who}>
                        <b className={styles.name}>{row.name}</b>
                        {row.sub ? <span className={styles.sub}>{row.sub}</span> : null}
                      </span>
                      <span className={styles.figure}>
                        <b className={styles.mono}>{row.figure}</b>
                        {row.figureNote ? <span className={styles.figureNote}>{row.figureNote}</span> : null}
                      </span>
                      <span className={styles.next}>{row.next ?? ""}</span>
                      <ChevronRight size={16} aria-hidden="true" className={styles.chevron} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {footer ? <div className={styles.listFoot}>{footer}</div> : null}
    </section>
  );
}

/**
 * The page rail at iPad portrait: a toolbar button that opens the rail as a right slide-over.
 */
export function PortraitRail({
  title,
  summary,
  open,
  onOpenChange,
  children,
  description,
}: {
  title: string;
  /** One short line: the rail's state, e.g. "3 of 5 checks". */
  summary: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  description?: ReactNode;
}) {
  return (
    <>
      <Button
        variant="sec"
        size="sm"
        icon={PanelRightOpen}
        aria-expanded={open}
        onClick={() => onOpenChange(true)}
        className={styles.slideTrigger}
        data-testid="wf-portrait-rail-trigger"
      >
        {title}
        <span className={styles.triggerSummary}>{summary}</span>
      </Button>
      <PhoneSheet
        open={open}
        onClose={() => onOpenChange(false)}
        title={title}
        description={description}
        height="tall"
        placement="right"
      >
        {children}
      </PhoneSheet>
    </>
  );
}

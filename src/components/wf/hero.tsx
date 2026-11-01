"use client";

import { ChevronDown } from "lucide-react";
import { useId, useRef, type ElementType, type ReactNode } from "react";
import { useWfBandBleed } from "./band";
import { cx } from "./cx";
import { HeroCondensedLine } from "./phone-fold";
import { SrOnly } from "./primitives";
import { StatusGlyph, type WfTone } from "./status-glyph";
import styles from "./hero.module.css";

export type HeroProps = {
  /**
   * A leading visual before the title, such as an `OccupancyRing` (v10 Home, Capacity, Wards).
   * Left of the title on desktop and tablet; under the title on phone, so the eyebrow and title
   * always come first. Use this instead of putting the ring in `stats` and reordering it in CSS.
   */
  lead?: ReactNode;
  /** Uppercase eyebrow ("STATE BEDFLOW", "STATISTICS · AS AT 10:42"). */
  eyebrow?: ReactNode;
  /**
   * Phone audit (Josh, 1 Nov 2026, Q153): on a phone the eyebrow usually repeats the header's page
   * and service names, so it is read to screen readers but not drawn, and the Live chip moves up
   * beside the title. `"show"` keeps it drawn where it says something the header does not (a
   * hospital, a shift). Desktop and tablet are unchanged.
   */
  phoneEyebrow?: "show" | "hide";
  /**
   * One plain sentence under the eyebrow saying what this page is for at this desk (Alerts, Q182).
   * Drawn on every screen size.
   */
  purpose?: ReactNode;
  /** Five words at most. */
  title: ReactNode;
  /** Small text after the title ("20 beds, all locked"). */
  titleMeta?: ReactNode;
  /** `HeroStat` items. */
  stats?: ReactNode;
  /** Stats sit after the title (`start`) or against the right edge (`end`, stats pages). */
  statsAlign?: "start" | "end";
  /** Right side of the first row: LiveChip with pause, and at most one light button. */
  aside?: ReactNode;
  /** Optional second row, left: a HeroTrack, journey steps or a short meta line. */
  bar?: ReactNode;
  /** Optional second row, right: LiveChip, switches, onHero and light buttons. */
  barAside?: ReactNode;
  /** Optional quiet foot line under a hairline, left: a short meta line such as the shift. */
  foot?: ReactNode;
  /** Optional foot line, right: freshness or a small link. */
  footAside?: ReactNode;
  /**
   * `"actions"` when the foot holds buttons rather than a meta line: on phone it then drops the
   * hairline and lets the buttons wrap. Defaults to `"line"`; desktop looks the same either way.
   */
  footKind?: "line" | "actions";
  /** Heading level of the title. Defaults to 2. */
  level?: 1 | 2;
  /** `data-testid` on the hero section, so a page needs no wrapper element to find it. */
  testId?: string;
  /**
   * Quiet hero (v10): a light inset card for an inactive record or a calm page. It never looks
   * live and never takes the band.
   */
  quiet?: boolean;
  /**
   * Desktop and tablet band (v10 section 7.1). On by default: when the page opens on this hero it
   * runs square across the work column and the header sits in hero ink over it at rest. Pass
   * `false` for a hero that must stay an inset card even at the top of a page.
   */
  band?: boolean;
  /**
   * Simplification C1: on a phone, one short line ("70 people waiting · 0 past recorded time")
   * pinned under the header once this hero has scrolled away. A tap brings the hero back. Nothing
   * changes above 48rem; leave it out to keep the hero as it was.
   */
  condensed?: ReactNode;
  className?: string;
};

/**
 * v6 hero band. One per page. Inside it status glyphs use their night values and focus turns
 * white. Use `light` for its one primary button and `onHero` for the rest.
 *
 * v10: a page that opens on this hero gets the band on desktop and tablet automatically (see
 * `band.ts`). Put a `CheckingFoot` in `foot` to say what the page checked and what it could not.
 */
export function Hero({
  lead,
  eyebrow,
  phoneEyebrow = "hide",
  purpose,
  title,
  titleMeta,
  stats,
  statsAlign = "start",
  aside,
  bar,
  barAside,
  foot,
  footAside,
  footKind = "line",
  level = 2,
  testId,
  quiet = false,
  band = true,
  condensed,
  className,
}: HeroProps) {
  const titleId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  useWfBandBleed(sectionRef, band && !quiet);
  const Heading = `h${level}` as ElementType;
  return (
    <section
      ref={sectionRef}
      className={cx(styles.hero, quiet && styles.quiet, className)}
      aria-labelledby={titleId}
      data-testid={testId}
      // A band hero is server-rendered as the band (band.ts, site review B6); `card` opts out.
      data-wf-hero={quiet ? "quiet" : band ? "band" : "card"}
      data-phone-eyebrow={eyebrow ? phoneEyebrow : undefined}
    >
      <div className={cx(styles.row, styles.firstRow)}>
        {lead ? (
          <div className={styles.lead} data-wf-hero-lead="">
            {lead}
          </div>
        ) : null}
        <div className={styles.titleBlock}>
          {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
          {purpose ? <p className={styles.purpose}>{purpose}</p> : null}
          <div className={styles.titleLine}>
            <Heading id={titleId} className={styles.title}>
              {title}
            </Heading>
            {titleMeta ? <span className={styles.titleMeta}>{titleMeta}</span> : null}
          </div>
        </div>
        {stats ? <div className={cx(styles.stats, statsAlign === "end" && styles.statsEnd)}>{stats}</div> : null}
        {aside ? <div className={styles.aside}>{aside}</div> : null}
      </div>
      {bar || barAside ? (
        <div className={cx(styles.row, styles.barRow)}>
          {bar ? <div className={styles.bar}>{bar}</div> : null}
          {barAside ? <div className={styles.aside}>{barAside}</div> : null}
        </div>
      ) : null}
      {foot || footAside ? (
        <div className={cx(styles.row, styles.foot)} data-foot={footKind === "actions" ? "actions" : undefined}>
          {foot ? <div className={styles.footMain}>{foot}</div> : null}
          {footAside ? <div className={styles.footAside}>{footAside}</div> : null}
        </div>
      ) : null}
      {condensed ? <HeroCondensedLine heroRef={sectionRef}>{condensed}</HeroCondensedLine> : null}
    </section>
  );
}

export type HeroStatProps = {
  value: ReactNode;
  /**
   * Slash form (v10): with `total` the value reads "2/7" on screen and "2 of 7" to a screen
   * reader. Use for progress past a set ("2/7 steps"), not for a rate.
   */
  total?: ReactNode;
  label: ReactNode;
  /** Glyph before the label. Red (danger) only when it needs action now. */
  tone?: WfTone;
  /** A small trend beside the value. */
  trend?: ReactNode;
  /** Makes the stat a toggle that shows or hides the panel named by `controls`. */
  onToggle?: () => void;
  /**
   * With `onToggle`, makes the stat a pressed filter instead of a disclosure: `aria-pressed`
   * replaces `aria-expanded` and the chevron is dropped.
   */
  pressed?: boolean;
  /**
   * With `onToggle`, makes the stat a one-way command (it opens something elsewhere) instead of a
   * toggle: no `aria-pressed`, no `aria-expanded` and no chevron.
   */
  command?: boolean;
  expanded?: boolean;
  controls?: string;
  /** One line (value beside label), for a second hero row of toggles. */
  inline?: boolean;
  className?: string;
};

/** A count on the hero band: mono value over a label, hairline separators between items. */
export function HeroStat({
  value,
  total,
  label,
  tone,
  trend,
  onToggle,
  expanded,
  controls,
  pressed,
  command = false,
  inline = false,
  className,
}: HeroStatProps) {
  const isFilter = pressed !== undefined;
  const isToggle = !isFilter && !command;
  const body = (
    <>
      <span className={styles.valueLine}>
        {total !== undefined ? (
          <span className={styles.value}>
            <span aria-hidden="true">
              {value}
              <span className={styles.slash}>/</span>
              {total}
            </span>
            <SrOnly>
              {value} of {total}
            </SrOnly>
          </span>
        ) : (
          <span className={styles.value}>{value}</span>
        )}
        {trend ? <span className={styles.trend}>{trend}</span> : null}
      </span>
      <span className={styles.label}>
        {tone ? <StatusGlyph tone={tone} size={9} /> : null}
        {label}
        {onToggle && isToggle ? <ChevronDown className={styles.statChevron} size={14} aria-hidden="true" /> : null}
      </span>
    </>
  );
  if (!onToggle) return <div className={cx(styles.stat, inline && styles.inline, className)}>{body}</div>;
  return (
    <div className={cx(styles.stat, inline && styles.inline, className)}>
      <button
        type="button"
        className={styles.statToggle}
        aria-expanded={isToggle ? expanded : undefined}
        aria-pressed={isFilter ? pressed : undefined}
        aria-controls={controls}
        onClick={onToggle}
      >
        {body}
      </button>
    </div>
  );
}

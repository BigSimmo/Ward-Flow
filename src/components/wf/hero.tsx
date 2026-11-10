"use client";

import { ChevronDown, type LucideIcon } from "lucide-react";
import { Children, isValidElement, useId, useRef, type ElementType, type ReactNode } from "react";
import { useWfBandBleed } from "./band";
import { Button } from "./button";
import { cx } from "./cx";
import { useHeroFootSlot } from "./hero-foot-slot";
import { HeroCondensedLine } from "./phone-fold";
import { SrOnly } from "./primitives";
import { StatusGlyph, type WfTone } from "./status-glyph";
import { useScrollRegionFocus } from "./use-scroll-region-focus";
import styles from "./hero.module.css";

/**
 * Plan item 2i (proposal, 3 Nov 2026): the hero's next step. One plain sentence that answers "what
 * do I do now", the hero's one filled light button, optional owner or due words, and at most three
 * facts the page shows nowhere else. Derive every word from state the page already holds; never an
 * invented figure, and legal times only as typed (no countdowns).
 */
export type HeroNextStep = {
  /** One plain sentence: "5 held-up discharges need chasing". No figure the page cannot back. */
  answer: ReactNode;
  /** The hero's one primary. Leave it out when there is nothing to do ("Nothing held up"). */
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
    /** Pressed state when the action is a filter that is on. */
    pressed?: boolean;
    testId?: string;
  };
  /** Short owner or due words beside the answer ("Your move", "Ward teams"). */
  owner?: ReactNode;
  /** At most three label and value pairs not shown anywhere else on the page. Desktop and tablet only. */
  facts?: readonly { id: string; label: ReactNode; value: ReactNode }[];
};

/** The next step row (plan item 2i). Rendered by `Hero` from its `next` prop. */
function HeroNext({ next }: { next: HeroNextStep }) {
  const facts = (next.facts ?? []).slice(0, 3);
  const action = next.action;
  return (
    <div className={styles.next} data-wf-hero-next="">
      <div className={styles.nextText}>
        <p className={styles.nextAnswer} data-testid="hero-next-answer">
          {next.answer}
        </p>
        {next.owner ? <span className={styles.nextOwner}>{next.owner}</span> : null}
      </div>
      {facts.length > 0 ? (
        <dl className={styles.nextFacts}>
          {facts.map((fact) => (
            <div key={fact.id} className={styles.nextFact}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {action ? (
        <Button
          variant="light"
          icon={action.icon}
          className={styles.nextAction}
          onClick={action.onClick}
          aria-pressed={action.pressed}
          data-testid={action.testId ?? "hero-next-action"}
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

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
  /**
   * Plan item 2i (proposal): the next step under the title. On a phone the hero then folds to the
   * title line plus this step: the figures, the second row, the foot and the lead are not drawn.
   */
  next?: HeroNextStep;
  /**
   * Sticky header redesign (Josh, 9 Nov 2026): free content drawn inside the band under the first row
   * (Home's figures, next step and ED strip). The page styles it; the hero only places it. It is not
   * folded on a phone by `next`: a page that passes both decides what its children show there.
   */
  children?: ReactNode;
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
  next,
  children,
  className,
}: HeroProps) {
  const titleId = useId();
  const footSlot = useHeroFootSlot();
  const sectionRef = useRef<HTMLElement>(null);
  useWfBandBleed(sectionRef, band && !quiet);
  const statsRef = useRef<HTMLDivElement>(null);
  useScrollRegionFocus(statsRef, stats);
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
      data-next={next ? "" : undefined}
    >
      <div className={cx(styles.row, styles.firstRow)}>
        {lead ? (
          <div className={styles.lead} data-wf-hero-lead="">
            {lead}
          </div>
        ) : null}
        <div className={styles.titleBlock}>
          {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
          <div className={styles.titleLine} data-wf-hero-title-line="">
            <Heading id={titleId} className={styles.title} data-wf-hero-title="">
              {title}
            </Heading>
            {titleMeta ? <span className={styles.titleMeta}>{titleMeta}</span> : null}
          </div>
        </div>
        {stats ? (
          <div
            ref={statsRef}
            className={cx(styles.stats, statsAlign === "end" && styles.statsEnd)}
            role="group"
            aria-label="Figures"
          >
            {stats}
          </div>
        ) : null}
        {aside ? <div className={styles.aside}>{aside}</div> : null}
      </div>
      {next ? <HeroNext next={next} /> : null}
      {children}
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
      {band && !quiet && !takesFootSlot(children) ? footSlot : null}
      {condensed ? <HeroCondensedLine heroRef={sectionRef}>{condensed}</HeroCondensedLine> : null}
    </section>
  );
}

/** A `HeroTop` (hero-top.tsx) draws the foot slot in its chip row; read by a flag, so this file never loads it. */
function takesFootSlot(children: ReactNode): boolean {
  return Children.toArray(children).some(
    (child) => isValidElement(child) && (child.type as { wfTakesFootSlot?: boolean }).wfTakesFootSlot === true,
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

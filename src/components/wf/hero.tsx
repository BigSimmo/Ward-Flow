import { useId, type ElementType, type ReactNode } from "react";
import { cx } from "./cx";
import { SrOnly } from "./primitives";
import { StatusGlyph, type WfTone } from "./status-glyph";
import styles from "./hero.module.css";

export type HeroProps = {
  /** Uppercase eyebrow ("STATE BEDFLOW", "STATISTICS · AS AT 10:42"). */
  eyebrow?: ReactNode;
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
  /** Heading level of the title. Defaults to 2. */
  level?: 1 | 2;
  className?: string;
};

/**
 * v6 hero band. One per page. Inside it status glyphs use their night values and focus turns
 * white. Use `light` for its one primary button and `onHero` for the rest.
 */
export function Hero({
  eyebrow,
  title,
  titleMeta,
  stats,
  statsAlign = "start",
  aside,
  bar,
  barAside,
  level = 2,
  className,
}: HeroProps) {
  const titleId = useId();
  const Heading = `h${level}` as ElementType;
  return (
    <section className={cx(styles.hero, className)} aria-labelledby={titleId}>
      <div className={styles.row}>
        <div className={styles.titleBlock}>
          {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
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
        <div className={styles.row}>
          {bar ? <div className={styles.bar}>{bar}</div> : null}
          {barAside ? <div className={styles.aside}>{barAside}</div> : null}
        </div>
      ) : null}
    </section>
  );
}

export type HeroStatProps = {
  value: ReactNode;
  label: ReactNode;
  /** Glyph before the label. Red (danger) only when it needs action now. */
  tone?: WfTone;
  /** A small trend beside the value, such as a `Sparkline`. */
  trend?: ReactNode;
  className?: string;
};

/** A count on the hero band: mono value over a label, hairline separators between items. */
export function HeroStat({ value, label, tone, trend, className }: HeroStatProps) {
  return (
    <div className={cx(styles.stat, className)}>
      <span className={styles.valueLine}>
        <span className={styles.value}>{value}</span>
        {trend ? <span className={styles.trend}>{trend}</span> : null}
      </span>
      <span className={styles.label}>
        {tone ? <StatusGlyph tone={tone} size={9} /> : null}
        {label}
      </span>
    </div>
  );
}

export type HeroStep = { id: string; label: ReactNode };

/**
 * Journey track for the hero band only. Steps before `current` show a tick, the current step is
 * solid white with `aria-current="step"`, and later steps are numbered.
 */
export function HeroSteps({
  steps,
  current,
  label,
  className,
}: {
  steps: HeroStep[];
  /** Index of the current step. */
  current: number;
  /** Accessible name, such as "Referral progress". */
  label: string;
  className?: string;
}) {
  return (
    <ol className={cx(styles.steps, className)} aria-label={label}>
      {steps.map((step, index) => {
        const done = index < current;
        const isCurrent = index === current;
        return (
          <li
            key={step.id}
            className={cx(styles.step, done && styles.done, isCurrent && styles.current)}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span className={styles.stepMark} aria-hidden="true">
              {done ? <StatusGlyph tone="success" size={9} /> : index + 1}
            </span>
            <span className={styles.stepLabel}>{step.label}</span>
            {done ? <SrOnly>, done</SrOnly> : null}
          </li>
        );
      })}
    </ol>
  );
}

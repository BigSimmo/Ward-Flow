"use client";

import { type ReactNode, useMemo } from "react";
import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";

import { Card, StatusGlyph, durMinutes, useIsPhone, type WfTone } from "@/components/wf";
import { edOpenSummaries, isUnderAForm } from "@/components/ward-management/ed/ed-home-derivations";
import { clockState, type Instant, splitDuration } from "@/components/ward-management/ward-clock";
import { useDueSoonThresholds, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { HealthService, Movement } from "@/components/ward-management/ward-model";
import { edLongestWaitTone, edPressure } from "@/components/ward-management/ward-pressure";
import { edHealthService, healthServiceAcronym } from "@/components/ward-management/ward-service-scope";
import { edShortName, siteByCode } from "@/components/ward-management/ward-sites";

import heroStyles from "./home-hero.module.css";
import styles from "./home.module.css";

/**
 * A due-soon window as it is said on screen: "1h" for whole hours, else "1h 30m". Read from the
 * saved configuration, because `clockState` classifies against those same saved values.
 */
export function dueWindowLabel(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : durMinutes(minutes);
}

type HomeEdPressureProps = {
  now: Instant;
  movements: Movement[];
  selectedEdId: string | undefined;
  onSelectEd: (edId: string | undefined) => void;
  /** The chosen health service (`null` is All services). An ED with no resolvable service stays shown. */
  service: HealthService | null;
  /**
   * Sticky header redesign (Josh, 9 Nov 2026): Home draws the strip inside its slate hero as one row
   * of departments under a "Waiting in ED" label, instead of a light card under the hero.
   */
  onHero?: boolean;
  /** With `onHero`, the short population line beside the label ("62 in ED · 8 in transit"). */
  population?: ReactNode;
};

/**
 * Home and Activity design (approved by Josh 31 Oct 2026): the form line names its noun ("1 form due",
 * not "1 due soon") so it cannot be read as the hero's Past target waits (short enough for one line;
 * the spoken name keeps the window), and an ED with
 * nobody waiting shows only "No wait".
 *
 * Home's ED strip (direction A, owner 10 Oct 2026). One compact tile per emergency department,
 * longest wait first: code, service, how many wait, the longest wait with its glyph, and the
 * recorded legal deadlines. The heading is for screen readers only; the hero already says what the
 * strip is. Pressing a department filters the priority queue to it, the same toggle the old strip
 * carried (`aria-pressed`, `ward-ed-<id>`).
 *
 * These tiles measure physical inpatient-bed waits; Home's hero separately retains open journeys through transit.
 */
export function HomeEdPressure({
  now,
  movements,
  selectedEdId,
  onSelectEd,
  service,
  onHero = false,
  population,
}: HomeEdPressureProps) {
  // A longest wait past the configured ED access target is red; past the severe line it is amber.
  const thresholds = useDueSoonThresholds();
  const { configuration } = useWardFlowSelect("configuration");
  const urgentWindow = dueWindowLabel(configuration.dueSoonUrgentMinutes);
  const soonWindow = dueWindowLabel(configuration.dueSoonMinutes);
  const pressure = useMemo(() => edPressure(now, movements), [now, movements]);
  const summaries = useMemo(() => edOpenSummaries(movements, now), [movements, now]);
  // F-19: the phone tile hides the service, so its spoken name leads without it.
  const isPhone = useIsPhone();

  const scoped = service
    ? pressure.filter((row) => {
        const rowService = edHealthService(row.ed.id);
        return rowService === undefined || rowService === service;
      })
    : pressure;
  const hiddenByService = pressure.length - scoped.length;
  const sorted = [...scoped].sort((a, b) => b.longestWaitMinutes - a.longestWaitMinutes || b.waiting - a.waiting);
  const openFor = (edId: string) => summaries.find((summary) => summary.ed.id === edId)?.open ?? [];
  // Appraisal (Josh Q8, 3 Nov 2026): only the departments that need something get a tile, worst
  // first. One with nobody waiting and no one on forms folds into one quiet "KEMH, PCH: no wait" tile,
  // unless it is the one the queue is filtered to, so the filter can always be turned off.
  const needsSomething = (row: (typeof sorted)[number]) =>
    row.waiting > 0 || row.breaching > 0 || row.ed.id === selectedEdId || openFor(row.ed.id).some(isUnderAForm);
  const rows = sorted.filter(needsSomething);
  const clear = sorted.filter((row) => !needsSomething(row));
  const clearCodes = clear.map((row) => row.ed.siteCode).join(", ");
  const clearNames = clear.map((row) => edShortName(row.ed)).join(", ");

  // The hero strip has its own class names with the same roles as the card's.
  const c = onHero ? heroStyles : styles;
  const list = (
    <ul className={onHero ? heroStyles.edStrip : styles.edGrid}>
      {rows.map((row) => {
        const selected = row.ed.id === selectedEdId;
        const rawService = siteByCode(row.ed.siteCode)?.service ?? edHealthService(row.ed.id);
        const serviceAcronym = healthServiceAcronym(rawService);
        const open = openFor(row.ed.id);
        // H1 (Josh, 3 Nov 2026): the tile counts the people on forms, not a missing due time.
        const onForms = open.filter(isUnderAForm).length;
        const deadlines = open.flatMap((movement) => {
          const dueAt = currentLegalDueAt(movement);
          return dueAt === undefined ? [] : [clockState(dueAt, now, thresholds)];
        });
        const critical = deadlines.filter((state) => state === "critical").length;
        const due = deadlines.filter((state) => state === "due").length;
        const forms = (count: number) => `${count} form${count === 1 ? "" : "s"}`;

        // With a form due the line drops "on" so it stays on one line in a narrow tile.
        const onFormsText = `${onForms} on form${onForms === 1 ? "" : "s"}`;
        // The worst recorded form state tones the line's glyph and, off the hero, outlines the tile (never a
        // side stripe). The hero's strip is divided cells, not tiles, so its glyph carries the tone alone.
        const deadline: { tone: WfTone; text: string; spoken: string } =
          row.breaching > 0
            ? {
                tone: "danger",
                text: `${forms(onForms)}, ${row.breaching}\u00a0overdue`,
                spoken: `${onFormsText}, ${forms(row.breaching)} overdue`,
              }
            : critical > 0
              ? {
                  tone: "danger",
                  text: `${forms(onForms)}, ${critical}\u00a0due`,
                  spoken: `${onFormsText}, ${forms(critical)} due within ${urgentWindow} (your default)`,
                }
              : due > 0
                ? {
                    tone: "warning",
                    text: `${forms(onForms)}, ${due}\u00a0due`,
                    spoken: `${onFormsText}, ${forms(due)} due within ${soonWindow} (your default)`,
                  }
                : onForms > 0
                  ? { tone: "neutral", text: onFormsText, spoken: onFormsText }
                  : { tone: "neutral", text: "", spoken: "" };
        const outline = deadline.tone === "danger" || deadline.tone === "warning" ? deadline.tone : undefined;
        // In the hero's narrow strip the forms line keeps its most urgent fact on one line ("1 due",
        // "2 overdue", after the form glyph); the full count of people on forms stays in the button's spoken name and title.
        const urgentCount = row.breaching > 0 ? row.breaching : critical > 0 ? critical : due;
        const shownDeadline =
          onHero && urgentCount > 0
            ? row.breaching > 0
              ? `${row.breaching}\u00a0overdue`
              : `${urgentCount}\u00a0due`
            : deadline.text;

        const longestTone: WfTone | null = edLongestWaitTone(
          row.waiting,
          row.longestWaitMinutes,
          configuration.edAccessTargetMinutes,
        );

        const waitText = row.waiting > 0 ? durMinutes(row.longestWaitMinutes) : "No wait";
        // The hero strip shows no service, and its count comes last in reading order (it sits top right),
        // so the name starts with the visible words in the order they are read, even when a phone's
        // sideways strip cuts the last tile short (axe label-in-name).
        const shownService = serviceAcronym && !isPhone && !onHero ? ` ${serviceAcronym}` : "";
        const waitingWords = `${row.waiting} waiting`;
        const visibleSummary = (
          onHero
            ? [row.ed.siteCode, waitText, shownDeadline, waitingWords]
            : [`${row.ed.siteCode}${shownService}`, waitingWords, waitText, shownDeadline]
        )
          .filter(Boolean)
          .join(", ");
        const spoken = [visibleSummary, `${edShortName(row.ed)} (${serviceAcronym || rawService || "Department"})`];
        if (row.waiting === 0) spoken.push("no patients waiting");
        else spoken.push(`longest ${splitDuration(row.longestWaitMinutes)}`);
        if (deadline.spoken) spoken.push(deadline.spoken);

        const waitingCount = (
          <span className={c.edWaiting} aria-hidden="true">
            <span className={c.edWaitingValue}>{row.waiting}</span> waiting
          </span>
        );

        return (
          <li key={row.ed.id} className={c.edCell}>
            <button
              type="button"
              data-testid={`ward-ed-${row.ed.id}`}
              className={c.edButton}
              data-service={serviceAcronym || undefined}
              data-selected={selected ? "true" : undefined}
              data-breaching={row.breaching}
              data-longest-minutes={row.longestWaitMinutes}
              data-waiting={row.waiting}
              data-forms={outline}
              aria-pressed={selected}
              aria-label={spoken.join(", ")}
              title={`${row.ed.name}${rawService ? ` (${rawService})` : ""}${onHero && deadline.spoken ? `: ${deadline.spoken}` : ""}`}
              onClick={() => onSelectEd(selected ? undefined : row.ed.id)}
            >
              <span className={c.edTop} aria-hidden="true">
                <strong className={c.edCode}>{row.ed.siteCode}</strong>
                {serviceAcronym ? (
                  <>
                    {" "}
                    <span className={c.edService}>{serviceAcronym}</span>
                  </>
                ) : null}
              </span>
              {/* A space between the lines (collapsed in the flex column) so the visible words read
                    apart for voice control and axe label-in-name, F-19. */}{" "}
              {onHero ? null : <>{waitingCount} </>}
              <span className={c.edLine} aria-hidden="true">
                {row.waiting > 0 ? (
                  <>
                    {longestTone ? <StatusGlyph tone={longestTone} size={9} /> : null}
                    {/* The longest wait with its glyph (v10: no word "Longest"); the button's
                          spoken name still says "longest". */}
                    <span className={c.edMono}>{durMinutes(row.longestWaitMinutes)}</span>
                  </>
                ) : (
                  <span className={c.edWord}>No wait</span>
                )}
              </span>{" "}
              {deadline.text ? (
                <span className={`${c.edLine} ${c.edDeadline}`} aria-hidden="true">
                  {deadline.tone === "neutral" ? null : <StatusGlyph tone={deadline.tone} size={9} />}
                  <span className={c.edWord}>{shownDeadline}</span>
                </span>
              ) : null}
              {onHero ? <> {waitingCount}</> : null}
            </button>
          </li>
        );
      })}
      {clear.length > 0 ? (
        <li
          className={`${c.edCell} ${c.edClearCell}`}
          data-testid="ward-home-ed-clear"
          data-ed-ids={clear.map((row) => row.ed.id).join(" ")}
        >
          {/* Josh, 3 Nov 2026: the folded line names the clear EDs, "KEMH, PCH: no wait". */}
          <p className={c.edClear} title={clearNames}>
            <span className={c.edClearCodes} aria-hidden="true">
              {onHero ? clear.map((row) => row.ed.siteCode).join(" · ") : `${clearCodes}:`}
            </span>{" "}
            <span aria-hidden="true">no wait</span>
            <span className="sr-only">{`${clearNames}: nobody waiting`}</span>
          </p>
        </li>
      ) : null}
    </ul>
  );
  const serviceFoot = service ? (
    <p className={c.cardNote} data-testid="ward-pressure-strip-service-foot">
      {`${hiddenByService} departments outside ${service} are not shown.`}
    </p>
  ) : null;

  if (onHero) {
    return (
      <section
        className={heroStyles.ed}
        aria-label="Emergency department pressure: physically waiting for an inpatient bed"
        data-testid="ward-home-ed-pressure"
      >
        <header className={heroStyles.edHead}>
          <h3 className={heroStyles.edLabel}>Waiting in ED</h3>
          {population ? <p className={heroStyles.edPopulation}>{population}</p> : null}
        </header>
        {list}
        {serviceFoot}
      </section>
    );
  }

  return (
    <Card
      className={styles.edCard}
      aria-label="Emergency department pressure: physically waiting for an inpatient bed"
      data-testid="ward-home-ed-pressure"
    >
      <h2 className="sr-only">ED pressure</h2>
      {list}
      {/* The ED access forecast heads Planned now (Home and Activity design, 31 Oct 2026). */}
      {serviceFoot}
    </Card>
  );
}

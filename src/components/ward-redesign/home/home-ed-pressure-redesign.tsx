"use client";

import { useMemo } from "react";

import { Card, StatusGlyph, durMinutes, useIsPhone, type WfTone } from "@/components/wf";
import { edOpenSummaries } from "@/components/ward-management/ed/ed-home-derivations";
import { type Instant, splitDuration } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";
import type { HealthService, Movement } from "@/components/ward-management/ward-model";
import { edLongestWaitTone, edPressure } from "@/components/ward-management/ward-pressure";
import { edHealthService, healthServiceAcronym } from "@/components/ward-management/ward-service-scope";
import { edShortName, siteByCode } from "@/components/ward-management/ward-sites";

import { HomeEdAccessLine } from "@/components/ward-management/forecast/forecast-lazy";

import styles from "@/components/ward-management/coordinator/home.module.css";

type HomeEdPressureProps = {
  now: Instant;
  movements: Movement[];
  selectedEdId: string | undefined;
  onSelectEd: (edId: string | undefined) => void;
  /** The chosen health service (`null` is All services). An ED with no resolvable service stays shown. */
  service: HealthService | null;
};

/**
 * Home's ED strip (direction A, owner 10 Oct 2026). One compact tile per emergency department,
 * longest wait first: code, service, how many wait, the longest wait with its glyph, and the
 * recorded legal deadlines. Redesign fork: the last line counts typed form times, with no countdown band. The heading is for screen readers only; the hero already says what the
 * strip is. Pressing a department filters the priority queue to it, the same toggle the old strip
 * carried (`aria-pressed`, `ward-ed-<id>`).
 *
 * These tiles measure physical inpatient-bed waits; Home's hero separately retains open journeys through transit.
 */
export function HomeEdPressureRedesign({ now, movements, selectedEdId, onSelectEd, service }: HomeEdPressureProps) {
  // A longest wait past the configured ED access target is red; past the severe line it is amber.
  const { configuration } = useWardFlowSelect("configuration");
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
  const rows = [...scoped].sort((a, b) => b.longestWaitMinutes - a.longestWaitMinutes || b.waiting - a.waiting);

  return (
    <Card
      className={styles.edCard}
      aria-label="Emergency department pressure: physically waiting for an inpatient bed"
      data-testid="ward-home-ed-pressure"
    >
      <h2 className="sr-only">ED pressure</h2>
      <ul className={styles.edGrid}>
        {rows.map((row) => {
          const selected = row.ed.id === selectedEdId;
          const rawService = siteByCode(row.ed.siteCode)?.service ?? edHealthService(row.ed.id);
          const serviceAcronym = healthServiceAcronym(rawService);
          // Redesign (point 18, Josh 30 Oct 2026): count the forms with a typed end time, as typed. No
          // overdue, due-soon or on-track band is worked out from the recorded legal times.
          const typedForms = (summaries.find((summary) => summary.ed.id === row.ed.id)?.open ?? []).filter(
            (movement) => movement.legalForm !== undefined && currentLegalDueAt(movement) !== undefined,
          ).length;
          const deadline: { text: string; spoken: string } =
            typedForms > 0
              ? {
                  text: `${typedForms} form time${typedForms === 1 ? "" : "s"} typed`,
                  spoken: `${typedForms} legal form${typedForms === 1 ? "" : "s"} with a typed end time, shown as typed on Legal forms`,
                }
              : row.waiting > 0
                ? { text: "No form times", spoken: "No form time typed" }
                : { text: "", spoken: "No patients waiting" };

          const longestTone: WfTone | null = edLongestWaitTone(
            row.waiting,
            row.longestWaitMinutes,
            configuration.edAccessTargetMinutes,
          );

          const waitText = row.waiting > 0 ? durMinutes(row.longestWaitMinutes) : "No wait";
          const shownService = serviceAcronym && !isPhone ? ` ${serviceAcronym}` : "";
          const visibleSummary = [
            `${row.ed.siteCode}${shownService}`,
            `${row.waiting} waiting`,
            waitText,
            deadline.text,
          ]
            .filter(Boolean)
            .join(", ");
          const spoken = [visibleSummary, `${edShortName(row.ed)} (${serviceAcronym || rawService || "Department"})`];
          if (row.waiting === 0) spoken.push("no patients waiting");
          else spoken.push(`longest ${splitDuration(row.longestWaitMinutes)}`);
          if (row.waiting > 0) spoken.push(deadline.spoken);

          return (
            <li key={row.ed.id} className={styles.edCell}>
              <button
                type="button"
                data-testid={`ward-ed-${row.ed.id}`}
                className={styles.edButton}
                data-service={serviceAcronym || undefined}
                data-selected={selected ? "true" : undefined}
                data-breaching={row.breaching}
                data-longest-minutes={row.longestWaitMinutes}
                data-waiting={row.waiting}
                aria-pressed={selected}
                aria-label={spoken.join(", ")}
                title={`${row.ed.name}${rawService ? ` (${rawService})` : ""}`}
                onClick={() => onSelectEd(selected ? undefined : row.ed.id)}
              >
                <span className={styles.edTop} aria-hidden="true">
                  <strong className={styles.edCode}>{row.ed.siteCode}</strong>
                  {serviceAcronym ? (
                    <>
                      {" "}
                      <span className={styles.edService}>{serviceAcronym}</span>
                    </>
                  ) : null}
                </span>
                {/* A space between the lines (collapsed in the flex column) so the visible words read
                    apart for voice control and axe label-in-name, F-19. */}{" "}
                <span className={styles.edWaiting} aria-hidden="true">
                  <span className={styles.edWaitingValue}>{row.waiting}</span> waiting
                </span>{" "}
                <span className={styles.edLine} aria-hidden="true">
                  {row.waiting > 0 ? (
                    <>
                      {longestTone ? <StatusGlyph tone={longestTone} size={9} /> : null}
                      {/* The longest wait with its glyph (v10: no word "Longest"); the button's
                          spoken name still says "longest". */}
                      <span className={styles.edMono}>{durMinutes(row.longestWaitMinutes)}</span>
                    </>
                  ) : (
                    <span className={styles.edWord}>No wait</span>
                  )}
                </span>{" "}
                {/* Redesign: the form line's glyph was always the neutral ring, so it carried no
                    meaning and pushed "2 form times typed" onto a third line; it goes. A department
                    with nobody waiting has no forms to count, so the line goes there too. */}
                {row.waiting > 0 ? (
                  <span className={`${styles.edLine} ${styles.edDeadline}`} aria-hidden="true">
                    <span className={styles.edWord}>{deadline.text}</span>
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {/* Forecasting build (Josh, 23 Oct 2026, screen 1): who will pass the access target first. */}
      <HomeEdAccessLine now={now} />
      {service ? (
        <p className={styles.cardNote} data-testid="ward-pressure-strip-service-foot">
          {`${hiddenByService} departments outside ${service} are not shown.`}
        </p>
      ) : null}
    </Card>
  );
}

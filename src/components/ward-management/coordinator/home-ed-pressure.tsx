"use client";

import { useMemo } from "react";

import { Card, StatusGlyph, durMinutes, type WfTone } from "@/components/wf";
import { edOpenSummaries } from "@/components/ward-management/ed/ed-home-derivations";
import { clockState, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { HealthService, Movement } from "@/components/ward-management/ward-model";
import { ED_SEVERE_PRESSURE_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { edPressure } from "@/components/ward-management/ward-pressure";
import { edHealthService, healthServiceAcronym } from "@/components/ward-management/ward-service-scope";
import { edShortName, siteByCode } from "@/components/ward-management/ward-sites";

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
};

/**
 * Home's ED strip (direction A, owner 10 Oct 2026). One compact tile per emergency department,
 * longest wait first: code, service, how many wait, the longest wait with its glyph, and the
 * recorded legal deadlines. The heading is for screen readers only; the hero already says what the
 * strip is. Pressing a department filters the priority queue to it, the same toggle the old strip
 * carried (`aria-pressed`, `ward-ed-<id>`).
 *
 * The Network screen keeps its own `PressureStrip`; this card is Home's own layout.
 */
export function HomeEdPressure({ now, movements, selectedEdId, onSelectEd, service }: HomeEdPressureProps) {
  // A longest wait past the configured ED access target is red; past the severe line it is amber.
  const { configuration } = useWardFlow();
  const urgentWindow = dueWindowLabel(configuration.dueSoonUrgentMinutes);
  const soonWindow = dueWindowLabel(configuration.dueSoonMinutes);
  const pressure = useMemo(() => edPressure(now, movements), [now, movements]);
  const summaries = useMemo(() => edOpenSummaries(movements, now), [movements, now]);

  const scoped = service
    ? pressure.filter((row) => {
        const rowService = edHealthService(row.ed.id);
        return rowService === undefined || rowService === service;
      })
    : pressure;
  const hiddenByService = pressure.length - scoped.length;
  const rows = [...scoped].sort((a, b) => b.longestWaitMinutes - a.longestWaitMinutes || b.waiting - a.waiting);

  return (
    <Card className={styles.edCard} aria-label="Emergency department pressure">
      <h2 className="sr-only">ED pressure</h2>
      <ul className={styles.edGrid}>
        {rows.map((row) => {
          const selected = row.ed.id === selectedEdId;
          const rawService = siteByCode(row.ed.siteCode)?.service ?? edHealthService(row.ed.id);
          const serviceAcronym = healthServiceAcronym(rawService);
          const deadlines = (summaries.find((summary) => summary.ed.id === row.ed.id)?.open ?? [])
            .filter((movement) => movement.legalForm?.dueAt !== undefined)
            .map((movement) => clockState(movement.legalForm!.dueAt!, now));
          const critical = deadlines.filter((state) => state === "critical").length;
          const due = deadlines.filter((state) => state === "due").length;

          const deadline: { tone: WfTone; text: string; spoken: string } =
            row.breaching > 0
              ? { tone: "danger", text: `${row.breaching} overdue`, spoken: `${row.breaching} overdue` }
              : critical > 0
                ? {
                    tone: "danger",
                    text: `${critical} due in ${urgentWindow}`,
                    spoken: `${critical} due within ${urgentWindow} (your default)`,
                  }
                : due > 0
                  ? {
                      tone: "warning",
                      text: `${due} due soon`,
                      spoken: `${due} due within ${soonWindow} (your default)`,
                    }
                  : deadlines.length > 0
                    ? {
                        tone: "success",
                        text: `${deadlines.length} on track`,
                        spoken: `${deadlines.length} deadline${deadlines.length === 1 ? "" : "s"} on track`,
                      }
                    : row.waiting > 0
                      ? { tone: "neutral", text: "No deadlines", spoken: "No deadline recorded" }
                      : { tone: "neutral", text: "No deadlines", spoken: "No patients waiting" };

          const longestTone: WfTone | null =
            row.waiting === 0
              ? null
              : row.longestWaitMinutes >= configuration.edAccessTargetMinutes
                ? "danger"
                : row.longestWaitMinutes >= ED_SEVERE_PRESSURE_WAIT_MINUTES
                  ? "warning"
                  : null;

          const spoken = [`${edShortName(row.ed)} (${serviceAcronym || rawService || "Department"})`];
          if (row.waiting === 0) spoken.push("no patients waiting");
          else spoken.push(`${row.waiting} waiting`, `longest ${splitDuration(row.longestWaitMinutes)}`);
          spoken.push(deadline.spoken);

          return (
            <li key={row.ed.id} className={styles.edCell}>
              <button
                type="button"
                data-testid={`ward-ed-${row.ed.id}`}
                className={styles.edButton}
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
                  {serviceAcronym ? <span className={styles.edService}>{serviceAcronym}</span> : null}
                </span>
                <span className={styles.edWaiting} aria-hidden="true">
                  <span className={styles.edWaitingValue}>{row.waiting}</span> waiting
                </span>
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
                </span>
                <span className={`${styles.edLine} ${styles.edDeadline}`} aria-hidden="true">
                  <StatusGlyph tone={deadline.tone} size={9} />
                  <span className={styles.edWord}>{deadline.text}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {service ? (
        <p className={styles.cardNote} data-testid="ward-pressure-strip-service-foot">
          {`${hiddenByService} departments outside ${service} are not shown.`}
        </p>
      ) : null}
    </Card>
  );
}

"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { clockState, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { DUE_SOON_MINUTES, DUE_SOON_URGENT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { edOpenSummaries } from "@/components/ward-management/ed/ed-home-derivations";
import type { HealthService, Movement } from "@/components/ward-management/ward-model";
import { edPressure } from "@/components/ward-management/ward-pressure";
import { edHealthService, healthServiceAcronym } from "@/components/ward-management/ward-service-scope";
import { edShortName, siteByCode } from "@/components/ward-management/ward-sites";

import styles from "./coordinator.module.css";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";

type PressureStripProps = {
  now: Instant;
  selectedEdId: string | undefined;
  onSelectEd: (edId: string | undefined) => void;
  /**
   * REQUIRED, not injectable-for-tests. It was optional, and the one screen that renders this in
   * production did not pass it — so the strip silently read the seed fixture while the referral
   * queue beside it read live state. An optional argument whose absence produces a plausible
   * answer is the same defect as `edPressure`'s old default, one level up.
   *
   * Tests still pass `[]` here to exercise a department with nobody waiting, rather than waiting
   * for the live fixture to grow one (Task 4 review Important 5). That was always the honest use
   * of this parameter; what it can no longer do is stand in for a production caller's silence.
   */
  movements: Movement[];
  /**
   * Item 44, build plan task B1 (`docs/ward-flow/plans/2026-09-17-build-plan-screens.md` §2
   * "Command: the patients queue and pressure strip are scoped."). `undefined`/`null` (every
   * existing direct caller — `tests/pressure-strip.dom.test.tsx` included — never passes this)
   * renders every department, unchanged from before this task. `coordinator-screen.tsx` is the
   * one production caller and always passes the live `useServiceScope()` value, `null` included
   * while All services is chosen.
   *
   * An emergency department this module cannot resolve to any service (`edHealthService` returns
   * `undefined`) stays visible regardless of the choice — the same "unresolvable means always
   * shown" rule `ward-service-scope.ts`'s own header comment gives for a movement or a referral.
   */
  service?: HealthService | null;
};

/**
 * The coordinator's one-second read on "which emergency department is worst". Worst-first
 * ordering comes from `edPressure` (a passed legal deadline outranks a long wait, which
 * outranks sheer volume) — this component only renders that order, it never re-derives it.
 *
 * The visible label is `ed.siteCode`, never a name shortened by string surgery: `ed.name` is
 * carried in the card's accessible name and `title` instead, so the unabbreviated hospital
 * reaches a screen reader and a hover without ever displaying a plausible-but-wrong guess.
 */
export function PressureStrip({ now, selectedEdId, onSelectEd, movements, service = null }: PressureStripProps) {
  const pressure = edPressure(now, movements);
  // Only `.open` is read below (for each department's own legal-deadline states) — never
  // `pastAccessTarget`/`detainedAndPastAccessTarget` — so this reads the target-independent half
  // of ed-home-derivations.ts (Task 6 of the audit-wiring plan, 2026-09-16).
  const summaries = edOpenSummaries(movements, now);

  const scrollRef = useRef<HTMLUListElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Item 44, task B1: an ED belongs to its site's service (`edHealthService`); one this module
  // cannot resolve at all stays visible regardless of the choice, the same conservative-failure
  // rule the rest of `ward-service-scope.ts` gives for every other population.
  const scopedPressure = service
    ? pressure.filter((row) => {
        const rowService = edHealthService(row.ed.id);
        return rowService === undefined || rowService === service;
      })
    : pressure;
  const hiddenByService = pressure.length - scopedPressure.length;
  const longestWait = Math.max(1, ...scopedPressure.map((row) => row.longestWaitMinutes));

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, scopedPressure.length]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = Math.max(300, Math.floor(el.clientWidth * 0.75));
    const offset = direction === "left" ? -scrollAmount : scrollAmount;
    el.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <section className={styles.pressureStrip} aria-label="Emergency department pressure">
      <header className={styles.regionHeader}>
        <h2>
          <span className={styles.liveDot} aria-hidden="true" />
          Emergency department pressure
        </h2>
        <div className={styles.pressureHeaderActions}>
          <span className={styles.regionCount}>{scopedPressure.length} departments</span>
          <LegalLimitsNotChecked variant="tag" />
          <div className={styles.pressureNavButtons}>
            <button
              type="button"
              className={styles.pressureScrollButton}
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              aria-label="Scroll emergency departments left"
              title="Scroll left"
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.pressureScrollButton}
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              aria-label="Scroll emergency departments right"
              title="Scroll right"
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      <ul className={styles.pressureList} ref={scrollRef}>
        {scopedPressure.map((row) => {
          const selected = row.ed.id === selectedEdId;
          const shortName = edShortName(row.ed);
          const rawService = siteByCode(row.ed.siteCode)?.service;
          const serviceAcronym = healthServiceAcronym(rawService);

          const deadlines = (summaries.find((summary) => summary.ed.id === row.ed.id)?.open ?? [])
            .filter((movement) => movement.legalForm?.dueAt !== undefined)
            .map((movement) => clockState(movement.legalForm!.dueAt!, now));
          const critical = deadlines.filter((state) => state === "critical").length;
          const due = deadlines.filter((state) => state === "due").length;

          // Streamlined label on card face avoids ugly ellipsis clipping in tight cards
          const deadlineLabel =
            row.breaching > 0
              ? `${row.breaching} overdue`
              : critical > 0
                ? `${critical} due < ${DUE_SOON_URGENT_MINUTES / 60}h`
                : due > 0
                  ? `${due} due < ${DUE_SOON_MINUTES / 60}h`
                  : deadlines.length > 0
                    ? `${deadlines.length} on track`
                    : row.waiting > 0
                      ? "No deadlines"
                      : "No patients waiting";

          const deadlineAccessible =
            row.breaching > 0
              ? `${row.breaching} overdue`
              : critical > 0
                ? `${critical} due within ${DUE_SOON_URGENT_MINUTES / 60}h (your default)`
                : due > 0
                  ? `${due} due within ${DUE_SOON_MINUTES / 60}h (your default)`
                  : deadlines.length > 0
                    ? `${deadlines.length} deadline${deadlines.length === 1 ? "" : "s"} on track`
                    : row.waiting > 0
                      ? "No deadline recorded"
                      : "No patients waiting";

          const pressureTone =
            row.breaching > 0 || critical > 0
              ? "danger"
              : due > 0
                ? "warn"
                : deadlines.length > 0
                  ? "good"
                  : row.waiting > 0
                    ? "waiting"
                    : "quiet";

          const accessibleNameParts = [`${shortName} (${serviceAcronym || rawService || "Department"})`];
          if (row.waiting === 0) {
            accessibleNameParts.push("no patients waiting");
          } else {
            accessibleNameParts.push(`${row.waiting} waiting`, `longest ${splitDuration(row.longestWaitMinutes)}`);
          }
          accessibleNameParts.push(deadlineAccessible);
          const accessibleName = accessibleNameParts.join(", ");

          return (
            <li key={row.ed.id}>
              <button
                type="button"
                data-testid={`ward-ed-${row.ed.id}`}
                className={selected ? styles.pressureCardSelected : styles.pressureCard}
                data-breaching={row.breaching}
                data-longest-minutes={row.longestWaitMinutes}
                data-waiting={row.waiting}
                data-pressure-tone={pressureTone}
                aria-pressed={selected}
                aria-label={accessibleName}
                title={`${row.ed.name}${rawService ? ` (${rawService})` : ""}`}
                onClick={() => onSelectEd(selected ? undefined : row.ed.id)}
              >
                <span className={styles.pressureIdentity} aria-hidden="true">
                  <strong className={styles.pressureEdName}>{shortName}</strong>
                  {serviceAcronym ? <span className={styles.pressureServiceBadge}>{serviceAcronym}</span> : null}
                </span>
                {row.waiting === 0 ? (
                  <span className={styles.pressureStats} aria-hidden="true">
                    No patients waiting
                  </span>
                ) : (
                  <span className={styles.pressureStats} aria-hidden="true">
                    <strong>{row.waiting}</strong> waiting
                  </span>
                )}
                {row.waiting > 0 ? (
                  <span className={styles.pressureWait} aria-hidden="true">
                    Longest {splitDuration(row.longestWaitMinutes)}
                  </span>
                ) : (
                  <span className={styles.pressureWaitSpacer} aria-hidden="true" />
                )}
                <span
                  className={styles.pressureTrack}
                  aria-hidden="true"
                  title="Longest wait relative to the other departments"
                >
                  <span style={{ width: `${(row.longestWaitMinutes / longestWait) * 100}%` }} />
                </span>
                <span className={styles.pressureDeadline} aria-hidden="true">
                  {deadlineLabel}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {/* §3 "Command", strip foot: states exactly how many departments the service choice hid,
       *  never leaves that count unstated once a service is chosen — the same "never go silent on
       *  a narrowing" convention the scope bar's own notes follow. */}
      {service ? (
        <p className={styles.placeholder} data-testid="ward-pressure-strip-service-foot">
          {/* §3's own exact wording, fixed plural regardless of the count — the same literal
           *  template the build plan gives, with no singular variant specified. */}
          {`${hiddenByService} departments outside ${service} are not shown.`}
        </p>
      ) : null}
    </section>
  );
}

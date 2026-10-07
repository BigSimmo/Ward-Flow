"use client";

import { Activity, FileText } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Card, CardHead, Segmented, StatusGlyph, type WfTone } from "@/components/wf";
import { clockState, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { DUE_SOON_MINUTES, DUE_SOON_URGENT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { edOpenSummaries } from "@/components/ward-management/ed/ed-home-derivations";
import type { HealthService, Movement } from "@/components/ward-management/ward-model";
import { edPressure } from "@/components/ward-management/ward-pressure";
import { edHealthService, healthServiceAcronym } from "@/components/ward-management/ward-service-scope";
import { edShortName, siteByCode } from "@/components/ward-management/ward-sites";

import styles from "./pressure-strip.module.css";

type Order = "most" | "longest";

const ORDER_ITEMS: { id: Order; label: string }[] = [
  { id: "most", label: "Most waiting" },
  { id: "longest", label: "Longest wait" },
];

type PressureStripProps = {
  now: Instant;
  selectedEdId: string | undefined;
  onSelectEd: (edId: string | undefined) => void;
  /**
   * REQUIRED, not injectable-for-tests. It was optional, and the one screen that rendered this did
   * not pass it — so the strip silently read the seed fixture while the queue beside it read live
   * state. Tests still pass `[]` to exercise a department with nobody waiting.
   */
  movements: Movement[];
  /**
   * `undefined`/`null` renders every department. A department this module cannot resolve to any
   * service stays visible regardless of the choice, and the foot states how many the choice hid.
   */
  service?: HealthService | null;
  /** A line under the departments, such as the network's "no common deadline scale" note. */
  foot?: ReactNode;
};

const TONE_GLYPH: Record<string, WfTone> = {
  danger: "danger",
  warn: "warning",
  good: "neutral",
  waiting: "neutral",
  quiet: "neutral",
};

/**
 * ED pressure (v6 Network mockup). One tile per emergency department: code and service, how many
 * wait, a bar for the longest wait against the worst department, the longest wait with its glyph,
 * and the recorded legal deadlines. Pressing a tile selects that department (`aria-pressed`,
 * `ward-ed-<id>`). Every visible figure is `aria-hidden` and restated in the tile's accessible name.
 */
export function PressureStrip({ now, selectedEdId, onSelectEd, movements, service = null, foot }: PressureStripProps) {
  const [order, setOrder] = useState<Order>("most");
  const pressure = edPressure(now, movements);
  const summaries = edOpenSummaries(movements, now);

  const scopedPressure = service
    ? pressure.filter((row) => {
        const rowService = edHealthService(row.ed.id);
        return rowService === undefined || rowService === service;
      })
    : pressure;
  const hiddenByService = pressure.length - scopedPressure.length;
  const longestWait = Math.max(1, ...scopedPressure.map((row) => row.longestWaitMinutes));
  const rows = [...scopedPressure].sort((a, b) =>
    order === "most"
      ? b.waiting - a.waiting || b.longestWaitMinutes - a.longestWaitMinutes
      : b.longestWaitMinutes - a.longestWaitMinutes || b.waiting - a.waiting,
  );

  return (
    <Card as="section" className={styles.strip} aria-label="Emergency department pressure">
      <CardHead
        icon={Activity}
        title="Emergency department pressure"
        meta={
          <>
            <span className={styles.countTag}>{scopedPressure.length} departments</span> Waiting and longest wait
          </>
        }
        action={<Segmented label="Order departments by" items={ORDER_ITEMS} value={order} onChange={setOrder} />}
      />
      <ul className={styles.list}>
        {rows.map((row) => {
          const selected = row.ed.id === selectedEdId;
          const shortName = edShortName(row.ed);
          const rawService = siteByCode(row.ed.siteCode)?.service ?? edHealthService(row.ed.id);
          const serviceAcronym = healthServiceAcronym(rawService);

          const deadlines = (summaries.find((summary) => summary.ed.id === row.ed.id)?.open ?? [])
            .filter((movement) => movement.legalForm?.dueAt !== undefined)
            .map((movement) => clockState(movement.legalForm!.dueAt!, now));
          const critical = deadlines.filter((state) => state === "critical").length;
          const due = deadlines.filter((state) => state === "due").length;

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
                      ? "None due"
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
                className={selected ? styles.tileSelected : styles.tile}
                data-breaching={row.breaching}
                data-longest-minutes={row.longestWaitMinutes}
                data-waiting={row.waiting}
                data-pressure-tone={pressureTone}
                aria-pressed={selected}
                aria-label={accessibleName}
                title={`${row.ed.name}${rawService ? ` (${rawService})` : ""}`}
                onClick={() => onSelectEd(selected ? undefined : row.ed.id)}
              >
                <span className={styles.identity} aria-hidden="true">
                  <strong className={styles.code}>{row.ed.siteCode}</strong>
                  {serviceAcronym ? <span className={styles.service}>{serviceAcronym}</span> : null}
                </span>
                {row.waiting === 0 ? (
                  <span className={styles.quiet} aria-hidden="true">
                    No patients waiting
                  </span>
                ) : (
                  <>
                    <span className={styles.waiting} aria-hidden="true">
                      <strong>{row.waiting}</strong> waiting
                    </span>
                    <span className={styles.track} aria-hidden="true">
                      <span
                        className={styles.fill}
                        style={{ width: `${(row.longestWaitMinutes / longestWait) * 100}%` }}
                      />
                    </span>
                    <span className={styles.longest} aria-hidden="true">
                      <StatusGlyph tone={TONE_GLYPH[pressureTone] ?? "neutral"} size={8} />
                      {splitDuration(row.longestWaitMinutes)}
                    </span>
                    <span className={styles.deadline} aria-hidden="true">
                      <FileText size={12} aria-hidden="true" />
                      {deadlineLabel}
                    </span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {service ? (
        <p className={styles.foot} data-testid="ward-pressure-strip-service-foot">
          {/* §3's own exact wording, fixed plural regardless of the count. */}
          {`${hiddenByService} departments outside ${service} are not shown.`}
        </p>
      ) : null}
      {foot ? <div className={styles.foot}>{foot}</div> : null}
    </Card>
  );
}

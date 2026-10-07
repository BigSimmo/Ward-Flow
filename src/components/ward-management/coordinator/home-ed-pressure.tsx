"use client";

import { Activity } from "lucide-react";
import { useMemo, useState } from "react";

import { Card, CardHead, Segmented, StatusGlyph, durMinutes, type WfTone } from "@/components/wf";
import { edOpenSummaries } from "@/components/ward-management/ed/ed-home-derivations";
import { clockState, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { HealthService, Movement } from "@/components/ward-management/ward-model";
import {
  DUE_SOON_MINUTES,
  DUE_SOON_URGENT_MINUTES,
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";
import { edPressure } from "@/components/ward-management/ward-pressure";
import { edHealthService, healthServiceAcronym } from "@/components/ward-management/ward-service-scope";
import { edShortName, siteByCode } from "@/components/ward-management/ward-sites";

import styles from "./home.module.css";

type Order = "longest" | "most";

const ORDER_ITEMS: { id: Order; label: string }[] = [
  { id: "longest", label: "Longest wait" },
  { id: "most", label: "Most waiting" },
];

type HomeEdPressureProps = {
  now: Instant;
  movements: Movement[];
  selectedEdId: string | undefined;
  onSelectEd: (edId: string | undefined) => void;
  /** The chosen health service (`null` is All services). An ED with no resolvable service stays shown. */
  service: HealthService | null;
};

/**
 * Home's ED pressure card (v6 Home mockup). One column per emergency department: code, service,
 * how many wait, a bar for the longest wait against the worst department, the longest wait with its
 * glyph, and the recorded legal deadlines. Pressing a department filters the priority queue to it,
 * the same toggle the old strip carried (`aria-pressed`, `ward-ed-<id>`).
 *
 * The Network screen keeps its own `PressureStrip`; this card is Home's own layout.
 */
export function HomeEdPressure({ now, movements, selectedEdId, onSelectEd, service }: HomeEdPressureProps) {
  // A longest wait past the configured ED access target is red; past the severe line it is amber.
  const { configuration } = useWardFlow();
  const [order, setOrder] = useState<Order>("longest");
  const pressure = useMemo(() => edPressure(now, movements), [now, movements]);
  const summaries = useMemo(() => edOpenSummaries(movements, now), [movements, now]);

  const scoped = service
    ? pressure.filter((row) => {
        const rowService = edHealthService(row.ed.id);
        return rowService === undefined || rowService === service;
      })
    : pressure;
  const hiddenByService = pressure.length - scoped.length;
  const rows = [...scoped].sort((a, b) =>
    order === "longest"
      ? b.longestWaitMinutes - a.longestWaitMinutes || b.waiting - a.waiting
      : b.waiting - a.waiting || b.longestWaitMinutes - a.longestWaitMinutes,
  );
  const longestOfAll = Math.max(1, ...scoped.map((row) => row.longestWaitMinutes));

  return (
    <Card className={styles.edCard} aria-label="Emergency department pressure">
      <CardHead
        className={styles.edHead}
        icon={Activity}
        title="ED pressure"
        meta={`${scoped.length} departments`}
        action={<Segmented label="Order departments by" items={ORDER_ITEMS} value={order} onChange={setOrder} />}
      />
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
                    text: `${critical} due in ${DUE_SOON_URGENT_MINUTES / 60}h`,
                    spoken: `${critical} due within ${DUE_SOON_URGENT_MINUTES / 60}h (your default)`,
                  }
                : due > 0
                  ? {
                      tone: "warning",
                      text: `${due} due soon`,
                      spoken: `${due} due within ${DUE_SOON_MINUTES / 60}h (your default)`,
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
                <span className={styles.edTrack} aria-hidden="true">
                  <span style={{ width: `${(row.longestWaitMinutes / longestOfAll) * 100}%` }} />
                </span>
                <span className={styles.edLine} aria-hidden="true">
                  {row.waiting > 0 ? (
                    <>
                      {longestTone ? <StatusGlyph tone={longestTone} size={9} /> : null}
                      <span className={styles.edMono}>{durMinutes(row.longestWaitMinutes)}</span>
                      <span className={styles.edWord}>longest</span>
                    </>
                  ) : (
                    <span className={styles.edWord}>No wait</span>
                  )}
                </span>
                <span className={styles.edLine} aria-hidden="true">
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

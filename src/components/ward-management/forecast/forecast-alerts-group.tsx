"use client";

// src/components/ward-management/forecast/forecast-alerts-group.tsx
//
// The Alerts screen's Forecast group, between Act now and Waiting (forecasting build, Josh,
// 23 Oct 2026, screen 6). Coordinators only (decision 3). Each row is a count crossing a line the
// coordinator set in Settings, Forecast alerts. Nothing here names a patient.
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonClass } from "@/components/wf";
import { edHref } from "@/components/ward-management/shell/ward-facade";
import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { BED_KIND_LABEL, kindRangeWord } from "./forecast-by-kind";
import type { ForecastAlert } from "./forecast-alerts";
import { forecastEdName, useForecastAlerts } from "./use-forecast-model";
import styles from "./forecast.module.css";

export function ForecastAlertsGroup({
  now,
  className,
  head,
}: {
  now: Instant;
  className?: string;
  head: (count: number) => ReactNode;
}) {
  const alerts = useForecastAlerts(now);
  if (alerts.length === 0) return null;
  return (
    <section className={className} aria-label="Forecast" data-testid="ward-alerts-forecast">
      {head(alerts.length)}
      <ul className={styles.alertList}>
        {alerts.map((alert) => (
          <ForecastAlertRow key={alertKey(alert)} alert={alert} now={now} />
        ))}
      </ul>
      <p className={styles.alertCaption}>Forecast alerts are counts against your lines in Settings, Forecast alerts.</p>
    </section>
  );
}

function alertKey(alert: ForecastAlert): string {
  if (alert.kind === "kind_short") return `short-${alert.id}`;
  if (alert.kind === "ed_access_risk") return `ed-${alert.edId}`;
  return "worse";
}

function ForecastAlertRow({ alert, now }: { alert: ForecastAlert; now: Instant }) {
  const row = (title: string, body: string, href: string, action: string) => (
    <li className={styles.alertRow} data-testid={`ward-alerts-forecast-${alertKey(alert)}`}>
      <span>
        <span className={styles.alertTitle}>{title}</span>
        <span className={styles.sub}>{body}</span>
      </span>
      <Link href={href} className={buttonClass({ variant: "sec", size: "sm" })}>
        {action}
      </Link>
    </li>
  );
  switch (alert.kind) {
    case "kind_short":
      return row(
        `${BED_KIND_LABEL[alert.id]} short tomorrow`,
        `Likely ${kindRangeWord(alert.likely)}, at worst ${kindRangeWord(alert.low)}. Your line is ${alert.threshold} short.`,
        "/ward-flow/capacity",
        "See forecast",
      );
    case "ed_access_risk":
      return row(
        `May pass the ED access target at ${forecastEdName(alert.edId)}`,
        `${alert.people} ${alert.people === 1 ? "person passes" : "people pass"} the access target before a suitable bed is due, first in ${splitDuration(alert.firstMinutesLeft)}.${
          alert.alreadyOver > 0 ? ` ${alert.alreadyOver} already past it.` : ""
        } Your line is ${alert.threshold % 60 === 0 ? `${alert.threshold / 60} hours` : splitDuration(alert.threshold)} ahead.`,
        edHref(alert.edId),
        "See who",
      );
    case "forecast_worse":
      return row(
        "Forecast got worse",
        `Tomorrow moved from ${kindRangeWord(alert.from)} to ${kindRangeWord(alert.to)} since you looked at ${formatInstantWithDay(alert.since, now)}. Alert set at a drop of ${alert.threshold} or more beds (Settings).`,
        "/ward-flow/capacity",
        "See forecast",
      );
  }
}

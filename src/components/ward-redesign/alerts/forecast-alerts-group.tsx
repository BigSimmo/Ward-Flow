"use client";

// Copy of src/components/ward-management/forecast/forecast-alerts-group.tsx (Round 2): the action stacks
// under the text on phone, and the caption sentence is a short Settings link (each row already names
// its line in Settings).
//
// The Alerts screen's Forecast group, between Act now and Waiting (forecasting build, Josh,
// 23 Oct 2026, screen 6). Coordinators only (decision 3). Each row is a count crossing a line the
// coordinator set in Settings, Forecast alerts. Nothing here names a patient.
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonClass } from "@/components/wf";
import { edHref, settingsHref } from "@/components/ward-management/shell/ward-facade";
import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { BED_KIND_LABEL, kindRangeWord } from "@/components/ward-management/forecast/forecast-by-kind";
import type { ForecastAlert } from "@/components/ward-management/forecast/forecast-alerts";
import { forecastEdName, useForecastAlerts } from "@/components/ward-management/forecast/use-forecast-model";
import styles from "@/components/ward-management/forecast/forecast.module.css";
import redesign from "./alerts-redesign.module.css";

export function ForecastAlertsGroup({
  now,
  className,
  head,
  readOnly = false,
}: {
  now: Instant;
  className?: string;
  head: (count: number) => ReactNode;
  /** A bed manager's view: the coordinator's lines, and no link to an ED screen they cannot open. */
  readOnly?: boolean;
}) {
  const alerts = useForecastAlerts(now);
  if (alerts.length === 0) return null;
  return (
    <section className={className} aria-label="Forecast" data-testid="ward-alerts-forecast">
      {head(alerts.length)}
      <ul className={styles.alertList}>
        {alerts.map((alert) => (
          <ForecastAlertRow key={alertKey(alert)} alert={alert} now={now} readOnly={readOnly} />
        ))}
      </ul>
      <p className={styles.alertCaption}>
        <Link href={settingsHref()} className={redesign.captionLink}>
          {readOnly ? "Lines set by the coordinator in Settings" : "Set in Settings"}
        </Link>
      </p>
    </section>
  );
}

function alertKey(alert: ForecastAlert): string {
  if (alert.kind === "kind_short") return `short-${alert.id}`;
  if (alert.kind === "ed_access_risk") return `ed-${alert.edId}`;
  return "worse";
}

/** W-10 (fresh audit 26 Oct 2026): every alert line names its unit, so "3" is never read as hours. */
function bedsWord(count: number): string {
  return `${count} ${count === 1 ? "bed" : "beds"}`;
}

function ForecastAlertRow({ alert, now, readOnly }: { alert: ForecastAlert; now: Instant; readOnly: boolean }) {
  const row = (title: string, body: string, href: string | null, action: string) => (
    <li
      className={`${styles.alertRow} ${redesign.forecastRow}`}
      data-testid={`ward-alerts-forecast-${alertKey(alert)}`}
    >
      <span>
        <span className={styles.alertTitle}>{title}</span>
        <span className={styles.sub}>{body}</span>
      </span>
      {href === null ? null : (
        <Link href={href} className={buttonClass({ variant: "sec", size: "sm" })}>
          {action}
        </Link>
      )}
    </li>
  );
  switch (alert.kind) {
    case "kind_short":
      return row(
        `${BED_KIND_LABEL[alert.id]} short tomorrow`,
        `Likely ${kindRangeWord(alert.likely)}, at worst ${kindRangeWord(alert.low)}. Alert set at ${bedsWord(alert.threshold)} or more short (Settings).`,
        "/ward-flow/capacity",
        "See forecast",
      );
    case "ed_access_risk":
      return row(
        `May pass the ED access target at ${forecastEdName(alert.edId)}`,
        `${alert.people} ${alert.people === 1 ? "person passes" : "people pass"} the access target before a suitable bed is due, first in ${splitDuration(alert.firstMinutesLeft)}.${
          alert.alreadyOver > 0 ? ` ${alert.alreadyOver} already past it.` : ""
        } Alert set at ${alert.threshold % 60 === 0 ? `${alert.threshold / 60} ${alert.threshold === 60 ? "hour" : "hours"}` : splitDuration(alert.threshold)} before the target (Settings).`,
        readOnly ? null : edHref(alert.edId),
        "See who",
      );
    case "forecast_worse":
      return row(
        "Forecast got worse",
        `Tomorrow moved from ${kindRangeWord(alert.from)} to ${kindRangeWord(alert.to)} since you looked at ${formatInstantWithDay(alert.since, now)}. Alert set at a drop of ${bedsWord(alert.threshold)} or more (Settings).`,
        "/ward-flow/capacity",
        "See forecast",
      );
  }
}

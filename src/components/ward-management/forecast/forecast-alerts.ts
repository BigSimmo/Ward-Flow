// src/components/ward-management/forecast/forecast-alerts.ts
//
// The Alerts screen's Forecast group (forecasting build, Josh, 23 Oct 2026, screen 6). Three rules,
// each checked against a threshold the coordinator sets in Settings. Coordinators only. An alert
// here is a count crossing a line the coordinator chose; it never names a patient.
import type { BedKindId } from "@/components/ward-management/capacity/capacity-derivations";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { EdAccessRisk } from "./ed-access-risk";
import type { ForecastByKind } from "./forecast-by-kind";
import type { ForecastChange } from "./forecast-last-look";

export type ForecastAlertThresholds = { shortBeds: number; edLeadMinutes: number; worseBeds: number };

export type ForecastAlert =
  | { kind: "kind_short"; id: BedKindId; likely: number; low: number; threshold: number }
  | {
      kind: "ed_access_risk";
      edId: string;
      people: number;
      firstMinutesLeft: number;
      alreadyOver: number;
      threshold: number;
    }
  | { kind: "forecast_worse"; from: number; to: number; since: Instant; threshold: number };

export function forecastAlerts(
  tomorrow: ForecastByKind,
  risk: EdAccessRisk,
  change: ForecastChange | undefined,
  thresholds: ForecastAlertThresholds,
): ForecastAlert[] {
  const alerts: ForecastAlert[] = [];
  for (const kind of [...tomorrow.kinds].sort((a, b) => a.likely - b.likely)) {
    if (kind.likely <= -thresholds.shortBeds) {
      alerts.push({
        kind: "kind_short",
        id: kind.id,
        likely: kind.likely,
        low: kind.low,
        threshold: thresholds.shortBeds,
      });
    }
  }
  for (const ed of risk.byEd) {
    const soon = risk.atRisk.filter((row) => row.edId === ed.edId && row.minutesLeft <= thresholds.edLeadMinutes);
    if (soon.length === 0) continue;
    alerts.push({
      kind: "ed_access_risk",
      edId: ed.edId,
      people: soon.length,
      firstMinutesLeft: soon[0]!.minutesLeft,
      alreadyOver: ed.alreadyOver,
      threshold: thresholds.edLeadMinutes,
    });
  }
  if (change && change.delta <= -thresholds.worseBeds) {
    alerts.push({
      kind: "forecast_worse",
      from: change.from,
      to: change.to,
      since: change.since,
      threshold: thresholds.worseBeds,
    });
  }
  return alerts;
}

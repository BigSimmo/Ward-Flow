// src/components/ward-management/forecast/forecast-alert-defaults.ts
//
// The three forecast alert rules in Settings (forecasting build, Josh, 23 Oct 2026, screen 7).
// Labelled defaults chosen with the mock-up, not service standards. Kept apart from the forecast
// engine so `ward-configuration.ts` can read them without loading it.

/** Alert when a bed type's likely figure for tomorrow is this many beds short, or worse. */
export const FORECAST_SHORT_ALERT_BEDS = 3;
export const FORECAST_SHORT_ALERT_RANGE_BEDS = { min: 1, max: 20, step: 1 } as const;

/** Alert when someone in ED will pass the access target within this many minutes. */
export const FORECAST_ED_RISK_LEAD_MINUTES = 12 * 60;
export const FORECAST_ED_RISK_LEAD_RANGE_MINUTES = { min: 2 * 60, max: 24 * 60, step: 60 } as const;

/** Alert when tomorrow's likely figure has dropped by this many beds since the last look. */
export const FORECAST_WORSE_ALERT_BEDS = 2;
export const FORECAST_WORSE_ALERT_RANGE_BEDS = { min: 1, max: 10, step: 1 } as const;

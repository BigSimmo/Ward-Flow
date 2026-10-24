"use client";

// src/components/ward-management/forecast/use-forecast-model.ts
//
// One place every forecasting screen reads its figures from (forecasting build, Josh, 23 Oct 2026).
// Home, Capacity, ED, the bed meeting, Alerts and Statistics all call this hook with their own clock,
// so the same records give the same figure on every screen. Pure engine calls only; nothing here
// writes a record.
import { useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { SharedAccessContext } from "@/components/ward-management/shell/ward-shared-access-context";
import { demoDayZero, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import { edAccessRisk } from "./ed-access-risk";
import {
  FORECAST_ED_RISK_LEAD_MINUTES,
  FORECAST_SHORT_ALERT_BEDS,
  FORECAST_WORSE_ALERT_BEDS,
} from "@/components/ward-management/ward-operational-defaults";
import { forecastAlerts, type ForecastAlertThresholds } from "./forecast-alerts";
import { forecastByKind } from "./forecast-by-kind";
import { forecastHorizonDays } from "./forecast-horizon";
import {
  FORECAST_LAST_LOOK_STORAGE_KEY,
  forecastChangeSinceLook,
  parseForecastLook,
  takeForecastLook,
  writeForecastLook,
} from "./forecast-last-look";
import {
  FORECAST_HISTORY_STORAGE_KEY,
  forecastTrackRecord,
  historyEntry,
  parseForecastHistory,
  recordForecastHistory,
} from "./forecast-history";
import { blockerGroups, forecastLevers, notYetCounted } from "./forecast-levers";
import {
  FORECAST_MISS_REASONS_STORAGE_KEY,
  parseForecastMissReasons,
  recordForecastMissReason,
  type ForecastMissReasonEntry,
} from "./forecast-miss-reasons";

/** "Peel ED" style name for an emergency department id; never a different department. */
export function forecastEdName(edId: string): string {
  return edShortName(edById(edId)) || "ED not recorded";
}

export function useForecastModel(now: Instant) {
  const {
    units,
    bedReleases,
    admissions,
    movements,
    plannedAdmissions,
    leaveBeds,
    repatriations,
    configuration,
    dayZero: recordedDayZero,
  } = useWardFlowSelect(
    "units",
    "bedReleases",
    "admissions",
    "movements",
    "plannedAdmissions",
    "leaveBeds",
    "repatriations",
    "configuration",
    "dayZero",
  );
  const planned = useMemo(() => plannedAdmissions ?? [], [plannedAdmissions]);
  // A test or preview world may carry no day 0; fall back the way the search previews do.
  const dayZero = useMemo(() => recordedDayZero ?? demoDayZero(new Date()), [recordedDayZero]);
  const horizons = useMemo(() => forecastHorizonDays(now, dayZero), [now, dayZero]);
  const byDays = useMemo(
    () => horizons.map((days) => forecastByKind(units, bedReleases, admissions, movements, now, days, planned)),
    [horizons, units, bedReleases, admissions, movements, now, planned],
  );
  const levers = useMemo(
    () => forecastLevers(units, bedReleases, admissions, now),
    [units, bedReleases, admissions, now],
  );
  const blockers = useMemo(() => blockerGroups(units, admissions), [units, admissions]);
  const notCounted = useMemo(
    () => notYetCounted(units, leaveBeds, repatriations ?? [], admissions),
    [units, leaveBeds, repatriations, admissions],
  );
  const risk = useMemo(
    () => edAccessRisk(movements, units, bedReleases, admissions, now, configuration.edAccessTargetMinutes),
    [movements, units, bedReleases, admissions, now, configuration.edAccessTargetMinutes],
  );
  const thresholds: ForecastAlertThresholds = useMemo(
    () => ({
      shortBeds: configuration.forecastShortBeds ?? FORECAST_SHORT_ALERT_BEDS,
      edLeadMinutes: configuration.forecastEdLeadMinutes ?? FORECAST_ED_RISK_LEAD_MINUTES,
      worseBeds: configuration.forecastWorseBeds ?? FORECAST_WORSE_ALERT_BEDS,
    }),
    [configuration.forecastShortBeds, configuration.forecastEdLeadMinutes, configuration.forecastWorseBeds],
  );
  return {
    tomorrow: byDays[0]!,
    byDays,
    horizons,
    levers,
    blockers,
    notCounted,
    risk,
    thresholds,
    dayZero,
    units,
    admissions,
    planned,
  };
}

export type ForecastModel = ReturnType<typeof useForecastModel>;

/** Fired after a same-tab write; the native `storage` event only reaches other tabs. */
const CHANGE_EVENT = "ward-flow-forecast-look-change";
const pendingSaves = new Map<string, number>();

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readStored(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

const serverLook = () => null;

/**
 * "Since you looked": the change in tomorrow's figure since this person last left a forecast view.
 * `remember` views (Capacity's forecast) save the picture when they are left, never when they open,
 * so the person's own actions there are not reported back as news. Alerts only reads it.
 */
export function useForecastChange(model: ForecastModel, now: Instant, { remember }: { remember: boolean }) {
  const { scenario, worldGeneration } = useWardFlowSelect("scenario", "worldGeneration");
  const account = useContext(SharedAccessContext);
  const userId = account?.actorId ?? "local-demo";
  const key = `${FORECAST_LAST_LOOK_STORAGE_KEY}:${encodeURIComponent(userId)}`;
  const current = useMemo(
    () => takeForecastLook({ scenario, worldGeneration, userId }, model.tomorrow, now),
    [scenario, worldGeneration, userId, model.tomorrow, now],
  );
  const latest = useRef(current);
  useEffect(() => {
    latest.current = current;
  }, [current]);
  const stored = useSyncExternalStore(subscribe, () => readStored(key), serverLook);
  const previous = useMemo(() => parseForecastLook(stored), [stored]);

  useEffect(() => {
    if (!remember) return;
    const timer = pendingSaves.get(key);
    if (timer !== undefined) window.clearTimeout(timer);
    pendingSaves.delete(key);
    const save = () => {
      writeForecastLook(latest.current, key);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    };
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("pagehide", save);
      // React's development double mount unmounts and remounts at once; saving there would
      // overwrite the picture before it was compared, so the save waits one task.
      pendingSaves.set(
        key,
        window.setTimeout(() => {
          pendingSaves.delete(key);
          save();
        }, 0),
      );
    };
  }, [key, remember]);

  return useMemo(() => forecastChangeSinceLook(previous, current), [previous, current]);
}

/** The Forecast group's alerts for a coordinator: the three Settings rules checked now. */
export function useForecastAlerts(now: Instant) {
  const model = useForecastModel(now);
  const change = useForecastChange(model, now, { remember: false });
  const { tomorrow, risk, thresholds } = model;
  return useMemo(() => forecastAlerts(tomorrow, risk, change, thresholds), [tomorrow, risk, change, thresholds]);
}

const HISTORY_EVENT = "ward-flow-forecast-history-change";

function subscribeHistory(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(HISTORY_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(HISTORY_EVENT, onChange);
  };
}

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * The daily forecast snapshots behind the track record. Every forecast view records today's entry
 * once (a second view the same demo day changes nothing). Kept per scenario, reseed and person.
 */
export function useForecastHistory(model: ForecastModel, now: Instant) {
  const { scenario, worldGeneration } = useWardFlowSelect("scenario", "worldGeneration");
  const account = useContext(SharedAccessContext);
  // A reseed restarts the demo days, so it starts a fresh history rather than comparing two worlds.
  const key = `${FORECAST_HISTORY_STORAGE_KEY}:${encodeURIComponent(account?.actorId ?? "local-demo")}:${scenario}:${worldGeneration}`;
  const stored = useSyncExternalStore(subscribeHistory, () => readLocal(key), serverLook);
  const history = useMemo(() => parseForecastHistory(stored), [stored]);
  const entry = useMemo(() => historyEntry(now, model.tomorrow.total.now, model.tomorrow.total), [now, model.tomorrow]);
  useEffect(() => {
    const before = parseForecastHistory(readLocal(key));
    if (before.some((existing) => existing.day === entry.day)) return;
    const next = recordForecastHistory(before, entry);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Private windows and full storage simply keep no history.
    }
    window.dispatchEvent(new Event(HISTORY_EVENT));
  }, [key, entry]);
  return useMemo(() => ({ history, record: forecastTrackRecord(history) }), [history]);
}

// Closing-the-loop features (Josh, 24 Oct 2026): reasons a person records for forecast misses.
const MISS_REASONS_EVENT = "ward-flow-forecast-miss-reasons-change";

function subscribeMissReasons(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(MISS_REASONS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(MISS_REASONS_EVENT, onChange);
  };
}

/**
 * The reasons recorded against the track record's missed days, kept under the same person,
 * scenario and reseed as the snapshots they explain. Only `record` writes, and only when a person
 * chooses a reason; nothing here assigns one.
 */
export function useForecastMissReasons() {
  const { scenario, worldGeneration } = useWardFlowSelect("scenario", "worldGeneration");
  const account = useContext(SharedAccessContext);
  const key = `${FORECAST_MISS_REASONS_STORAGE_KEY}:${encodeURIComponent(account?.actorId ?? "local-demo")}:${scenario}:${worldGeneration}`;
  const stored = useSyncExternalStore(subscribeMissReasons, () => readLocal(key), serverLook);
  const entries = useMemo(() => parseForecastMissReasons(stored), [stored]);
  const record = useCallback(
    (entry: ForecastMissReasonEntry) => {
      const next = recordForecastMissReason(parseForecastMissReasons(readLocal(key)), entry);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Private windows and full storage keep no reasons, the same as the snapshots.
      }
      window.dispatchEvent(new Event(MISS_REASONS_EVENT));
    },
    [key],
  );
  return { entries, record };
}

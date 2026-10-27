"use client";

// src/components/ward-management/forecast/use-forecast-model.ts
//
// One place every forecasting screen reads its figures from (forecasting build, Josh, 23 Oct 2026).
// Home, Capacity, ED, the bed meeting, Alerts and Statistics all call this hook with their own clock,
// so the same records give the same figure on every screen. Pure engine calls only; nothing here
// writes a record.
import { useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { SharedAccessContext } from "@/components/ward-management/shell/ward-shared-access-context";
import {
  noteWardSessionAccount,
  wardLeaveSaveAllowed,
  wardLeaveSaveTicket,
} from "@/components/ward-management/ward-browser-data";
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
import { useSharedForecastHistory } from "./forecast-shared-history";

/** "Peel ED" style name for an emergency department id; never a different department. */
export function forecastEdName(edId: string): string {
  return edShortName(edById(edId)) || "ED not recorded";
}

/**
 * H-0359 (USC-08, 27 Oct 2026): a screen shows several forecast panels, and each calls
 * `useForecastModel`, so each used to run the whole forecast again for the same records and clock.
 * The last few results are kept here and reused while every input is the same (compared by
 * reference, as the store hands every panel the same records). Pure engine results only.
 */
const FORECAST_CACHE_SIZE = 4;
const NO_PLANNED: NonNullable<Parameters<typeof forecastByKind>[6]> = [];
const NO_REPATRIATIONS: Parameters<typeof notYetCounted>[2] = [];
const forecastCache: { readonly inputs: readonly unknown[]; readonly parts: ForecastParts }[] = [];

function computeForecastParts(
  units: Parameters<typeof forecastByKind>[0],
  bedReleases: Parameters<typeof forecastByKind>[1],
  admissions: Parameters<typeof forecastByKind>[2],
  movements: Parameters<typeof forecastByKind>[3],
  planned: NonNullable<Parameters<typeof forecastByKind>[6]>,
  leaveBeds: Parameters<typeof notYetCounted>[1],
  repatriations: Parameters<typeof notYetCounted>[2],
  now: Instant,
  dayZero: Date,
  edAccessTargetMinutes: Parameters<typeof edAccessRisk>[5],
) {
  const horizons = forecastHorizonDays(now, dayZero);
  return {
    horizons,
    byDays: horizons.map((days) => forecastByKind(units, bedReleases, admissions, movements, now, days, planned)),
    levers: forecastLevers(units, bedReleases, admissions, now),
    blockers: blockerGroups(units, admissions),
    notCounted: notYetCounted(units, leaveBeds, repatriations, admissions),
    risk: edAccessRisk(movements, units, bedReleases, admissions, now, edAccessTargetMinutes),
  };
}

type ForecastParts = ReturnType<typeof computeForecastParts>;

function sharedForecastParts(...inputs: Parameters<typeof computeForecastParts>): ForecastParts {
  const key = inputs.map((input) => (input instanceof Date ? input.getTime() : input));
  const hit = forecastCache.find((entry) => entry.inputs.every((input, index) => Object.is(input, key[index])));
  if (hit) return hit.parts;
  const parts = computeForecastParts(...inputs);
  forecastCache.unshift({ inputs: key, parts });
  forecastCache.length = Math.min(forecastCache.length, FORECAST_CACHE_SIZE);
  return parts;
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
  const planned = useMemo(() => plannedAdmissions ?? NO_PLANNED, [plannedAdmissions]);
  // A test or preview world may carry no day 0; fall back the way the search previews do.
  const dayZero = useMemo(() => recordedDayZero ?? demoDayZero(new Date()), [recordedDayZero]);
  const { horizons, byDays, levers, blockers, notCounted, risk } = useMemo(
    () =>
      sharedForecastParts(
        units,
        bedReleases,
        admissions,
        movements,
        planned,
        leaveBeds,
        repatriations ?? NO_REPATRIATIONS,
        now,
        dayZero,
        configuration.edAccessTargetMinutes,
      ),
    [
      units,
      bedReleases,
      admissions,
      movements,
      planned,
      leaveBeds,
      repatriations,
      now,
      dayZero,
      configuration.edAccessTargetMinutes,
    ],
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
  noteWardSessionAccount(account);
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
    const ticket = wardLeaveSaveTicket(account);
    const save = () => {
      // Audit 4 A4-07: never write after the session that owned this picture ended, including a
      // save scheduled by the signed-out re-render just before the screen closes.
      if (!wardLeaveSaveAllowed(ticket) || latest.current.userId !== userId) return;
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
  }, [key, remember, account, userId]);

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
 * P-5 (fresh audit 26 Oct 2026): each reseed or scenario switch starts a new key, so the keys this
 * person wrote for earlier worlds are removed when the current one is written. Otherwise the local
 * demo, which no sign-out ever sweeps, collected one set per reset with no bound. Another person's
 * keys on a shared device are left alone.
 */
function dropEarlierWorlds(key: string) {
  const person = key.slice(0, key.indexOf(":", key.indexOf(":") + 1) + 1);
  try {
    const stale: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const candidate = window.localStorage.key(index);
      if (candidate !== null && candidate !== key && candidate.startsWith(person)) stale.push(candidate);
    }
    for (const candidate of stale) window.localStorage.removeItem(candidate);
  } catch {
    // Storage that cannot be listed is left as it is.
  }
}

/**
 * The daily forecast snapshots behind the track record. Every forecast view records today's entry
 * once (a second view the same demo day changes nothing). Kept per scenario, reseed and person in
 * this browser, and, once the server has migration 16, shared by the desk (proposal 013): then the
 * desk's shared history is the one shown, and the browser's copy is only the fallback.
 */
export function useForecastHistory(model: ForecastModel, now: Instant) {
  const { scenario, worldGeneration } = useWardFlowSelect("scenario", "worldGeneration");
  const account = useContext(SharedAccessContext);
  // A reseed restarts the demo days, so it starts a fresh history rather than comparing two worlds.
  const key = `${FORECAST_HISTORY_STORAGE_KEY}:${encodeURIComponent(account?.actorId ?? "local-demo")}:${scenario}:${worldGeneration}`;
  const stored = useSyncExternalStore(subscribeHistory, () => readLocal(key), serverLook);
  const history = useMemo(() => parseForecastHistory(stored), [stored]);
  const entry = useMemo(() => historyEntry(now, model.tomorrow.total.now, model.tomorrow.total), [now, model.tomorrow]);
  const shared = useSharedForecastHistory(worldGeneration);
  const sharedHistory = shared.state.status === "shared" ? shared.state.snapshots : null;
  const { send } = shared;
  const sharedHasToday = sharedHistory?.some((existing) => existing.day === entry.day) ?? true;
  // One try a demo day: a refused or failed send is not repeated with every clock tick.
  const sentDay = useRef<string | null>(null);
  useEffect(() => {
    const attempt = `${worldGeneration}:${entry.day}`;
    if (sharedHasToday || sentDay.current === attempt) return;
    sentDay.current = attempt;
    void send({ snapshot: entry });
  }, [sharedHasToday, send, entry, worldGeneration]);
  useEffect(() => {
    const before = parseForecastHistory(readLocal(key));
    if (before.some((existing) => existing.day === entry.day)) return;
    const next = recordForecastHistory(before, entry);
    dropEarlierWorlds(key);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Private windows and full storage simply keep no history.
    }
    window.dispatchEvent(new Event(HISTORY_EVENT));
  }, [key, entry]);
  const shown = sharedHistory ?? history;
  return useMemo(() => ({ history: shown, record: forecastTrackRecord(shown) }), [shown]);
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
 * scenario and reseed as the snapshots they explain, and shared by the desk with them once the
 * server has migration 16. Only `record` writes, and only when a person chooses a reason; nothing
 * here assigns one.
 */
export function useForecastMissReasons() {
  const { scenario, worldGeneration } = useWardFlowSelect("scenario", "worldGeneration");
  const account = useContext(SharedAccessContext);
  const key = `${FORECAST_MISS_REASONS_STORAGE_KEY}:${encodeURIComponent(account?.actorId ?? "local-demo")}:${scenario}:${worldGeneration}`;
  const stored = useSyncExternalStore(subscribeMissReasons, () => readLocal(key), serverLook);
  const local = useMemo(() => parseForecastMissReasons(stored), [stored]);
  const { state: shared, send } = useSharedForecastHistory(worldGeneration);
  // A reason chosen here shows at once and stays shown until the desk's shared record has it. A
  // save that fails is tried again whenever the shared history is read again, never dropped.
  const [unsaved, setUnsaved] = useState<{ key: string; entries: ForecastMissReasonEntry[] }>({ key, entries: [] });
  const pending = useMemo(() => (unsaved.key === key ? unsaved.entries : []), [unsaved, key]);
  const entries = useMemo(
    () => (shared.status === "shared" ? [...shared.reasons, ...pending] : local),
    [shared, pending, local],
  );
  useEffect(() => {
    if (shared.status !== "shared") return;
    for (const entry of pending)
      void send({ reason: entry }).then((saved) => {
        if (saved)
          setUnsaved((held) => (held.key === key ? { key, entries: held.entries.filter((e) => e !== entry) } : held));
      });
  }, [shared, pending, send, key]);
  const record = useCallback(
    (entry: ForecastMissReasonEntry) => {
      setUnsaved((held) => ({ key, entries: [...(held.key === key ? held.entries : []), entry] }));
      const next = recordForecastMissReason(parseForecastMissReasons(readLocal(key)), entry);
      dropEarlierWorlds(key);
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

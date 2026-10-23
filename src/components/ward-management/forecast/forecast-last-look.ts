// src/components/ward-management/forecast/forecast-last-look.ts
//
// "Since you looked" on the network forecast (forecasting build, Josh, 23 Oct 2026, screen 3), and
// the "Forecast got worse" alert. Compares tomorrow's figure now with the figure when the
// coordinator last left the forecast, and says which recorded parts moved.
//
// 🔒 **THE REMEMBERED PICTURE HOLDS COUNTS AND ONE DEMO INSTANT. NEVER A NAME, AN ID OR ANY TYPED
// TEXT.** Same rules and lifetime as `coordinator/since-last-look.ts` (sessionStorage), under its
// own key so the two never read each other's picture.
import type { BedKindId } from "@/components/ward-management/capacity/capacity-derivations";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { kindRangeWord, type ForecastByKind } from "./forecast-by-kind";

export const FORECAST_LAST_LOOK_STORAGE_KEY = "ward-flow-forecast-last-look";

const PARTS = ["waiting", "bedsThatFit", "confirmed", "expected", "heldUp", "overdue", "plannedAdmissions"] as const;
type Part = (typeof PARTS)[number];

export type ForecastLookSnapshot = {
  version: 1;
  scenario: string;
  worldGeneration: number;
  userId: string;
  at: Instant;
  likely: number;
  kinds: Record<BedKindId, number>;
  parts: Record<Part, number>;
};

export type ForecastLookWorld = { scenario: string; worldGeneration?: number; userId?: string };

export function takeForecastLook(
  world: ForecastLookWorld,
  tomorrow: ForecastByKind,
  now: Instant,
): ForecastLookSnapshot {
  const kinds = Object.fromEntries(tomorrow.kinds.map((kind) => [kind.id, kind.likely])) as Record<BedKindId, number>;
  const parts = Object.fromEntries(PARTS.map((part) => [part, tomorrow.total[part]])) as Record<Part, number>;
  return {
    version: 1,
    scenario: world.scenario,
    worldGeneration: world.worldGeneration ?? 0,
    userId: world.userId ?? "local-demo",
    at: now,
    likely: tomorrow.total.likely,
    kinds,
    parts,
  };
}

export type ForecastChange = {
  since: Instant;
  from: number;
  to: number;
  /** Positive when tomorrow got better (more spare or fewer short). */
  delta: number;
  reasons: string[];
  /** Bed types whose likely figure fell, worst first. */
  worseKinds: { id: BedKindId; from: number; to: number }[];
};

/** Undefined when there is no earlier look to compare with in this scenario and session. */
export function forecastChangeSinceLook(
  previous: ForecastLookSnapshot | undefined,
  current: ForecastLookSnapshot,
): ForecastChange | undefined {
  if (
    !previous ||
    previous.scenario !== current.scenario ||
    previous.worldGeneration !== current.worldGeneration ||
    previous.userId !== current.userId ||
    previous.at > current.at
  )
    return undefined;
  const moved = (part: Part) => current.parts[part] - previous.parts[part];
  const reasons: string[] = [];
  const waiting = moved("waiting");
  if (waiting !== 0)
    reasons.push(`${count(Math.abs(waiting), "more", "fewer")(waiting)} ${people(waiting)} waiting for a bed`);
  const fit = moved("bedsThatFit");
  if (fit !== 0) reasons.push(`${count(Math.abs(fit), "more", "fewer")(fit)} ${beds(fit)} ready now`);
  const heldUp = moved("heldUp");
  if (heldUp !== 0) reasons.push(`${count(Math.abs(heldUp), "more", "fewer")(heldUp)} ${releases(heldUp)} held up`);
  const due = moved("confirmed") + moved("expected");
  if (due !== 0) reasons.push(`${count(Math.abs(due), "more", "fewer")(due)} ${releases(due)} due`);
  const planned = moved("plannedAdmissions");
  if (planned !== 0)
    reasons.push(
      `${count(Math.abs(planned), "more", "fewer")(planned)} planned ${planned === 1 || planned === -1 ? "admission" : "admissions"}`,
    );
  const worseKinds = (Object.keys(current.kinds) as BedKindId[])
    .filter((id) => previous.kinds[id] !== undefined && current.kinds[id] < previous.kinds[id])
    .map((id) => ({ id, from: previous.kinds[id], to: current.kinds[id] }))
    .sort((a, b) => a.to - a.from - (b.to - b.from));
  return {
    since: previous.at,
    from: previous.likely,
    to: current.likely,
    delta: current.likely - previous.likely,
    reasons,
    worseKinds,
  };
}

/** "Since you looked at 09:00, tomorrow moved from 9 short to 13 short. 2 more people waiting for a bed." */
export function forecastChangeSentence(change: ForecastChange): string {
  const head =
    change.delta === 0
      ? `Since you looked at ${formatInstant(change.since)}, tomorrow is unchanged at ${kindRangeWord(change.to)}.`
      : `Since you looked at ${formatInstant(change.since)}, tomorrow moved from ${kindRangeWord(change.from)} to ${kindRangeWord(change.to)}.`;
  if (change.reasons.length === 0) return head;
  const list =
    change.reasons.length === 1
      ? change.reasons[0]!
      : `${change.reasons.slice(0, -1).join(", ")} and ${change.reasons.at(-1)}`;
  return `${head} ${list.charAt(0).toUpperCase()}${list.slice(1)}.`;
}

/** Accepts only a well-formed picture; anything else reads as "no previous look". */
export function parseForecastLook(raw: string | null): ForecastLookSnapshot | undefined {
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const whole = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v);
    const record = (v: unknown, keys: readonly string[]) =>
      typeof v === "object" &&
      v !== null &&
      !Array.isArray(v) &&
      keys.every((key) => whole((v as Record<string, unknown>)[key]));
    if (
      value.version !== 1 ||
      typeof value.scenario !== "string" ||
      !whole(value.worldGeneration) ||
      typeof value.userId !== "string" ||
      typeof value.at !== "number" ||
      !Number.isFinite(value.at) ||
      !whole(value.likely) ||
      !record(value.kinds, ["locked_adult", "open_adult", "older_adult", "youth"]) ||
      !record(value.parts, PARTS)
    )
      return undefined;
    return value as unknown as ForecastLookSnapshot;
  } catch {
    return undefined;
  }
}

export function readForecastLook(key = FORECAST_LAST_LOOK_STORAGE_KEY): ForecastLookSnapshot | undefined {
  try {
    return parseForecastLook(window.sessionStorage.getItem(key));
  } catch {
    return undefined;
  }
}

export function writeForecastLook(snapshot: ForecastLookSnapshot, key = FORECAST_LAST_LOOK_STORAGE_KEY): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // Private windows and full storage simply lose the comparison.
  }
}

function count(abs: number, up: string, down: string) {
  return (signed: number) => `${abs} ${signed > 0 ? up : down}`;
}
function people(n: number) {
  return Math.abs(n) === 1 ? "person" : "people";
}
function beds(n: number) {
  return Math.abs(n) === 1 ? "bed" : "beds";
}
function releases(n: number) {
  return Math.abs(n) === 1 ? "release" : "releases";
}

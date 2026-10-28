/**
 * Which desks' first-run tours this device has seen, and the event that opens Help.
 *
 * The seen list lives under `TOUR_SEEN_STORAGE_KEY`, which carries the `ward_flow_choice_` prefix
 * that `ward-browser-data.ts` keeps at sign-out: the next person at a ward computer has usually used
 * it before, and a tour that reappeared at every sign-in would be noise. It holds desk role ids only,
 * each checked against the known desks on read, so no typed text reaches storage (D-11, D-18). The
 * step each tour was left at sits beside it under the same prefix, as role ids and step numbers.
 * Whether the tour has already started on its own on this device is kept in `ward-tour-auto-start.tsx`.
 */
import { createBrowserStore } from "@/lib/client-store-factory";
import { useShellPersonaRole } from "@/components/ward-management/settings/persona-sync";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { CHROME_ROLE_LABELS, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";

/** A desk with its own tour: the chrome roles and the access admin. */
export type WardTourRole = WardChromeRole | "admin";

const tourRoles = new Set<string>([...Object.keys(CHROME_ROLE_LABELS), "admin"]);

/** The desk whose tour applies: the shell's role, or the access admin, whom the chrome shows as executive. */
export function useTourRole(): WardTourRole {
  const role = useShellPersonaRole();
  const access = useEffectiveWardAccess();
  return access.role === "admin" ? "admin" : role;
}

export const TOUR_SEEN_STORAGE_KEY = "ward_flow_choice_tour_seen";
const tourSeenChangeEvent = "ward-flow-tour-seen-change";

let inMemoryFallback: string | undefined;

function readRaw(): string {
  if (inMemoryFallback !== undefined) return inMemoryFallback;
  try {
    return window.localStorage.getItem(TOUR_SEEN_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** The desks whose tour was seen or dismissed, from the stored comma-separated list. */
export function parseTourSeen(raw: string): readonly WardTourRole[] {
  return raw.split(",").filter((id): id is WardTourRole => tourRoles.has(id));
}

function subscribeTourSeen(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(tourSeenChangeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(tourSeenChangeEvent, onChange);
  };
}

// The raw string is the snapshot, so it keeps its identity between reads without a cache. The
// server and hydration read `NOT_READ`, so the first client render matches the server's.
const NOT_READ = "not-read";
const useTourSeenRaw = createBrowserStore(subscribeTourSeen, readRaw, NOT_READ);

/**
 * Whether `role`'s tour has been seen on this device. Reads `true` on the server and before the
 * browser store answers, so nothing flashes a "new" marker during hydration.
 */
export function useTourSeen(role: WardTourRole): boolean {
  const raw = useTourSeenRaw();
  return raw === NOT_READ || parseTourSeen(raw).includes(role);
}

/** Records that `role`'s tour was seen or dismissed. */
export function markTourSeen(role: WardTourRole): void {
  const seen = parseTourSeen(readRaw());
  if (seen.includes(role)) return;
  const next = [...seen, role].join(",");
  try {
    window.localStorage.setItem(TOUR_SEEN_STORAGE_KEY, next);
    inMemoryFallback = undefined;
  } catch {
    inMemoryFallback = next;
  }
  window.dispatchEvent(new Event(tourSeenChangeEvent));
}

export const TOUR_STEP_STORAGE_KEY = "ward_flow_choice_tour_step";

/**
 * Where each desk's tour was left, so it picks up there: "role:step" or "role:step:id" entries, a
 * desk role id, a step number and the step's own id. The id matters because the phone and the
 * desktop walk different lists, so a number saved on one can name another subject on the other.
 * Read back through the known desks, so nothing else survives a read.
 */
type SavedTourStep = { readonly at: number; readonly id?: string };

const TOUR_STEP_ID = /^[a-z0-9-]{1,40}$/u;

function parseSavedSteps(raw: string): ReadonlyMap<WardTourRole, SavedTourStep> {
  const steps = new Map<WardTourRole, SavedTourStep>();
  for (const pair of raw.split(",")) {
    const [role, value, id] = pair.split(":");
    const step = Number(value);
    if (!role || !tourRoles.has(role) || !Number.isInteger(step) || step < 0) continue;
    steps.set(role as WardTourRole, id !== undefined && TOUR_STEP_ID.test(id) ? { at: step, id } : { at: step });
  }
  return steps;
}

/** The saved step numbers alone, by desk. */
export function parseTourSteps(raw: string): ReadonlyMap<WardTourRole, number> {
  return new Map([...parseSavedSteps(raw)].map(([role, saved]) => [role, saved.at]));
}

function readSteps(): ReadonlyMap<WardTourRole, SavedTourStep> {
  try {
    return parseSavedSteps(window.localStorage.getItem(TOUR_STEP_STORAGE_KEY) ?? "");
  } catch {
    return new Map();
  }
}

function writeSteps(steps: ReadonlyMap<WardTourRole, SavedTourStep>): void {
  try {
    if (steps.size === 0) window.localStorage.removeItem(TOUR_STEP_STORAGE_KEY);
    else
      window.localStorage.setItem(
        TOUR_STEP_STORAGE_KEY,
        [...steps]
          .map(([role, saved]) => (saved.id ? `${role}:${saved.at}:${saved.id}` : `${role}:${saved.at}`))
          .join(","),
      );
  } catch {
    // Without storage the tour starts from the beginning next time.
  }
}

/** The step `role`'s tour was left at, or 0. */
export function readTourStep(role: WardTourRole): number {
  return readSteps().get(role)?.at ?? 0;
}

/** The id of the step `role`'s tour was left at, when it was saved with one. */
export function readTourStepId(role: WardTourRole): string | undefined {
  return readSteps().get(role)?.id;
}

/** Remembers the subject, including a topic's first step. Zero without an id forgets it. */
export function saveTourStep(role: WardTourRole, step: number, id?: string): void {
  const steps = new Map(readSteps());
  const validId = id !== undefined && TOUR_STEP_ID.test(id);
  if (step > 0 || (step === 0 && validId)) steps.set(role, validId ? { at: step, id } : { at: step });
  else steps.delete(role);
  writeSteps(steps);
}

/** Test-only reset. */
export function resetTourSeenForTests(): void {
  try {
    window.localStorage.removeItem(TOUR_SEEN_STORAGE_KEY);
    window.localStorage.removeItem(TOUR_STEP_STORAGE_KEY);
  } catch {
    // Nothing stored if storage is unreachable.
  }
  inMemoryFallback = undefined;
  window.dispatchEvent(new Event(tourSeenChangeEvent));
}

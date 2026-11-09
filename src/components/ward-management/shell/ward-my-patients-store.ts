/**
 * PINNED PATIENTS: the patients one person pins on this device, so they are listed at the top of Home
 * (feature 31, "My list" pins, 9 Nov 2026). The ward half of the same idea is `ward-my-wards-store.ts`;
 * this store mirrors it.
 *
 * **`localStorage`, swept at sign-out.** A pin survives a reload and a closed tab. The key sits under
 * the `ward-` prefix, so `clearWardFlowBrowserData` removes it at sign-out, and the in-memory copy
 * registers its own reset, so the next person at the device starts with no pins.
 *
 * **Patient record ids only, never a name, a UMRN or typed text (D-11, D-18, D-39).** The stored
 * value is a JSON array of `PT-` record ids, each checked against `PATIENT_ID_PATTERN` and capped at
 * `MY_PATIENTS_LIMIT` on every read. Free text, a stale build's value or tampering reads as "no
 * pins". A pinned id that names no patient in today's world is skipped by the reader that renders
 * it, not here.
 */
import { createBrowserStore } from "@/lib/client-store-factory";
import { onWardSessionEnd } from "@/components/ward-management/ward-browser-data";

import type { PinOutcome } from "./ward-my-wards-store";

export const MY_PATIENTS_STORAGE_KEY = "ward-flow-my-patients";
const myPatientsChangeEvent = "ward-flow-my-patients-change";

/** The same cap as My wards: a longer list stops being a shortcut. */
export const MY_PATIENTS_LIMIT = 8;

/** A patient record id (`PT-003`, `PT-G-WF-101`, `PT-DN-12`): never a UMRN or a name. */
const PATIENT_ID_PATTERN = /^PT-[A-Za-z0-9-]{1,60}$/;

const NO_PINS: readonly string[] = Object.freeze([]);

let inMemoryFallback: readonly string[] | undefined;
// The snapshot must keep its identity between reads, or `useSyncExternalStore` re-renders forever.
let lastRaw: string | null | undefined;
let lastParsed: readonly string[] = NO_PINS;

onWardSessionEnd((scope) => {
  inMemoryFallback = undefined;
  lastRaw = undefined;
  lastParsed = NO_PINS;
  if (typeof window === "undefined" || scope === "tab") return;
  try {
    window.localStorage.removeItem(MY_PATIENTS_STORAGE_KEY);
  } catch {
    // Nothing is stored when storage is unreachable.
  }
  window.dispatchEvent(new Event(myPatientsChangeEvent));
});

/** True for a patient record id this store will keep. */
export function isPinnablePatientId(id: string): boolean {
  return PATIENT_ID_PATTERN.test(id);
}

/** Reads a stored value as pinned patient ids: valid ids only, no repeats, at most `MY_PATIENTS_LIMIT`. */
export function parseMyPatients(raw: string | null): readonly string[] {
  if (raw === null) return NO_PINS;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return NO_PINS;
  }
  if (!Array.isArray(value)) return NO_PINS;
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !PATIENT_ID_PATTERN.test(item) || ids.includes(item)) continue;
    ids.push(item);
    if (ids.length === MY_PATIENTS_LIMIT) break;
  }
  return ids.length === 0 ? NO_PINS : Object.freeze(ids);
}

function getMyPatientsSnapshot(): readonly string[] {
  if (inMemoryFallback !== undefined) return inMemoryFallback;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(MY_PATIENTS_STORAGE_KEY);
  } catch {
    return NO_PINS;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastParsed = parseMyPatients(raw);
  }
  return lastParsed;
}

function subscribeMyPatients(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(myPatientsChangeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(myPatientsChangeEvent, onChange);
  };
}

/** The pinned patient ids, in the order they were pinned. */
export const useMyPatients = createBrowserStore(subscribeMyPatients, getMyPatientsSnapshot, NO_PINS);

function writeMyPatients(next: readonly string[]): void {
  const frozen = next.length === 0 ? NO_PINS : Object.freeze([...next]);
  try {
    if (frozen.length === 0) window.localStorage.removeItem(MY_PATIENTS_STORAGE_KEY);
    else window.localStorage.setItem(MY_PATIENTS_STORAGE_KEY, JSON.stringify(frozen));
    inMemoryFallback = undefined;
  } catch {
    // Private browsing or a full quota: the pins still work for this tab, until a reload.
    inMemoryFallback = frozen;
  }
  window.dispatchEvent(new Event(myPatientsChangeEvent));
}

/** Pins a patient, or unpins them if already pinned. Refuses anything that is not a record id. */
export function toggleMyPatient(patientId: string): PinOutcome {
  if (!PATIENT_ID_PATTERN.test(patientId)) return "refused";
  const current = getMyPatientsSnapshot();
  if (current.includes(patientId)) {
    writeMyPatients(current.filter((id) => id !== patientId));
    return "unpinned";
  }
  if (current.length >= MY_PATIENTS_LIMIT) return "full";
  writeMyPatients([...current, patientId]);
  return "pinned";
}

/** Test-only reset, so one test file's pins never leak into the next. */
export function resetMyPatientsForTests(): void {
  try {
    window.localStorage.removeItem(MY_PATIENTS_STORAGE_KEY);
  } catch {
    // Nothing stored if storage is unreachable.
  }
  inMemoryFallback = undefined;
  lastRaw = undefined;
  lastParsed = NO_PINS;
  window.dispatchEvent(new Event(myPatientsChangeEvent));
}

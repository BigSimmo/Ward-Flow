"use client";

import { useCallback } from "react";

import { useIsPhone } from "@/components/wf";
import { createBrowserStore } from "@/lib/client-store-factory";

/**
 * Discreet names on phone (Settings, Display; audit A2-20, owner approved). Off by default. When on,
 * a phone shows a patient as initials plus UMRN ("TH · UM100001") in its lists, so a name is not
 * read over a shoulder on a ward or in a corridor. Desktop and tablet are unchanged: the hook below
 * only returns the discreet form under the phone query. A per-browser preference like row density;
 * only "on" is written, never a name or typed text.
 */
const KEY = "ward-flow-discreet-names";
const CHANGE = "ward-discreet-names-change";
let fallback: boolean | null = null;

function read(): boolean {
  if (fallback !== null) return fallback;
  try {
    return window.localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

const useStoredDiscreetNames = createBrowserStore<boolean>(subscribe, read, false);

export function useDiscreetNamesSetting(): [boolean, (next: boolean) => void] {
  const on = useStoredDiscreetNames();
  const set = useCallback((next: boolean) => {
    try {
      if (next) window.localStorage.setItem(KEY, "on");
      else window.localStorage.removeItem(KEY);
      fallback = null;
    } catch {
      // Keep the choice for this session when storage is blocked.
      fallback = next;
    }
    window.dispatchEvent(new Event(CHANGE));
  }, []);
  return [on, set];
}

/** A UMRN the resolver could not find; the name is then already initials or "Unknown Patient". */
const NO_UMRN = /not recorded/iu;

/**
 * Initials for a shown name, in spoken order. Reads either "Given Family" or the formal
 * "Family, Given": "Talia Halloway" and "Halloway, Talia" are both "TH".
 */
export function patientInitials(name: string): string {
  const [family, given] = name.includes(",") ? name.split(",", 2) : [undefined, name];
  const ordered = family === undefined ? given.trim().split(/\s+/u) : [...given.trim().split(/\s+/u), family.trim()];
  const letters = ordered.map((part) => part.charAt(0).toUpperCase()).filter(Boolean);
  return letters.length > 1 ? `${letters[0]}${letters[letters.length - 1]}` : letters.join("");
}

/**
 * Initials plus UMRN for a shown name. A name with no recorded UMRN is returned unchanged: it is
 * already initials ("Initials TH") or "Unknown Patient" from the resolver.
 */
export function discreetPatientName(name: string, umrn: string | undefined | null): string {
  if (!umrn || NO_UMRN.test(umrn)) return name;
  const initials = patientInitials(name);
  return initials ? `${initials} · ${umrn}` : umrn;
}

/** True only on a phone with Discreet names on. Desktop and tablet always read false. */
export function useDiscreetNamesOnPhone(): boolean {
  const [on] = useDiscreetNamesSetting();
  const isPhone = useIsPhone();
  return on && isPhone;
}

/**
 * The name a list should print. On a phone with Discreet names on, initials plus UMRN; everywhere
 * else the name exactly as given. Lists call it as `nameFor(info.displayName, info.umrn)`.
 */
export function usePatientNameDisplay(): (name: string, umrn: string | undefined | null) => string {
  const discreet = useDiscreetNamesOnPhone();
  return useCallback((name, umrn) => (discreet ? discreetPatientName(name, umrn) : name), [discreet]);
}

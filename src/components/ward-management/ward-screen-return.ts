import { homeHrefFor, screenDecision, screenForPath, type PlaceLookup, type WardAccess } from "./ward-role-access";

const KEY = "ward-flow:return-screen-v1";
let memory: string | undefined;

/** A known screen pathname only: no origin, encoded record, query, fragment or patient address. */
export function safeScreenReturn(raw: string): string | undefined {
  const path = raw.split(/[?#]/)[0].replace(/\/+$/, "");
  if (!/^\/ward-flow(?:\/[a-z0-9-]+)*$/.test(path)) return undefined;
  const address = screenForPath(path);
  // A patient address always has screen "patient" (screenForPath), so the screen check covers it
  // without reading the patient link (D-14).
  if (!address || address.movementId || address.screen === "patient") return undefined;
  return path;
}

export function authorisedScreenReturn(raw: string, access: WardAccess, places: PlaceLookup): string {
  const path = safeScreenReturn(raw);
  return path && screenDecision(access, screenForPath(path), places).open ? path : homeHrefFor(access, places.teamSlug);
}

/** Call after session cleanup. The next account must still pass its own access check. */
export function rememberScreenReturn(raw: string): void {
  memory = undefined;
  const path = safeScreenReturn(raw) ?? "/ward-flow";
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    memory = path; // A memory-only screen is safe too, used only when storage could not hold it.
  }
}

export function takeScreenReturn(): string | undefined {
  let path = memory;
  try {
    path = sessionStorage.getItem(KEY) ?? memory;
    sessionStorage.removeItem(KEY);
  } catch {
    /* Memory fallback. */
  }
  memory = undefined;
  return path ? safeScreenReturn(path) : undefined;
}

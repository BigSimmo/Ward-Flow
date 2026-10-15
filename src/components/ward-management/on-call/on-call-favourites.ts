/**
 * My list, shared by the On-call page and the Tools sheet's Contacts (Tools review, 15 Oct 2026).
 * Directory ids only, kept on this device. A change made in one place is announced to the other
 * through a window event, because a same-page localStorage write raises no `storage` event.
 */
export const FAVOURITES_KEY = "ward-flow:on-call:favourites";

const FAVOURITES_EVENT = "ward-flow:on-call-favourites";

/** My list saved by the earlier roster page held its role ids; each maps to the same directory line. */
const LEGACY_FAVOURITE_IDS: Record<string, string> = {
  "bed-coordinator": "sw-bfc",
  "governance-lead": "sw-gov",
  "nm-coordinator": "nmhs-bfc",
  "nm-consultant": "nmhs-scon",
  "sm-coordinator": "smhs-bfc",
  "sm-consultant": "smhs-scon",
  "em-coordinator": "emhs-bfc",
  "em-consultant": "emhs-scon",
  "pr-coordinator": "pr-liaison",
};

/** The saved list with older roster ids mapped on, keeping only ids the directory still has. */
export function readFavourites(ids: ReadonlySet<string>): string[] {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(FAVOURITES_KEY) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return [
      ...new Set(
        saved
          .filter((id): id is string => typeof id === "string")
          .map((id) => LEGACY_FAVOURITE_IDS[id] ?? id)
          .filter((id) => ids.has(id)),
      ),
    ];
  } catch {
    return [];
  }
}

/** Saves the list and tells the other surface. False when browser storage is unavailable. */
export function saveFavourites(next: readonly string[]): boolean {
  let saved = true;
  try {
    window.localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
  } catch {
    saved = false;
  }
  window.dispatchEvent(new CustomEvent<readonly string[]>(FAVOURITES_EVENT, { detail: next }));
  return saved;
}

export function subscribeFavourites(listener: (next: string[]) => void): () => void {
  const handle = (event: Event) => listener([...(event as CustomEvent<readonly string[]>).detail]);
  window.addEventListener(FAVOURITES_EVENT, handle);
  return () => window.removeEventListener(FAVOURITES_EVENT, handle);
}

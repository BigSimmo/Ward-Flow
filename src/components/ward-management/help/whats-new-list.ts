/**
 * WHAT'S NEW, ONE FILE PER LINE. Each line lives in its own small file in `whats-new/`, so two
 * pull requests that each add a line never touch the same file. The file name starts with the
 * line's date and a two-digit order for that day (`2026-11-03-12-one-alerts-switch.json`), and the
 * list is those files sorted by name: by date, then by that order. Only the newest
 * `WHATS_NEW_LIMIT` lines are kept, so old files can stay until someone tidies them away.
 */
export type WhatsNewEntry = { readonly id: string; readonly date: string; readonly line: string };

/** The most lines the app loads; older files are left out of the list. */
const WHATS_NEW_LIMIT = 20;

export type WhatsNewFile = { readonly name: string; readonly entry: WhatsNewEntry };

/** Oldest first: sorted by file name, newest `WHATS_NEW_LIMIT` kept. */
export function combineWhatsNew(files: readonly WhatsNewFile[]): WhatsNewEntry[] {
  return files
    .toSorted((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((file) => file.entry)
    .slice(-WHATS_NEW_LIMIT);
}

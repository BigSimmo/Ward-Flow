import type { DocumentCategory, PastEpisode, RecordExtras } from "./patient-record-extras";

/**
 * Documents tab register (patient overhaul round 2, 1 Nov 2026): the row shape, the status words
 * and the episode labels for the one merged list. Pure helpers only; the tab builds the rows.
 * Every date stays as typed or recorded: nothing here works out a countdown or a time left (D-93).
 */

export type DocStatus = "In force" | "To record" | "Continued" | "Current" | "Filed" | "Ended" | "Superseded";

export const CATEGORY_ORDER: readonly DocumentCategory[] = [
  "Legal",
  "Referral",
  "Clinical",
  "Community",
  "Discharge",
  "Transport",
];

/** Strong first (in force, to record), then live, then history. */
const STATUS_RANK: Record<DocStatus, number> = {
  "In force": 0,
  "To record": 1,
  Continued: 2,
  Current: 3,
  Filed: 4,
  Ended: 5,
  Superseded: 6,
};

/** Ended and superseded rows recede; they stay in place and in order. */
export function isQuietStatus(status: DocStatus): boolean {
  return status === "Ended" || status === "Superseded";
}

export type RegisterRow = {
  key: string;
  /** The statutory form code ("6A"), or undefined for a non-statutory document. */
  code?: string;
  title: string;
  /** "PDF · 2 pages", "Recorded Sun 1 Nov 10:00": one quiet line under the title. */
  sub?: string;
  category: DocumentCategory;
  /** "current", "community", an episode id, or a free-text presentation key. */
  episode: string;
  source?: string;
  /** As typed or recorded. Undefined shows a quiet "Not recorded". */
  dateText?: string;
  /** For ordering only; NaN when no date is held. */
  sortAt: number;
  by?: string;
  status: DocStatus;
  /** A recorded fact beside the status, e.g. "At the examination, 09:02". Never a countdown. */
  statusNote?: string;
  /** The movement's own typed end, shown as typed beside the status. */
  typedEndAt?: number;
  /** The one form whose typed end carries the user's warning words. */
  standing?: boolean;
  /** A form still to record: nothing about it exists yet. */
  pending?: boolean;
  /** From the live record (movement, referral, order), so it wins over a register duplicate. */
  live?: boolean;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_WORDS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type ParsedDate = { ms: number; day?: number; month: number; year: number };

/** Reads "14 Jun 2026", "Mar 2025" or "closed 1 Dec 2021" from a typed string; undefined otherwise. */
export function parseShownDate(text: string | undefined): ParsedDate | undefined {
  if (!text) return undefined;
  const match = /(?:(\d{1,2})\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})/i.exec(text);
  if (!match) return undefined;
  const day = match[1] ? Number(match[1]) : undefined;
  const month = MONTHS.indexOf(match[2].toLowerCase());
  const year = Number(match[3]);
  return { ms: Date.UTC(year, month, day ?? 1), day, month, year };
}

/** "14 Jun 2026" → "14/06/2026"; "Mar 2025" stays; anything unparsed stays exactly as typed. */
export function shownDate(text: string | undefined): string | undefined {
  const parsed = parseShownDate(text);
  if (!parsed) return text;
  if (parsed.day === undefined) return `${MONTH_WORDS[parsed.month]} ${parsed.year}`;
  return `${String(parsed.day).padStart(2, "0")}/${String(parsed.month + 1).padStart(2, "0")}/${parsed.year}`;
}

/** "Jul to Aug 2026", "Oct 2024 to Jan 2025", "14 Jun 2026" for a one-day stay. */
function episodeSpan(start: string, end?: string): string {
  const a = parseShownDate(start);
  const b = parseShownDate(end);
  if (!a) return start;
  if (!b) return `From ${MONTH_WORDS[a.month]} ${a.year}`;
  if (a.ms === b.ms && a.day !== undefined) return start;
  if (a.year === b.year && a.month === b.month) return `${MONTH_WORDS[a.month]} ${a.year}`;
  if (a.year === b.year) return `${MONTH_WORDS[a.month]} to ${MONTH_WORDS[b.month]} ${a.year}`;
  return `${MONTH_WORDS[a.month]} ${a.year} to ${MONTH_WORDS[b.month]} ${b.year}`;
}

const KIND_WORD: Record<PastEpisode["kind"], string> = {
  admission: "Admission",
  ed: "ED presentation",
  community: "Community care",
};

export type EpisodeGroup = { key: string; label: string; aside?: string; sortAt: number };

/** The group heading for each episode key a row can carry. */
export function episodeGroupFor(
  key: string,
  extras: RecordExtras | undefined,
  options: { active: boolean; hasMovement: boolean },
): EpisodeGroup {
  if (key === "current")
    return {
      key,
      label: options.hasMovement && !options.active ? "Last presentation" : "This presentation",
      sortAt: Number.POSITIVE_INFINITY,
    };
  if (key === "community") {
    const engagement = extras?.community?.find((c) => c.status === "active") ?? extras?.community?.[0];
    if (!engagement) return { key, label: "Community", sortAt: Number.MAX_SAFE_INTEGER };
    const span =
      engagement.status === "active"
        ? `since ${engagement.since}`
        : episodeSpan(engagement.since, engagement.ended ?? undefined);
    return {
      key,
      label: `${engagement.team} · ${span}`,
      aside: engagement.status === "active" ? `${engagement.program} · active` : engagement.program,
      // An active team sits straight after this presentation; an ended one by its dates.
      sortAt:
        engagement.status === "active"
          ? Number.MAX_SAFE_INTEGER
          : (parseShownDate(engagement.ended)?.ms ?? parseShownDate(engagement.since)?.ms ?? 0),
    };
  }
  const episode = extras?.episodes.find((e) => e.id === key);
  if (episode) {
    const kind = KIND_WORD[episode.kind];
    return {
      key,
      label: `${episode.where} · ${episodeSpan(episode.start, episode.end)}`,
      aside: episode.stay ? `${kind} · ${episode.stay}` : kind,
      sortAt: parseShownDate(episode.end)?.ms ?? parseShownDate(episode.start)?.ms ?? 0,
    };
  }
  // A filed form's own words for its presentation: "The 8 Sep 2023 presentation".
  const label = key.replace(/^The\s+/u, "");
  return { key, label: label.charAt(0).toUpperCase() + label.slice(1), sortAt: parseShownDate(key)?.ms ?? 0 };
}

/** One key for "the same document": code when statutory, otherwise the folded title. */
export function sameDocumentKey(row: Pick<RegisterRow, "code" | "title" | "episode">): string {
  const what = row.code ? `form-${row.code.toUpperCase()}` : row.title.trim().toLowerCase();
  return `${row.episode}|${what}`;
}

/** Status first (strong rows on top), then newest first. */
export function compareRows(a: RegisterRow, b: RegisterRow): number {
  const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (rank !== 0) return rank;
  const at = Number.isNaN(a.sortAt) ? -Infinity : a.sortAt;
  const bt = Number.isNaN(b.sortAt) ? -Infinity : b.sortAt;
  return bt - at;
}

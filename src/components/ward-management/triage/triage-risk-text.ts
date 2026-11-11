/**
 * Triage and risk (built 7 Nov 2026): the pure text rules, ported from the approved prototype (`d-lean.html`).
 *
 * - Mental state "One box": each domain keeps one line, `Label: phrase, phrase`, in domain order.
 *   A tapped phrase lands on its domain's line, a second tap removes it, and a phrase that cannot
 *   be true with another (`MSE_VS`) replaces it. "Not assessed" replaces the line; any phrase
 *   replaces "Not assessed". Matching is whole word, so "Oriented" never matches "Disoriented".
 * - Free-text boxes: headings ("Why now:"), the dot shortcuts (.all, .form, .plan) and the parse
 *   the summary reads. Only known headings count, in any case; any other "Word:" stays as text.
 * - Reviewed time: DD/MM/YYYY HH:MM on the Perth clock, a real date, never in the future.
 */
import { perthCalendarDay, perthClockTime, perthMidnight } from "../ward-clock";
import { GUIDES, MSE, MSE_VS, type GuideGroup } from "./triage-risk-data";

const NOT_ASSESSED = "Not assessed";

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

function mseLabel(domain: string): string {
  return MSE.find((d) => d.id === domain)?.label ?? domain;
}

/** The text after "Label:" on a domain's line in the one box, trimmed ("" when there is none). */
export function boxLine(box: string, domain: string): string {
  const match = box.match(new RegExp(`^${escapeRegExp(mseLabel(domain))}:(.*)$`, "mi"));
  return match ? match[1].trim() : "";
}

/** The phrases a phrase replaces in its domain (both directions of each `MSE_VS` pair). */
function mseClash(domain: string, phrase: string): string[] {
  const out: string[] = [];
  for (const [d, one, other] of MSE_VS) {
    if (d !== domain) continue;
    if (one.includes(phrase)) out.push(...other);
    if (other.includes(phrase)) out.push(...one);
  }
  return out;
}

const phraseRe = (phrase: string, flags = "i") => new RegExp(`(^|[^a-z])${escapeRegExp(phrase)}(?![a-z])`, flags);

/** Words that turn a phrase into its opposite when they come just before it. */
const NEGATIONS = ["no", "denies", "denied", "not", "nil", "without"];

/**
 * Whole-word and case-blind, so "Oriented" is not in "Disoriented". Given its domain it is also
 * negation-aware: a phrase inside a longer phrase of the same domain does not count ("No suicidal
 * thoughts" is not "Suicidal thoughts"), and nor does one after no, denies, denied, not, nil or
 * without.
 */
export function hasPhrase(line: string, phrase: string, domain?: string): boolean {
  let text = line;
  if (domain) {
    const lower = phrase.toLowerCase();
    for (const other of MSE.find((d) => d.id === domain)?.phrases ?? []) {
      if (other !== phrase && other.length > phrase.length && other.toLowerCase().includes(lower))
        text = text.replace(phraseRe(other, "gi"), " ");
    }
  }
  text = text.replace(
    new RegExp(String.raw`(^|[^a-z])(${NEGATIONS.join("|")})\s+${escapeRegExp(phrase)}(?![a-z])`, "gi"),
    " ",
  );
  return phraseRe(phrase).test(text);
}

/** Removes one phrase from a line, tidying the comma or full stop around it. */
function dropPhrase(line: string, phrase: string): string {
  const match = line.match(new RegExp(String.raw`(^|,\s*|[.;]\s*)${escapeRegExp(phrase)}(?![a-z])`, "i"));
  if (!match || match.index === undefined) return line;
  const pre = line.slice(0, match.index);
  let post = line.slice(match.index + match[0].length);
  if (!pre) {
    post = post.replace(/^\s*[,.;]?\s*/, "");
    post = post.charAt(0).toUpperCase() + post.slice(1);
  } else if (/^[.;]/.test(match[1]) && /^\s*,\s*/.test(post)) {
    post = `${match[1].trim()} ${post.replace(/^\s*,\s*/, "")}`;
  }
  return (pre + post).trim();
}

const DOMAIN_LABELS = MSE.map((d) => d.label);
/** A line that starts with a domain's label, in any case (as `boxLine` reads it). */
const isDomainLine = (line: string) =>
  DOMAIN_LABELS.some((label) => line.toLowerCase().startsWith(`${label.toLowerCase()}:`));

/** Adds or removes a tapped phrase on its domain's line. `replaced` names what a clash removed. */
export function toggleBoxPhrase(box: string, domain: string, phrase: string): { box: string; replaced: string[] } {
  const label = mseLabel(domain);
  const lineRe = new RegExp(`^(${escapeRegExp(label)}:)(.*)$`, "mi");
  const match = box.match(lineRe);
  if (!match) {
    const lines = box ? box.split("\n") : [];
    lines.push(`${label}: ${phrase}`);
    const known = lines.filter(isDomainLine);
    const other = lines.filter((line) => line.trim() && !isDomainLine(line));
    const order = (line: string) =>
      DOMAIN_LABELS.findIndex((label) => line.toLowerCase().startsWith(`${label.toLowerCase()}:`));
    known.sort((a, b) => order(a) - order(b));
    return { box: [...known, ...other].join("\n"), replaced: [] };
  }
  let current = match[2].trim();
  let next: string;
  let replaced: string[] = [];
  if (phrase === NOT_ASSESSED) next = /^not assessed/i.test(current) ? "" : NOT_ASSESSED;
  else if (hasPhrase(current, phrase, domain)) next = dropPhrase(current, phrase);
  else {
    current = current.replace(/^not assessed\.?\s*/i, "");
    replaced = mseClash(domain, phrase).filter((other) => hasPhrase(current, other, domain));
    for (const other of replaced) current = dropPhrase(current, other);
    next = current ? `${current}, ${lowerFirst(phrase)}` : phrase;
  }
  if (next) return { box: box.replace(lineRe, (_whole, head: string) => `${head} ${next}`), replaced };
  const emptied = box.replace(new RegExp(String.raw`^${escapeRegExp(label)}:.*(\n|$)`, "mi"), "").replace(/\n$/, "");
  return { box: emptied, replaced };
}

/** By domain: one domain's chips, after a tap. "Not assessed" (`NA`) stands alone. */
export const NA = "__na";
export function toggleDomainChip(chips: readonly string[], domain: string, phrase: string) {
  if (chips.includes(phrase)) return { chips: chips.filter((c) => c !== phrase), replaced: [] as string[] };
  if (phrase === NA) return { chips: [NA], replaced: [] as string[] };
  const clash = mseClash(domain, phrase);
  const replaced = chips.filter((c) => clash.includes(c));
  return { chips: [...chips.filter((c) => c !== NA && !clash.includes(c)), phrase], replaced };
}

export type DomainEntry = { chips: string[]; detail: string };

/**
 * One box to By domain. Each domain's line is read again from scratch, so a line deleted from the
 * box clears that domain. A known phrase anywhere in the line becomes a chip when it stands as its
 * own item (at the start, or after a comma, full stop or semicolon), including one added after free
 * text; the rest stays as detail. Chips keep the order they had in the line.
 */
export function boxToDomains(box: string): Record<string, DomainEntry> {
  const out: Record<string, DomainEntry> = {};
  for (const domain of MSE) {
    const line = boxLine(box, domain.id);
    if (!line) continue;
    if (/^not assessed/i.test(line)) {
      out[domain.id] = { chips: [NA], detail: line.replace(/^not assessed\.?\s*/i, "") };
      continue;
    }
    // Longest first, so "No suicidal thoughts" is taken whole before "Suicidal thoughts" is tried,
    // and a phrase with a comma in it ("Denies, appears distracted") is read whole.
    const found = domain.phrases
      .filter((phrase) => hasPhrase(line, phrase, domain.id))
      .sort((a, b) => b.length - a.length);
    const chips: string[] = [];
    let rest = line;
    for (const phrase of found) {
      const next = dropPhrase(rest, phrase);
      if (next === rest) continue;
      chips.push(phrase);
      rest = next;
    }
    const at = (phrase: string) => line.search(phraseRe(phrase));
    chips.sort((a, b) => at(a) - at(b));
    rest = rest.replace(/^[\s,.;]+|[\s,;]+$/g, "");
    out[domain.id] = { chips, detail: rest.charAt(0).toUpperCase() + rest.slice(1) };
  }
  return out;
}

/** The text of one domain in By domain, as its one-box line would read. */
export function domainLineText(entry: DomainEntry | undefined): string {
  if (!entry) return "";
  const chips = entry.chips.includes(NA)
    ? NOT_ASSESSED
    : entry.chips.map((chip, index) => (index === 0 ? chip : lowerFirst(chip))).join(", ");
  const detail = entry.detail.trim();
  return chips && detail ? `${chips}. ${detail}` : chips || detail;
}

/** By domain to One box: domain lines in order, then any other lines the old box had. */
export function domainsToBox(domains: Readonly<Record<string, DomainEntry>>, previousBox: string): string {
  const lines = MSE.map((d) => [d.label, domainLineText(domains[d.id])] as const)
    .filter(([, text]) => text)
    .map(([label, text]) => `${label}: ${text}`);
  const other = previousBox.split("\n").filter((line) => line.trim() && !isDomainLine(line));
  return [...lines, ...other].join("\n");
}

export const guideHeadings = (groups: readonly GuideGroup[]) => groups.flatMap(([, items]) => items.map(([h]) => h));

let knownHeadings: readonly string[] | null = null;
/** The headings the summary reads: the guides', "Mental state" and the eight domains. Longest first. */
function headingsKnown(): readonly string[] {
  knownHeadings ??= [
    ...new Set([...guideHeadings(GUIDES.note), ...guideHeadings(GUIDES.rp), "Mental state", ...DOMAIN_LABELS]),
  ].sort((a, b) => b.length - a.length);
  return knownHeadings;
}

/**
 * "Heading: text" lines, for known headings only and in any case ("why now:" is Why now). A short
 * note in brackets after the heading stays with it ("History (12 Oct, check):"). Any other line,
 * "Mother: said he has not slept" included, joins the one above. Headings with nothing after them
 * are left out.
 */
export function parseHeadedText(text: string): [string, string][] {
  const known = headingsKnown();
  const re = new RegExp(String.raw`^(${known.map(escapeRegExp).join("|")})(\s*\([^)]{0,60}\))?\s*:\s*(.*)$`, "i");
  const out: [string, string][] = [];
  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(re);
    if (match) {
      const heading = known.find((h) => h.toLowerCase() === match[1].toLowerCase()) ?? match[1];
      out.push([heading + (match[2] ?? ""), match[3]]);
    } else if (out.length) {
      const last = out[out.length - 1];
      last[1] += last[1] ? ` ${line}` : line;
    } else out.push(["", line]);
  }
  return out.filter(([, body]) => body.trim());
}

/** A line that starts a known heading ("Plan:", "crisis (Rosa):"), as `parseHeadedText` reads it. */
export function isHeadingLine(line: string): boolean {
  const known = headingsKnown();
  return new RegExp(String.raw`^(${known.map(escapeRegExp).join("|")})(\s*\([^)]{0,60}\))?\s*:`, "i").test(line.trim());
}

export function headingFilled(text: string, heading: string): boolean {
  const match = text.match(new RegExp(`^${escapeRegExp(heading)}:(.*)$`, "mi"));
  return Boolean(match && match[1].trim().length > 2);
}

/** Headings typed into the box with nothing after them. */
export function emptyHeadings(text: string, groups: readonly GuideGroup[]): string[] {
  return guideHeadings(groups).filter((heading) => {
    const match = text.match(new RegExp(`^${escapeRegExp(heading)}:(.*)$`, "mi"));
    return Boolean(match && match[1].trim().length <= 2);
  });
}

/** More than a few words, once bare headings are left out. */
export function isWritten(text: string): boolean {
  return (
    text
      .replace(/^[^:\n]{2,40}:[ \t]*$/gm, "")
      .replace(/\s+/g, " ")
      .trim().length > 20
  );
}

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Puts the caret after a heading, adding the heading at the end when it is not there yet. */
export function addHeading(text: string, heading: string): { value: string; caret: number } {
  const match = text.match(new RegExp(`^${escapeRegExp(heading)}:.*$`, "mi"));
  if (match && match.index !== undefined) return { value: text, caret: match.index + match[0].length };
  const value = `${text}${text && !text.endsWith("\n") ? "\n" : ""}${heading}: `;
  return { value, caret: value.length };
}

const SHORTCUTS: Readonly<Record<"note" | "rp", Readonly<Record<string, () => string[]>>>> = {
  note: { all: () => guideHeadings(GUIDES.note) },
  rp: {
    form: () => GUIDES.rp[0][1].map(([h]) => h),
    plan: () => GUIDES.rp[1][1].map(([h]) => h),
    all: () => guideHeadings(GUIDES.rp),
  },
};

/**
 * A dot shortcut typed then a space (".all ") becomes the headings still missing from the box.
 * Returns null when the text before the caret is not a shortcut.
 */
export function expandShortcut(
  box: "note" | "rp",
  value: string,
  caret: number,
): { value: string; caret: number; message: string } | null {
  const before = value.slice(0, caret);
  const match = before.match(/(^|\s)\.([a-z]+)(\s)$/);
  const make = match ? SHORTCUTS[box][match[2]] : undefined;
  if (!match || !make) return null;
  const missing = make().filter((h) => !new RegExp(`^${escapeRegExp(h)}:`, "mi").test(value));
  const start = caret - match[2].length - 1 - match[3].length;
  let pre = value.slice(0, start).replace(/[ \t]+$/, "");
  if (pre && !pre.endsWith("\n")) pre += "\n";
  const inserted = missing.map((h) => `${h}: `).join("\n");
  const next = pre + inserted + (inserted ? "\n" : "") + value.slice(caret);
  const nextCaret = pre.length + (missing.length ? missing[0].length + 2 : 0);
  return {
    value: next,
    caret: nextCaret,
    message: missing.length ? `${missing.length} headings added.` : "Those headings are already in.",
  };
}

export type ReviewTimeCheck = { ok: boolean; message: string; future: boolean };

/**
 * The reviewed time: DD/MM/YYYY HH:MM, a date and time that exist, and not in the future (a minute's
 * grace). `message` is the plain words to show; empty when there is nothing typed yet.
 */
export function checkReviewTime(value: string, now: number): ReviewTimeCheck {
  const text = value.trim();
  if (!text) return { ok: false, message: "", future: false };
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
  if (!match) return { ok: false, message: "Use DD/MM/YYYY HH:MM, for example 06/11/2026 09:42.", future: false };
  const [day, month, year, hour, minute] = match.slice(1).map(Number);
  // Read on the Perth clock, whatever the device's zone (M18, 10 Nov 2026).
  const midnight = perthMidnight(year, month - 1, day);
  const read = perthCalendarDay(midnight);
  if (hour > 23 || minute > 59 || read.day !== day || read.monthIndex !== month - 1 || read.year !== year)
    return { ok: false, message: "That date or time does not exist. Use DD/MM/YYYY HH:MM.", future: false };
  if (midnight.getTime() + (hour * 60 + minute) * 60_000 > now + 60_000)
    return { ok: false, message: "That time is in the future. Enter when you reviewed.", future: true };
  return { ok: true, message: "", future: false };
}

/**
 * A real moment as a Perth wall-clock Date: its local fields read the Perth day and time. Only for
 * the helpers that count days from local fields (the see-by "today", the days since discharge).
 */
export function perthWallClockDate(moment: number): Date {
  const date = new Date(moment);
  const day = perthCalendarDay(date);
  const [hour = 0, minute = 0] = perthClockTime(date).split(":").map(Number);
  return new Date(day.year, day.monthIndex, day.day, hour, minute);
}

/** Now, as a reviewed time on the Perth clock: DD/MM/YYYY HH:MM, whatever the device's zone (M18). */
export function reviewTimeStamp(date: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  const perth = perthCalendarDay(date);
  return `${two(perth.day)}/${two(perth.monthIndex + 1)}/${perth.year} ${perthClockTime(date)}`;
}

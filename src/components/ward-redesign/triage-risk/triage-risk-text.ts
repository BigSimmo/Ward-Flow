/**
 * Triage and risk mock-up: the pure text rules, ported from the approved prototype (`d-lean.html`).
 *
 * - Mental state "One box": each domain keeps one line, `Label: phrase, phrase`, in domain order.
 *   A tapped phrase lands on its domain's line, a second tap removes it, and a phrase that cannot
 *   be true with another (`MSE_VS`) replaces it. "Not assessed" replaces the line; any phrase
 *   replaces "Not assessed". Matching is whole word, so "Oriented" never matches "Disoriented".
 * - Free-text boxes: headings ("Why now:"), the dot shortcuts (.all, .form, .plan) and the parse
 *   the summary reads.
 */
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
  text = text.replace(new RegExp(`(^|[^a-z])(${NEGATIONS.join("|")})\\s+${escapeRegExp(phrase)}(?![a-z])`, "gi"), " ");
  return phraseRe(phrase).test(text);
}

/** Removes one phrase from a line, tidying the comma or full stop around it. */
function dropPhrase(line: string, phrase: string): string {
  const match = line.match(new RegExp(`(^|,\\s*|[.;]\\s*)${escapeRegExp(phrase)}(?![a-z])`, "i"));
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
const isDomainLine = (line: string) => DOMAIN_LABELS.some((label) => line.startsWith(`${label}:`));

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
    known.sort((a, b) => DOMAIN_LABELS.indexOf(a.split(":")[0]) - DOMAIN_LABELS.indexOf(b.split(":")[0]));
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
  const emptied = box.replace(new RegExp(`^${escapeRegExp(label)}:.*(\\n|$)`, "mi"), "").replace(/\n$/, "");
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

/** One box to By domain: each line's known phrases become chips, the rest stays as detail. */
export function boxToDomains(box: string): Record<string, DomainEntry> {
  const out: Record<string, DomainEntry> = {};
  for (const domain of MSE) {
    const line = boxLine(box, domain.id);
    if (!line) continue;
    if (/^not assessed/i.test(line)) {
      out[domain.id] = { chips: [NA], detail: line.replace(/^not assessed\.?\s*/i, "") };
      continue;
    }
    // Leading phrases become chips; from the first part that is not a phrase, the rest of the line
    // stays as typed, punctuation and all.
    const chips: string[] = [];
    let rest = line;
    // Longest first, so "No suicidal thoughts" wins over "Suicidal thoughts", and a phrase with a
    // comma in it ("Denies, appears distracted") is read whole.
    const byLength = [...domain.phrases].sort((a, b) => b.length - a.length);
    for (;;) {
      const lower = rest.toLowerCase();
      const known = byLength.find((p) => {
        const after = lower.slice(p.length);
        return lower.startsWith(p.toLowerCase()) && (after === "" || /^\s*[,.;]/.test(after));
      });
      if (!known) break;
      if (!chips.includes(known)) chips.push(known);
      rest = rest.slice(known.length).replace(/^\s*[,.;]\s*/, "");
    }
    out[domain.id] = { chips, detail: rest.trim() };
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

/** "Heading: text" lines; a line with no heading joins the one above. */
export function parseHeadedText(text: string): [string, string][] {
  const out: [string, string][] = [];
  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(/^([A-Z][A-Za-z ,'()0-9-]{1,40}):\s*(.*)$/);
    if (match) {
      if (match[2].trim()) out.push([match[1], match[2]]);
    } else if (out.length) out[out.length - 1][1] += ` ${line}`;
    else out.push(["", line]);
  }
  return out;
}

export const guideHeadings = (groups: readonly GuideGroup[]) => groups.flatMap(([, items]) => items.map(([h]) => h));

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

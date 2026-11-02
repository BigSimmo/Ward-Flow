/**
 * HELP SUGGESTIONS AS YOU TYPE (Josh, 2 Nov 2026: "how it smartly adapts and fills in and has
 * suggestions based on what is typed").
 *
 * From the first two letters, `typeAheadHelp` offers up to six ways to finish the question, drawn from
 * Help's own approved content only: the how-tos, the walks round each screen, the screens, the
 * glossary, the screens' questions and the keyboard shortcuts. The way a question starts picks the
 * phrasing ("how do i pu" offers "How do I pull the bed for a patient?", "what does hel" offers
 * "What does Held up mean?"), and a word still being typed is matched as the start of a Help word.
 *
 * No AI and no network: the same words, desk and device counts always give the same suggestions.
 * The typed words are only read here, in memory; nothing is stored, logged or sent. Usage counts
 * are read by how-to id only (`ward-help-usage.ts`). A question that is, or would become, a
 * clinical-decision question gets no suggestion and no completion. Nothing here ranks a ward, bed
 * or patient, or suggests a clinical action: it only ranks Help's own topics.
 */
import { howToLogins } from "./ward-help-access";
import { KEYBOARD_SHORTCUTS, SCREEN_HELP, shortcutsForDesk, type GlossaryTerm } from "./ward-help-content";
import { howToHref } from "./ward-help-href";
import { HOW_TOS, ownTwinOf, questionWords, type HowTo } from "./ward-help-howto";
import { isClinicalQuestion } from "./ward-help-search-index";
import type { WardTourRole } from "./ward-help-store";
import { HELP_SYNONYMS } from "./ward-help-synonyms";
import { nearestWord, startsWithin } from "./ward-help-typo";
import { COMMON_QUESTIONS } from "../help-content/ward-help-reference";

export type HelpSuggestionKind = "job" | "walk" | "question" | "word" | "screen" | "shortcut";

export type HelpSuggestion = {
  /** Stable and unique within one list. */
  readonly key: string;
  /** The suggested question or topic, as it would be typed. */
  readonly text: string;
  readonly kind: HelpSuggestionKind;
  /** A how-to (job or walk round) that can be opened, or shown, directly. */
  readonly howToId?: string;
  /** The screen's help id (`SCREEN_HELP`), for a screen. */
  readonly screen?: string;
  /** The glossary term, for a word. */
  readonly term?: string;
  /** Character ranges `[start, end)` in `text` that match what was typed, to show in bold. */
  readonly matched: readonly (readonly [number, number])[];
};

export type HelpSuggestions = {
  /**
   * The top suggestion's full text, when it starts with what was typed (ignoring case and leading
   * spaces) and is longer, so a field can show the rest as ghost text. Undefined otherwise.
   */
  readonly completion?: string;
  readonly suggestions: readonly HelpSuggestion[];
};

export const MAX_SUGGESTIONS = 6;
const NONE: HelpSuggestions = { suggestions: [] };
const WORD_BREAK = /[\s,.?!/]+/u;

/* ── the index ───────────────────────────────────────────────────────────────────────────────── */

type Candidate = {
  readonly key: string;
  readonly kind: HelpSuggestionKind;
  /** The candidate's name: a how-to title, screen name, term, question or key. */
  readonly title: string;
  /** Lower-case names a typed topic may start, for the phrase-prefix rank. */
  readonly starts: readonly string[];
  readonly stems: ReadonlySet<string>;
  readonly titleStems: ReadonlySet<string>;
  readonly howTo?: HowTo;
  readonly logins?: readonly WardTourRole[];
  readonly screen?: string;
  readonly term?: string;
  readonly shortcut?: (typeof KEYBOARD_SHORTCUTS)[number];
  readonly name?: string;
};

type Index = {
  readonly candidates: readonly Candidate[];
  /** Every word as written (lower case) and its stem, in index order. */
  readonly written: readonly (readonly [written: string, stem: string])[];
  readonly writtenList: readonly string[];
  readonly writtenKnown: ReadonlySet<string>;
  readonly stems: ReadonlySet<string>;
};

function plain(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/gu, "");
}

function buildIndex(terms: readonly GlossaryTerm[]): Index {
  const candidates: Candidate[] = [];
  const texts: string[] = [];
  const add = (candidate: Omit<Candidate, "stems" | "titleStems">, match: string) => {
    texts.push(match);
    candidates.push({
      ...candidate,
      stems: new Set(questionWords(match)),
      titleStems: new Set(questionWords(candidate.title)),
    });
  };
  // List order: jobs, walks round screens, screens, words, questions, then keys.
  for (const howTo of HOW_TOS.filter((each) => !each.around))
    add(
      {
        key: `job:${howTo.id}`,
        kind: "job",
        title: howTo.title,
        starts: [howTo.title.toLowerCase()],
        howTo,
        logins: howToLogins(howTo),
      },
      `${howTo.title} ${howTo.keywords}`,
    );
  for (const howTo of HOW_TOS.filter((each) => each.around)) {
    const name = SCREEN_HELP[howTo.around ?? ""]?.title ?? howTo.title.replace(/^Show me around /u, "");
    add(
      {
        key: `walk:${howTo.id}`,
        kind: "walk",
        title: howTo.title,
        starts: [howTo.title.toLowerCase(), name.toLowerCase()],
        howTo,
        logins: howToLogins(howTo),
        name,
      },
      `${howTo.title} ${howTo.keywords}`,
    );
  }
  for (const [id, help] of Object.entries(SCREEN_HELP))
    add(
      { key: `screen:${id}`, kind: "screen", title: help.title, starts: [help.title.toLowerCase()], screen: id },
      help.title,
    );
  for (const term of terms)
    add(
      { key: `word:${term.term}`, kind: "word", title: term.term, starts: [term.term.toLowerCase()], term: term.term },
      term.term,
    );
  COMMON_QUESTIONS.forEach((item, index) =>
    add(
      { key: `question:${index}`, kind: "question", title: item.question, starts: [item.question.toLowerCase()] },
      item.question,
    ),
  );
  for (const shortcut of KEYBOARD_SHORTCUTS)
    add(
      {
        key: `shortcut:${shortcut.keys}`,
        kind: "shortcut",
        title: `${shortcut.short} · ${shortcut.keys}`,
        starts: [shortcut.keys.toLowerCase(), shortcut.short.toLowerCase()],
        shortcut,
      },
      `${shortcut.keys} ${shortcut.short} shortcut key keyboard`,
    );

  const seen = new Map<string, string>();
  const words = [...texts.join(" ").split(WORD_BREAK), ...HELP_SYNONYMS.map(([word]) => word)];
  for (const word of words) {
    const written = plain(word);
    if (written.length < 2 || seen.has(written)) continue;
    const [stem] = questionWords(written);
    if (stem) seen.set(written, stem);
  }
  const written = [...seen];
  return {
    candidates,
    written,
    writtenList: written.map(([word]) => word),
    writtenKnown: new Set(seen.keys()),
    stems: new Set(candidates.flatMap((candidate) => [...candidate.stems])),
  };
}

const indexes = new WeakMap<readonly GlossaryTerm[], Index>();
function indexFor(terms: readonly GlossaryTerm[]): Index {
  let index = indexes.get(terms);
  if (!index) {
    index = buildIndex(terms);
    indexes.set(terms, index);
  }
  return index;
}

const reachable = new Map<WardTourRole, ReadonlySet<string>>();
/** The screens this desk may open, so Go to never offers a door the guard would shut. */
function screensFor(role: WardTourRole): ReadonlySet<string> {
  let screens = reachable.get(role);
  if (!screens) {
    screens = new Set(Object.keys(SCREEN_HELP).filter((id) => howToHref(id, role, "/ward-flow") !== undefined));
    reachable.set(role, screens);
  }
  return screens;
}

/* ── reading what was typed ──────────────────────────────────────────────────────────────────── */

type Intent = "how" | "meaning" | "where" | "why" | "show" | "any";

/** How a question starts, the kind of answer it asks for and the words it is phrased with. */
const LEADS: readonly (readonly [lead: RegExp, intent: Intent, phrase: string])[] = [
  [/^how do i(?:\s+|$)/u, "how", "How do I"],
  [/^how can i(?:\s+|$)/u, "how", "How can I"],
  [/^how do (?:you|we)(?:\s+|$)/u, "how", "How do I"],
  [/^how to(?:\s+|$)/u, "how", "How to"],
  [/^can i(?:\s+|$)/u, "how", "Can I"],
  [/^(?:do i|i need to|i want to|help me(?: to)?)(?:\s+|$)/u, "how", "How do I"],
  [/^how(?:\s+|$)/u, "how", "How do I"],
  [/^what (?:does|do)(?:\s+|$)/u, "meaning", "What does"],
  [/^(?:what is|what's|whats)(?:\s+|$)/u, "meaning", "What is"],
  [/^what are(?:\s+|$)/u, "meaning", "What are"],
  [/^(?:meaning of|define)(?:\s+|$)/u, "meaning", "What does"],
  [/^where do i find(?:\s+|$)/u, "where", "Where do I find"],
  [/^where are(?:\s+|$)/u, "where", "Where are"],
  [/^where(?: is)?(?:\s+|$)/u, "where", "Where is"],
  [/^why(?:\s+|$)/u, "why", "Why"],
  [/^(?:show me around|show me round|show me|walk me (?:through|round|around)|tour of)(?:\s+|$)/u, "show", ""],
];

const KINDS: Readonly<Record<Intent, readonly HelpSuggestionKind[]>> = {
  how: ["job", "question"],
  meaning: ["word"],
  where: ["screen"],
  why: ["question", "job"],
  show: ["walk"],
  any: ["job", "walk", "screen", "word", "question", "shortcut"],
};

/** The words that turn a question clinical once typed in full (checked with `isClinicalQuestion`). */
const CLINICAL_WORDS: readonly string[] = [
  "dose",
  "dosage",
  "dosing",
  "medication",
  "medications",
  "medicine",
  "prescribe",
  "prescription",
  "diagnosis",
  "treatment",
  "symptom",
  "symptoms",
  "suicide",
  "suicidal",
  "self-harm",
  "overdose",
  "sedate",
  "sedation",
];
/**
 * Words that are clinical only after another ("should I admit", "safe to transfer", "side effects",
 * "self harm"), so even one letter of them counts once that word is there.
 */
const DECISION_WORDS: readonly string[] = [
  "effects",
  "effect",
  "harm",
  "admit",
  "discharge",
  "transfer",
  "section",
  "detain",
  "restrain",
  "seclude",
  "give",
  "treat",
  "diagnose",
];

/** Whether the last word, still being typed, could finish the question as a clinical one. */
function couldTurnClinical(before: string, partial: string): boolean {
  if (!partial) return false;
  const finish = (words: readonly string[], letters: number) =>
    partial.length >= letters &&
    words.some((word) => startsWithin(partial, word) && isClinicalQuestion(`${before}${word}`));
  return finish(CLINICAL_WORDS, 3) || finish(DECISION_WORDS, 1);
}

const CLINICAL_KNOWN: ReadonlySet<string> = new Set(CLINICAL_WORDS);

/**
 * Whether the question reads as a clinical one once a misspelt clinical word is mended ("what
 * dosgae"). Only words Help does not hold are mended, and only towards the clinical words.
 */
function mendsClinical(typed: string, index: Index): boolean {
  const words = typed.split(/\s+/u).filter(Boolean);
  const mended = words.map((word) => {
    const written = plain(word);
    if (index.writtenKnown.has(written) || questionWords(word).length === 0) return word;
    return nearestWord(written, CLINICAL_WORDS, CLINICAL_KNOWN);
  });
  return isClinicalQuestion(mended.join(" "));
}

type Group = { readonly stems: ReadonlySet<string>; readonly partial?: string };

type Reading = {
  readonly intent: Intent;
  readonly phrase: string;
  /** The topic words after the lead, lower case, single spaced. */
  readonly topic: string;
  readonly groups: readonly Group[];
  readonly clinical: boolean;
};

function read(query: string, index: Index): Reading {
  const typed = query.trimStart().toLowerCase().replace(/\s+/gu, " ");
  let intent: Intent = "any";
  let phrase = "";
  let rest = typed;
  for (const [lead, kind, words] of LEADS) {
    const found = lead.exec(typed);
    if (!found) continue;
    intent = kind;
    phrase = words;
    rest = typed.slice(found[0].length);
    break;
  }
  const meant = /\s(?:mean|means|meaning|stand for|stands for)\??$/u.exec(rest);
  if (meant && intent === "any") {
    intent = "meaning";
    phrase = "What does";
    rest = rest.slice(0, meant.index);
  }
  const tokens = rest.split(WORD_BREAK).filter(Boolean);
  const open = tokens.length > 0 && !/[\s,.?!/]$/u.test(rest);
  const before = typed.slice(0, typed.length - (open ? (tokens.at(-1)?.length ?? 0) : 0));
  const groups: Group[] = [];
  const corrected: string[] = [];
  let clinical = false;
  tokens.forEach((token, position) => {
    const word = plain(token);
    const last = open && position === tokens.length - 1;
    if (last) {
      corrected.push(token);
      if (couldTurnClinical(before, word)) clinical = true;
      // A lone stop word ("the") may be the start of a word; after other words it is skipped.
      if (word.length < 2 || (questionWords(token).length === 0 && tokens.length > 1)) return;
      let stems = index.written
        .filter(([written]) => written.startsWith(word))
        .filter(([written]) => !isClinicalQuestion(`${before}${written}`))
        .map(([, stem]) => stem);
      if (stems.length === 0 && word.length >= 4)
        stems = index.written
          .filter(([written]) => startsWithin(word, written) && !isClinicalQuestion(`${before}${written}`))
          .map(([, stem]) => stem);
      groups.push({ stems: new Set(stems), partial: word });
      return;
    }
    const exact = questionWords(token);
    if (exact.length === 0) {
      corrected.push(token);
      return;
    }
    if (exact.every((stem) => index.stems.has(stem))) {
      corrected.push(token);
      for (const stem of exact) groups.push({ stems: new Set([stem]) });
      return;
    }
    const mended = nearestWord(word, index.writtenList, index.writtenKnown);
    corrected.push(mended);
    for (const stem of questionWords(mended)) groups.push({ stems: new Set([stem]) });
  });
  if (isClinicalQuestion(`${typed.slice(0, typed.length - rest.length)}${corrected.join(" ")}`)) clinical = true;
  if (mendsClinical(typed, index)) clinical = true;
  return { intent, phrase, topic: tokens.join(" "), groups, clinical };
}

/* ── phrasing and marking ────────────────────────────────────────────────────────────────────── */

/** "Pull the bed" as it reads mid-sentence; a name that starts with capitals ("TV", "ED") keeps them. */
function midSentence(title: string): string {
  return /^[A-Z][a-z]/u.test(title) ? `${title[0].toLowerCase()}${title.slice(1)}` : title;
}

function phrased(candidate: Candidate, reading: Reading): string {
  const { intent, phrase } = reading;
  switch (candidate.kind) {
    case "job":
      // A title already phrased as a question or a statement ("Why the app…") stays as it is.
      if (intent !== "how" || /^(why|what|how|is|if|when)\b/iu.test(candidate.title)) return candidate.title;
      return phrase === "How to"
        ? `How to ${midSentence(candidate.title)}`
        : `${phrase} ${midSentence(candidate.title)}?`;
    case "word":
      if (phrase === "What is" || phrase === "What are") return `${phrase} ${candidate.title}?`;
      return `What does ${candidate.title} mean?`;
    case "screen":
      return intent === "where" ? `${phrase} ${candidate.title}?` : candidate.title;
    default:
      return candidate.title;
  }
}

function merge(ranges: [number, number][]): readonly (readonly [number, number])[] {
  const sorted = ranges.toSorted((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: [number, number][] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

/** The parts of `text` that match what was typed: the typed start, typed words and word starts. */
function marked(text: string, typed: string, groups: readonly Group[]): readonly (readonly [number, number])[] {
  const ranges: [number, number][] = [];
  if (typed && text.toLowerCase().startsWith(typed)) ranges.push([0, typed.length]);
  const complete = new Set(groups.filter((group) => !group.partial).flatMap((group) => [...group.stems]));
  const partials = groups.filter((group) => group.partial);
  for (const found of text.matchAll(/[A-Za-z0-9'+-]+/gu)) {
    const start = found.index;
    const word = found[0];
    const [stem] = questionWords(word);
    const lower = word.toLowerCase();
    const prefix = partials.find((group) => group.partial && lower.startsWith(group.partial));
    if (prefix?.partial) ranges.push([start, start + prefix.partial.length]);
    else if (stem && (complete.has(stem) || partials.some((group) => group.stems.has(stem))))
      ranges.push([start, start + word.length]);
  }
  return merge(ranges);
}

/* ── suggesting ──────────────────────────────────────────────────────────────────────────────── */

type Ranked = {
  readonly candidate: Candidate;
  readonly text: string;
  readonly prefix: number;
  readonly all: boolean;
  readonly hits: number;
  readonly mine: boolean;
  readonly used: number;
  readonly titleHits: number;
  readonly order: number;
};

/** Whether this desk is offered the candidate at all, and whether it is the desk's own. */
function deskFit(candidate: Candidate, role: WardTourRole): { offered: boolean; mine: boolean } {
  if (candidate.kind === "job" && candidate.howTo) {
    const mine = candidate.logins?.includes(role) ?? true;
    // A job this login cannot follow gives way to its own same-title twin (the downtime pair).
    const twin = !mine && ownTwinOf(candidate.howTo, role) !== candidate.howTo;
    return { offered: !twin, mine };
  }
  if (candidate.kind === "walk") {
    const mine = candidate.logins?.includes(role) ?? false;
    return { offered: mine, mine };
  }
  if (candidate.kind === "screen") {
    const mine = screensFor(role).has(candidate.screen ?? "");
    return { offered: mine, mine };
  }
  if (candidate.kind === "shortcut") {
    const mine = candidate.shortcut ? shortcutsForDesk(role).includes(candidate.shortcut) : false;
    return { offered: mine, mine };
  }
  return { offered: true, mine: true };
}

function rank(
  reading: Reading,
  typed: string,
  kinds: readonly HelpSuggestionKind[],
  role: WardTourRole,
  index: Index,
  used: ReadonlyMap<string, number> | undefined,
): Ranked[] {
  const { groups, topic } = reading;
  const needed = Math.max(1, Math.ceil(groups.length / 2));
  const ranked: Ranked[] = [];
  index.candidates.forEach((candidate, order) => {
    if (!kinds.includes(candidate.kind)) return;
    if (candidate.kind === "question" && reading.intent === "how" && !/^how\b/iu.test(candidate.title)) return;
    // "Why…" asks for a question or a job written as one ("Why the app does not work out…").
    if (reading.intent === "why" && !/^why\b/iu.test(candidate.title)) return;
    const { offered, mine } = deskFit(candidate, role);
    if (!offered) return;
    const text = phrased(candidate, reading);
    // The suggestion reads on from exactly what was typed (2), or its name starts with the topic (1).
    const prefix =
      typed.length > 0 && text.toLowerCase().startsWith(typed)
        ? 2
        : topic.length > 0 && candidate.starts.some((start) => start.startsWith(topic))
          ? 1
          : 0;
    let hits = 0;
    let titleHits = 0;
    for (const group of groups) {
      if ([...group.stems].some((stem) => candidate.stems.has(stem))) hits += 1;
      if ([...group.stems].some((stem) => candidate.titleStems.has(stem))) titleHits += 1;
    }
    if (groups.length > 0 && !prefix && hits < needed) return;
    const id = candidate.howTo?.id;
    ranked.push({
      candidate,
      text,
      prefix,
      all: groups.length > 0 && hits === groups.length,
      hits,
      mine,
      used: (id && used?.get(id)) || 0,
      titleHits,
      order,
    });
  });
  // Typed start first, then every word, more words, this desk's own, used on this device, title words, list order.
  return ranked.sort(
    (a, b) =>
      b.prefix - a.prefix ||
      Number(b.all) - Number(a.all) ||
      b.hits - a.hits ||
      Number(b.mine) - Number(a.mine) ||
      b.used - a.used ||
      b.titleHits - a.titleHits ||
      a.order - b.order,
  );
}

/**
 * Up to six suggestions for what is being typed, best first, and the top one as a completion when
 * it starts with the typed text. `terms` is the sheet's glossary (default or a scenario's sites);
 * `used` is this device's Help usage counts by how-to id, used only to break ties. Nothing typed is
 * stored or sent; a clinical question, typed or about to be, gets nothing.
 */
export function typeAheadHelp(
  query: string,
  role: WardTourRole,
  terms: readonly GlossaryTerm[],
  used?: ReadonlyMap<string, number>,
): HelpSuggestions {
  const typed = query.trimStart().toLowerCase();
  if (typed.replace(/[^a-z0-9]/gu, "").length < 2) return NONE;
  if (isClinicalQuestion(query)) return NONE;
  const index = indexFor(terms);
  const reading = read(query, index);
  if (reading.clinical) return NONE;
  // A lead with no topic yet ("how do i ") lists the desk's own jobs, walks or screens.
  if (reading.groups.length === 0 && reading.topic.length > 0) return NONE;
  if (reading.groups.length === 0 && !["how", "show", "where"].includes(reading.intent)) return NONE;

  let ranked = rank(reading, typed, KINDS[reading.intent], role, index, used);
  if (reading.groups.length === 0) ranked = ranked.filter((item) => item.mine && item.candidate.kind !== "question");
  // Nothing of the kind asked for: any kind, in its plain words ("how do i telly" still finds TV).
  // "Why…" asks for a reason only, so it never falls back to jobs that merely share a word.
  if (ranked.length === 0 && !["any", "why"].includes(reading.intent) && reading.groups.length > 0)
    ranked = rank({ ...reading, intent: "any", phrase: "" }, typed, KINDS.any, role, index, used);

  const seen = new Set<string>();
  const suggestions: HelpSuggestion[] = [];
  for (const { candidate, text } of ranked) {
    const id = text.toLowerCase();
    // Help's own words never read as a clinical question, but every suggestion is checked anyway.
    if (seen.has(id) || isClinicalQuestion(text)) continue;
    seen.add(id);
    suggestions.push({
      key: candidate.key,
      text,
      kind: candidate.kind,
      howToId: candidate.howTo?.id,
      screen: candidate.screen,
      term: candidate.term,
      matched: marked(text, typed, reading.groups),
    });
    if (suggestions.length === MAX_SUGGESTIONS) break;
  }
  const top = suggestions[0]?.text;
  const completion = top && top.length > typed.length && top.toLowerCase().startsWith(typed) ? top : undefined;
  return completion ? { completion, suggestions } : { suggestions };
}

/** The part of `completion` still to come after `typed`, or "" when it does not continue it. */
export function completionRest(typed: string, completion: string | undefined): string {
  const start = typed.trimStart();
  if (!completion || !completion.toLowerCase().startsWith(start.toLowerCase())) return "";
  return completion.slice(start.length);
}

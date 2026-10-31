/**
 * HELP SEARCH INDEX (variant A, Josh 27 Oct 2026): one local index over the app's own approved Help
 * content: how-tos, desk guides, screen help, the glossary, keyboard shortcuts and Settings. No AI
 * and no network; the same words always give the same results, and the typed words are never stored.
 *
 * Help answers app-usage questions only. A question that asks for a clinical decision gets the fixed,
 * owner-approved reply (`CLINICAL_REPLY`) and no results. Nothing here ranks patients, wards or beds.
 */
import { SETTINGS_SEARCH_ENTRIES, SETTINGS_TABS } from "@/components/ward-management/settings/settings-search-index";

import { GLOSSARY, KEYBOARD_SHORTCUTS, SCREEN_HELP, type GlossaryTerm } from "./ward-help-content";
import { DESK_GUIDES, SAVED_OR_NOT, WHEN_IT_IS_DOWN } from "./ward-help-guide";
import { correctedQuestionWords, HOW_TOS, questionWords } from "./ward-help-howto";
import { COLOUR_LEGEND, COLOUR_LEGEND_NOTE } from "./ward-help-legend";
import { ACCESSIBILITY_HELP, COMMON_QUESTIONS, INTERACTIONS_HELP } from "../help-content/ward-help-reference";
import { SAVE_HELP_TERMS } from "../help-content/ward-help-glossary";
import { ROLE_REFERENCE } from "./ward-help-roles";
import type { WardTourRole } from "./ward-help-store";

export type HelpSearchGroup = "Guides" | "This screen" | "Glossary" | "Shortcuts" | "Settings";

export const HELP_SEARCH_GROUPS: readonly HelpSearchGroup[] = [
  "Guides",
  "This screen",
  "Glossary",
  "Shortcuts",
  "Settings",
];

export type HelpSearchResult = {
  readonly key: string;
  readonly group: HelpSearchGroup;
  readonly title: string;
  readonly detail: string;
  /** A how-to with Show me steps (`ward-help-howto.ts`). */
  readonly howToId?: string;
  /** Where it is done, as `howToHref` understands it. */
  readonly go?: string | readonly string[];
  /** Roles that do this job; undefined means every desk. */
  readonly desks?: readonly WardTourRole[];
};

/** Owner-approved reply to a clinical question (Josh, 27 Oct 2026, "wording A"). */
export const CLINICAL_REPLY =
  "Help covers how to use Ward Flow, not clinical decisions. For clinical questions, please use your clinical guidelines or speak to the treating team.";

/**
 * Questions that ask for a clinical decision rather than how to use a screen. Kept narrow, so app
 * words such as "At risk", "Legal status", "Tentative diagnosis" or
 * "Community treatment order" still search Help.
 */
const CLINICAL =
  /\b(dose|dosage|dosing|mg|medicat\w*|prescri\w*|(what|which) (\w+ )?(diagnosis|treatment)|(diagnosis|treatment) (for|of)|side effects?|symptoms?|suicid\w*|self[- ]harm|overdose|sedat\w*|safe (to|for) transfer|should (i|we) (admit|discharge|transfer|section|detain|restrain|seclude|give|treat|diagnose))\b/iu;

export function isClinicalQuestion(query: string): boolean {
  return CLINICAL.test(query);
}

type Entry = HelpSearchResult & { readonly strong: ReadonlySet<string>; readonly weak: ReadonlySet<string> };

function entry(result: HelpSearchResult, strong: string, weak: string): Entry {
  return { ...result, strong: new Set(questionWords(strong)), weak: new Set(questionWords(weak)) };
}

function buildIndex(glossary: readonly GlossaryTerm[]): readonly Entry[] {
  const entries: Entry[] = [];
  for (const howTo of HOW_TOS)
    entries.push(
      entry(
        {
          key: `howto:${howTo.id}`,
          group: "Guides",
          title: howTo.title,
          detail: howTo.answer,
          howToId: howTo.showMe?.length ? howTo.id : undefined,
          go: howTo.go,
          desks: howTo.desks === "all" ? undefined : howTo.desks,
        },
        `${howTo.title} ${howTo.keywords}`,
        howTo.answer,
      ),
    );
  for (const [role, guide] of Object.entries(DESK_GUIDES) as [WardTourRole, (typeof DESK_GUIDES)[WardTourRole]][])
    guide.jobs.forEach((job, index) =>
      entries.push(
        entry(
          {
            key: `guide:${role}:${index}`,
            group: "Guides",
            title: job.job,
            detail: job.how,
            go: job.go,
            desks: [role],
          },
          job.job,
          job.how,
        ),
      ),
    );
  for (const [id, help] of Object.entries(SCREEN_HELP)) {
    entries.push(
      entry(
        { key: `screen:${id}`, group: "This screen", title: help.title, detail: help.purpose },
        help.title,
        `${help.purpose} ${help.actions.join(" ")}`,
      ),
    );
    help.questions?.forEach((item, index) =>
      entries.push(
        entry(
          { key: `screen:${id}:q${index}`, group: "This screen", title: item.question, detail: item.answer },
          item.question,
          item.answer,
        ),
      ),
    );
  }
  for (const term of [...glossary, ...SAVE_HELP_TERMS])
    entries.push(
      entry(
        { key: `term:${term.term}`, group: "Glossary", title: term.term, detail: term.meaning },
        term.term,
        term.meaning,
      ),
    );
  for (const shortcut of KEYBOARD_SHORTCUTS)
    entries.push(
      entry(
        { key: `key:${shortcut.keys}`, group: "Shortcuts", title: shortcut.keys, detail: shortcut.action },
        `${shortcut.keys} shortcut key keyboard`,
        shortcut.action,
      ),
    );
  for (const setting of SETTINGS_SEARCH_ENTRIES) {
    const tab = SETTINGS_TABS.find((item) => item.id === setting.tab)?.label ?? "Settings";
    entries.push(
      entry(
        {
          key: `setting:${setting.id}`,
          group: "Settings",
          title: setting.label,
          detail: `Settings · ${tab}`,
          go: `settings#${setting.tab}`,
        },
        `${setting.label} ${setting.keywords} setting`,
        tab,
      ),
    );
  }
  for (const role of ROLE_REFERENCE)
    entries.push(
      entry(
        { key: `role:${role.id}`, group: "Guides", title: role.name, detail: role.summary },
        `${role.name} roles desk`,
        role.summary,
      ),
    );
  entries.push(
    entry(
      { key: "reference:colour-code", group: "Glossary", title: "Colour code", detail: COLOUR_LEGEND_NOTE },
      "Colour code colour color legend shape",
      COLOUR_LEGEND_NOTE,
    ),
  );
  for (const colour of COLOUR_LEGEND)
    entries.push(
      entry(
        { key: `colour:${colour.tone}`, group: "Glossary", title: colour.meaning, detail: colour.shape },
        `${colour.meaning} ${colour.shape} colour color code legend`,
        COLOUR_LEGEND_NOTE,
      ),
    );
  entries.push(
    entry(
      { key: "guide:saved", group: "Guides", title: "Is it saved?", detail: SAVED_OR_NOT.join(" ") },
      "Is it saved? saving save",
      SAVED_OR_NOT.join(" "),
    ),
  );
  entries.push(
    entry(
      { key: "guide:downtime", group: "Guides", title: "If Ward Flow is down", detail: WHEN_IT_IS_DOWN.join(" ") },
      "If Ward Flow is down downtime offline paper",
      WHEN_IT_IS_DOWN.join(" "),
    ),
  );
  for (const item of [...ACCESSIBILITY_HELP, ...INTERACTIONS_HELP])
    entries.push(
      entry(
        { key: `accessibility:${item.title}`, group: "Guides", title: item.title, detail: item.text },
        `${item.title} accessibility`,
        item.text,
      ),
    );
  for (const item of COMMON_QUESTIONS)
    entries.push(
      entry(
        { key: `faq:${item.question}`, group: "Guides", title: item.question, detail: item.answer },
        item.question,
        item.answer,
      ),
    );
  return entries;
}

let cached: readonly Entry[] | undefined;
let knownWords: ReadonlySet<string> | undefined;
function defaultIndex(): readonly Entry[] {
  cached ??= buildIndex(GLOSSARY);
  return cached;
}

export type HelpSearchAnswer =
  | { readonly kind: "empty" }
  | { readonly kind: "clinical" }
  | { readonly kind: "results"; readonly results: readonly HelpSearchResult[] }
  | { readonly kind: "none"; readonly closest: readonly HelpSearchResult[] };

function strip(item: Entry): HelpSearchResult {
  const { key, group, title, detail, howToId, go, desks } = item;
  return { key, group, title, detail, howToId, go, desks };
}

/**
 * Searches Help for `query`. An entry matches when at least half the query's words are in it; title
 * words score three, body words one. Ties keep the index order (guides first), so results are stable.
 * With no match, the closest topics are those sharing any one word.
 */
export function searchHelp(query: string, role: WardTourRole, limit = 12): HelpSearchAnswer {
  if (isClinicalQuestion(query)) return { kind: "clinical" };
  const index = defaultIndex();
  const vocabulary = (knownWords ??= new Set(index.flatMap((item) => [...item.strong, ...item.weak])));
  // Keep exact words from every indexed reference. Only unknown words need correction against
  // the how-to vocabulary, and correcting before stemming preserves typos such as "thme".
  const words = [
    ...new Set(
      query.split(/[\s,.?!/]+/).flatMap((word) => {
        const exact = questionWords(word);
        return exact.every((stem) => vocabulary.has(stem)) ? exact : correctedQuestionWords(word);
      }),
    ),
  ];
  if (words.length === 0) return { kind: "empty" };
  const needed = Math.max(1, Math.ceil(words.length / 2));
  const scored = index.flatMap((item, order) => {
    let hits = 0;
    let score = 0;
    for (const word of words) {
      const weight = item.strong.has(word) ? 3 : item.weak.has(word) ? 1 : 0;
      if (weight) {
        hits += 1;
        score += weight;
      }
    }
    if (hits === 0) return [];
    const mine = !item.desks || item.desks.includes(role);
    return [{ item, hits, score: score + (mine ? 1 : 0), order }];
  });
  scored.sort((a, b) => b.hits - a.hits || b.score - a.score || a.order - b.order);
  const matched = scored.filter((candidate) => candidate.hits >= needed);
  if (matched.length === 0) {
    const closest = scored.slice(0, 3).map(({ item }) => strip(item));
    return {
      kind: "none",
      closest: closest.sort((a, b) => HELP_SEARCH_GROUPS.indexOf(a.group) - HELP_SEARCH_GROUPS.indexOf(b.group)),
    };
  }
  const best = matched[0].score;
  const seen = new Set<string>();
  const results = matched
    .filter((candidate) => candidate.score * 3 >= best)
    .map(({ item }) => strip(item))
    .filter((result) => {
      const id = `${result.group}:${result.title.toLowerCase()}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, limit)
    // Shown grouped, so keep that order here and arrow keys move down the list as seen.
    .sort((a, b) => HELP_SEARCH_GROUPS.indexOf(a.group) - HELP_SEARCH_GROUPS.indexOf(b.group));
  return { kind: "results", results };
}

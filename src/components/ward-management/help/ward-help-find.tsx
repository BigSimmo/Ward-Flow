"use client";

import {
  ArrowRight,
  BookA,
  BookOpen,
  CircleHelp,
  Keyboard,
  LayoutDashboard,
  MessageCircleQuestion,
  Play,
  Settings,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/wf";

import { SCREEN_HELP, type GlossaryTerm } from "./ward-help-content";
import { HOW_TOS } from "./ward-help-howto";
import { CLINICAL_REPLY, searchHelp, type HelpSearchResult } from "./ward-help-search-index";
import type { WardTourRole } from "./ward-help-store";
import { HELP_SYNONYMS } from "./ward-help-synonyms";
import { nearestWord } from "./ward-help-typo";
import { relatedTerms } from "@/components/ward-management/help-content/ward-help-glossary";

import s from "./ward-help-panel.module.css";

/* ── understanding the question ─────────────────────────────────────────────────────────────── */

const GROUPS = ["Jobs", "Questions", "Words", "Screens", "Shortcuts"] as const;
type Group = (typeof GROUPS)[number];
type Intent = "how" | "meaning" | "why" | "where" | "any";

const ICON = {
  Jobs: BookOpen,
  Questions: MessageCircleQuestion,
  Words: BookA,
  Screens: LayoutDashboard,
  Shortcuts: Keyboard,
} as const;

/** Which panel group a Help index entry belongs in. A screen's question is a question. */
function groupOf(result: HelpSearchResult): Group {
  if (result.group === "Guides") return "Jobs";
  if (result.group === "Glossary") return "Words";
  if (result.group === "Shortcuts") return "Shortcuts";
  return /:q\d+$/u.test(result.key) ? "Questions" : "Screens";
}

/** What kind of answer the words ask for, from how the question starts. */
function intentOf(query: string): Intent {
  const q = query.toLowerCase().trim();
  if (/\b(mean|meaning|means|stand for|stands for|short for)\b/u.test(q) || /^what('?s| is| are| does)\b/u.test(q))
    return "meaning";
  if (/^why\b/u.test(q)) return "why";
  if (/^where\b/u.test(q)) return "where";
  if (/^(how|can i|do i|i need|i want|help me)\b/u.test(q)) return "how";
  return "any";
}

const FIRST: Readonly<Record<Intent, Group>> = {
  how: "Jobs",
  meaning: "Words",
  why: "Questions",
  where: "Screens",
  any: "Jobs",
};

let vocabulary: { list: readonly string[]; known: ReadonlySet<string> } | undefined;
/** Every word Help itself uses, as written, for mending typos in what is shown back. */
function helpVocabulary(terms: readonly GlossaryTerm[]) {
  if (!vocabulary) {
    const text = [
      ...HOW_TOS.flatMap((howTo) => [howTo.title, howTo.keywords, howTo.answer]),
      ...Object.values(SCREEN_HELP).flatMap((help) => [
        help.title,
        ...(help.questions ?? []).map((item) => item.question),
      ]),
      ...terms.map((entry) => entry.term),
      ...HELP_SYNONYMS.map(([word]) => word),
    ].join(" ");
    const list = [...new Set(text.toLowerCase().match(/[a-z]{3,}/gu) ?? [])];
    vocabulary = { list, known: new Set(list) };
  }
  return vocabulary;
}

/** The question with small typos mended, word by word; the same words when nothing needed mending. */
function mended(query: string, terms: readonly GlossaryTerm[]): string {
  const { list, known } = helpVocabulary(terms);
  return query.replace(/[A-Za-z]{4,}/gu, (word) => {
    const fixed = nearestWord(word.toLowerCase(), list, known);
    return fixed === word.toLowerCase() ? word : fixed;
  });
}

export type HelpFound =
  | { kind: "clinical" }
  | {
      kind: "results";
      /** The question as Help read it, when it mended a typo. */
      readAs?: string;
      /** The closest matches when nothing matched every word. */
      closest: boolean;
      best?: HelpSearchResult;
      groups: readonly { name: Group; rows: readonly HelpSearchResult[] }[];
    };

/**
 * The typed words found across Help, read the way a person means them: typos mended, the kind of
 * answer guessed from how the question starts (what does … mean, why, where, how do I), the best
 * answer picked out, and the rest grouped. Same words in, same answer out; nothing is stored.
 */
export function findInHelp(
  query: string,
  role: WardTourRole,
  terms: readonly GlossaryTerm[],
  mend = true,
): HelpFound | undefined {
  // The clinical guard reads the words as typed first, so mending a typo can never talk it out of a
  // clinical question ("transfer" must not become "transport").
  if (searchHelp(query, role, 1, terms).kind === "clinical") return { kind: "clinical" };
  const fixed = mend ? mended(query, terms) : query;
  const answer = searchHelp(fixed, role, 14, terms);
  if (answer.kind === "empty") return undefined;
  if (answer.kind === "clinical") return { kind: "clinical" };
  const results = answer.kind === "results" ? answer.results : answer.closest;
  const intent = intentOf(fixed);
  const order: Group[] = [FIRST[intent], ...GROUPS.filter((group) => group !== FIRST[intent])];
  const mine = (result: HelpSearchResult) => !result.desks || result.desks.includes(role);
  // The best answer: the first of the wanted kind this desk can use, else the first this desk can use.
  const best =
    answer.kind === "results"
      ? (results.find((result) => groupOf(result) === order[0] && mine(result)) ?? results.find(mine))
      : undefined;
  const groups = order
    .map((name) => ({ name, rows: results.filter((result) => groupOf(result) === name && result !== best) }))
    .filter((group) => group.rows.length > 0);
  return {
    kind: "results",
    readAs: fixed.toLowerCase() !== query.toLowerCase() ? fixed : undefined,
    closest: answer.kind === "none",
    best,
    groups,
  };
}

/** The rows in the order the arrow keys move through them: the best answer first. */
export function foundRows(found: HelpFound | undefined): readonly HelpSearchResult[] {
  if (!found || found.kind === "clinical") return [];
  return [...(found.best ? [found.best] : []), ...found.groups.flatMap((group) => group.rows)];
}

/* ── drawing the answers ────────────────────────────────────────────────────────────────────── */

/** `text` with each typed word of three letters or more marked. */
function Marked({ text, query }: { text: string; query: string }): ReactNode {
  const words = query
    .split(/[\s,.?!/]+/u)
    .filter((word) => word.length >= 3)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"));
  if (!words.length) return text;
  const parts = text.split(new RegExp(`(${words.join("|")})`, "giu"));
  return parts.map((part, index) => (index % 2 ? <mark key={index}>{part}</mark> : part));
}

/** The best answer, open: the answer itself, the steps and Show me, or a word's meaning and its look-alikes. */
function BestAnswer({
  result,
  query,
  active,
  canShow,
  onShowMe,
  onChoose,
}: {
  result: HelpSearchResult;
  query: string;
  active: boolean;
  canShow: (id: string) => boolean;
  onShowMe: (id: string) => void;
  onChoose: (result: HelpSearchResult) => void;
}) {
  const group = groupOf(result);
  const Icon = ICON[group];
  const howToId = result.key.startsWith("howto:") ? result.key.slice("howto:".length) : undefined;
  const steps = howToId ? (HOW_TOS.find((howTo) => howTo.id === howToId)?.showMe ?? []) : [];
  const showMe = howToId && steps.length && canShow(howToId) ? howToId : undefined;
  const alike = group === "Words" ? relatedTerms(result.title) : [];
  // A guide with nowhere to go is read here; it offers no button that would do nothing.
  const goes = group === "Shortcuts" || Boolean(howToId) || (group === "Jobs" && Boolean(result.go));
  return (
    <section
      id="ward-help-found-0"
      className={`${s.card} ${s.best}`}
      data-active={active ? "" : undefined}
      aria-label="Best answer"
    >
      <p className={s.bestEyebrow}>
        <Sparkles aria-hidden="true" strokeWidth={1.75} />
        Best answer
      </p>
      <div className={s.bestHead}>
        <span className={s.resultIcon} aria-hidden="true">
          <Icon aria-hidden="true" strokeWidth={1.75} />
        </span>
        <h3>
          <Marked text={result.title} query={query} />
        </h3>
      </div>
      <p className={s.answerText}>{result.detail}</p>
      {steps.length ? (
        <ol className={s.steps} aria-label="Steps">
          {steps.map((step) => (
            <li key={step.title}>
              <div>
                <b>{step.title}</b>
                <span>{step.body}</span>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {alike.length ? (
        <p className={s.note}>Easy to mix up with {alike.join(" and ")}. See Reference, Glossary.</p>
      ) : null}
      {showMe || goes ? (
        <div className={s.answerActions}>
          {showMe ? (
            <Button variant="pri" icon={Play} onClick={() => onShowMe(showMe)}>
              Show me on screen
            </Button>
          ) : null}
          {goes ? (
            <Button variant={showMe ? "ghost" : "sec"} iconEnd={ArrowRight} onClick={() => onChoose(result)}>
              {group === "Shortcuts" ? "All shortcuts" : howToId ? "Open in How to" : "Go there"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * HELP SEARCH RESULTS, in place of the panel's body while words are typed. "Showing results for"
 * names a mended typo; the best answer opens in full; the rest are grouped, each row saying what
 * choosing it does. Another desk's job is labelled so. A clinical question gets Help's fixed reply.
 */
export function HelpFindResults({
  found,
  query,
  role,
  active,
  onChoose,
  onShowMe,
  canShow,
  onUseTyped,
}: {
  found: HelpFound | undefined;
  query: string;
  role: WardTourRole;
  active: number;
  onChoose: (result: HelpSearchResult) => void;
  onShowMe: (id: string) => void;
  canShow: (id: string) => boolean;
  onUseTyped: (words: string) => void;
}) {
  if (!found) return null;
  if (found.kind === "clinical") {
    return (
      <div className={`${s.card} ${s.clinical}`} role="status">
        <CircleHelp aria-hidden="true" strokeWidth={1.75} />
        <span>{CLINICAL_REPLY}</span>
      </div>
    );
  }
  const marks = found.readAs ?? query;
  // Each row's place in the arrow-key order (`foundRows`): the best answer is 0.
  const first = found.best ? 1 : 0;
  const order = new Map(found.groups.flatMap((group) => group.rows).map((result, at) => [result, at + first]));
  const row = (result: HelpSearchResult) => {
    const index = order.get(result) ?? -1;
    const group = groupOf(result);
    const mine = !result.desks || result.desks.includes(role);
    const Icon = result.group === "Settings" ? Settings : ICON[group];
    return (
      <button
        key={result.key}
        type="button"
        id={`ward-help-found-${index}`}
        className={s.result}
        data-active={index === active ? "" : undefined}
        onClick={() => onChoose(result)}
      >
        <span className={s.resultIcon} aria-hidden="true">
          <Icon aria-hidden="true" strokeWidth={1.75} />
        </span>
        <span className={s.resultText}>
          <b>
            <Marked text={result.title} query={marks} />
          </b>
          <span>
            <Marked text={result.detail} query={marks} />
          </span>
        </span>
        {!mine ? (
          <span className={s.otherDesk}>Another desk&rsquo;s job</span>
        ) : result.howToId ? (
          <span className={s.play} aria-label="Has Show me">
            <Play aria-hidden="true" strokeWidth={0} />
          </span>
        ) : null}
      </button>
    );
  };
  return (
    <>
      {found.readAs ? (
        <p className={s.readAs}>
          <Wand2 aria-hidden="true" strokeWidth={1.75} />
          <span>
            Showing results for <b>{found.readAs}</b>.{" "}
            <button type="button" className={s.inlineLink} onClick={() => onUseTyped(query)}>
              Search only &ldquo;{query}&rdquo;
            </button>
          </span>
        </p>
      ) : null}
      {found.closest ? <p className={s.note}>Nothing matches every word. These are the closest.</p> : null}
      {found.best ? (
        <BestAnswer
          result={found.best}
          query={marks}
          active={active === 0}
          canShow={canShow}
          onShowMe={onShowMe}
          onChoose={onChoose}
        />
      ) : null}
      {found.groups.map((group) => (
        <section key={group.name} className={s.section} aria-label={group.name}>
          <h3 className={s.sectionHead}>
            {group.name} <span className={s.n}>{group.rows.length}</span>
          </h3>
          <div className={s.card}>{group.rows.map(row)}</div>
        </section>
      ))}
      <div className={s.keysHint} aria-hidden="true">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd>move
        </span>
        <span>
          <kbd>↵</kbd>open
        </span>
        <span>
          <kbd>Esc</kbd>clear
        </span>
        <span className={s.keysHintEnd}>Nothing you type is saved</span>
      </div>
    </>
  );
}

/** Questions to try, before anything is typed: this desk's own first jobs, a word and a why. */
export function HelpTryAsking({
  examples,
  onPick,
}: {
  examples: readonly string[];
  onPick: (question: string) => void;
}) {
  return (
    <section className={s.section} aria-label="Try asking">
      <h3 className={s.sectionHead}>Try asking</h3>
      <div className={s.card}>
        {examples.map((example) => (
          <button key={example} type="button" className={s.result} onClick={() => onPick(example)}>
            <span className={s.resultIcon} aria-hidden="true">
              <MessageCircleQuestion aria-hidden="true" strokeWidth={1.75} />
            </span>
            <span className={s.resultText}>
              <b>{example}</b>
            </span>
          </button>
        ))}
      </div>
      <p className={s.note}>
        Ask in your own words. Help mends small typos and knows the app&rsquo;s other names for things.
      </p>
    </section>
  );
}

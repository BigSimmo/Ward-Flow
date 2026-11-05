"use client";

import {
  Accessibility,
  BookA,
  ChevronDown,
  Hand,
  Hash,
  Keyboard,
  MessageCircleQuestion,
  Palette,
  Smartphone,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useId, useMemo, useState } from "react";

import {
  Button,
  foldLimit,
  ShowMoreRow,
  StatusGlyph,
  useIsPhone,
  useMediaQuery,
  WF_TABLET_PORTRAIT_QUERY,
} from "@/components/wf";

import { SCREEN_HELP, type GlossaryTerm, type ScreenHelp } from "./ward-help-content";
import { COLOUR_LEGEND, COLOUR_LEGEND_NOTE } from "./ward-help-legend";
import { ROLE_REFERENCE } from "./ward-help-roles";
import type { WardTourRole } from "./ward-help-store";
import {
  ACCESSIBILITY_HELP,
  COMMON_QUESTIONS,
  DEVICE_INPUT_HELP,
  INTERACTIONS_HELP,
  TOUCH_HELP,
  type HelpDevice,
} from "@/components/ward-management/help-content/ward-help-reference";
import {
  CONFUSABLE_TERMS,
  GLOSSARY_GROUPS,
  glossaryGroup,
  type GlossaryGroup,
} from "@/components/ward-management/help-content/ward-help-glossary";

import s from "./ward-help-panel.module.css";

/* ── shared: a folding question or term list ────────────────────────────────────────────────── */

type QA = { readonly question: string; readonly answer: string };

/** Questions that fold open one at a time. */
function QuestionList({ items, open, onOpen }: { items: readonly QA[]; open?: string; onOpen: (q?: string) => void }) {
  const id = useId();
  return (
    <ul className={`${s.card} ${s.list}`}>
      {items.map((item, index) => {
        const expanded = open === item.question;
        return (
          <li key={item.question} className={s.task}>
            <button
              type="button"
              className={s.taskHead}
              aria-expanded={expanded}
              aria-controls={`${id}-${index}`}
              onClick={() => onOpen(expanded ? undefined : item.question)}
            >
              <span className={s.taskName}>{item.question}</span>
              <ChevronDown aria-hidden="true" className={s.caret} strokeWidth={1.75} />
            </button>
            <div id={`${id}-${index}`} className={s.answer} hidden={!expanded}>
              <p className={s.answerText}>{item.answer}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SectionHead({ icon: Icon, children, n }: { icon?: LucideIcon; children: string; n?: number }) {
  return (
    <h3 className={s.sectionHead}>
      {Icon ? (
        <span className={s.sectionHeadIcon} aria-hidden="true">
          <Icon aria-hidden="true" strokeWidth={1.75} />
        </span>
      ) : null}
      {children}
      {n !== undefined ? <span className={s.n}>{n}</span> : null}
    </h3>
  );
}

/* ── Common questions ───────────────────────────────────────────────────────────────────────── */

/** The questions every desk asks about saving and downtime: the first ones `COMMON_QUESTIONS` lists. */
const BASICS = COMMON_QUESTIONS.slice(0, 4);
const FIRST_SCREENS = 3;

/**
 * COMMON QUESTIONS: this screen's own questions first, then saving and downtime, then every other
 * screen's questions under that screen's name. All answers are Help's own approved wording.
 */
export function HelpQuestions({ screen }: { screen: (ScreenHelp & { id: string }) | undefined }) {
  const [open, setOpen] = useState<string>();
  const [all, setAll] = useState(false);
  const others = useMemo(
    () =>
      Object.entries(SCREEN_HELP)
        .filter(([id, help]) => id !== screen?.id && help.questions?.length)
        .map(([id, help]) => ({ id, title: help.title, questions: help.questions ?? [] })),
    [screen?.id],
  );
  const shown = all ? others : others.slice(0, foldLimit(others.length, FIRST_SCREENS));
  return (
    <>
      {screen?.questions?.length ? (
        <section className={s.section} aria-label={`On ${screen.title}`}>
          <SectionHead n={screen.questions.length}>{`On ${screen.title}`}</SectionHead>
          <QuestionList items={screen.questions} open={open} onOpen={setOpen} />
        </section>
      ) : null}
      <section className={s.section} aria-label="Saving, and when it is down">
        <SectionHead n={BASICS.length}>Saving, and when it is down</SectionHead>
        <QuestionList items={BASICS} open={open} onOpen={setOpen} />
      </section>
      {shown.map((group) => (
        <section key={group.id} className={s.section} aria-label={`On ${group.title}`}>
          <SectionHead n={group.questions.length}>{`On ${group.title}`}</SectionHead>
          <QuestionList items={group.questions} open={open} onOpen={setOpen} />
        </section>
      ))}
      {others.length > shown.length ? (
        <div className={`${s.card} ${s.moreCard}`}>
          <ShowMoreRow onClick={() => setAll(true)}>
            Questions on {others.length - shown.length} more screens
          </ShowMoreRow>
        </div>
      ) : null}
      <p className={s.note}>
        Help answers how to use Ward Flow. For clinical questions, use your clinical guidelines or speak to the treating
        team.
      </p>
    </>
  );
}

/* ── Reference ──────────────────────────────────────────────────────────────────────────────── */

type Part = "glossary" | "codes" | "colours" | "desks" | "display";

const PARTS: readonly { id: Part; label: string; icon: LucideIcon }[] = [
  { id: "glossary", label: "Glossary", icon: BookA },
  { id: "codes", label: "Codes", icon: Hash },
  { id: "colours", label: "Colours", icon: Palette },
  { id: "desks", label: "Desks", icon: UsersRound },
  { id: "display", label: "Display and keys", icon: Accessibility },
];

/** The glossary's own groups, less the short forms, which Codes lists. */
const WORD_GROUPS = GLOSSARY_GROUPS.filter((group) => group !== "People, services and short forms");
const FIRST_TERMS = 5;

function Terms({ terms, code }: { terms: readonly GlossaryTerm[]; code?: boolean }) {
  return (
    <dl className={s.terms}>
      {terms.map((entry) => (
        <div key={entry.term} className={s.term}>
          <dt data-code={code ? "" : undefined}>{entry.term}</dt>
          <dd>{entry.meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A group of terms in a card, folded after the first few. */
function TermGroup({ title, terms, code }: { title: string; terms: readonly GlossaryTerm[]; code?: boolean }) {
  const [all, setAll] = useState(false);
  if (!terms.length) return null;
  const shown = all ? terms : terms.slice(0, foldLimit(terms.length, FIRST_TERMS));
  return (
    <section className={s.section} aria-label={title}>
      <SectionHead n={terms.length}>{title}</SectionHead>
      <div className={s.card}>
        <Terms terms={shown} code={code} />
        {terms.length > shown.length ? (
          <ShowMoreRow onClick={() => setAll(true)}>Show {terms.length - shown.length} more</ShowMoreRow>
        ) : null}
      </div>
    </section>
  );
}

/** The kinds of device, in the order Reference lists them. */
const DEVICES: readonly HelpDevice[] = ["phone", "tablet", "desk"];

/** Which devices a gesture applies to, in words. */
function devicesText(devices: readonly HelpDevice[]): string {
  const names = { phone: "phone", tablet: "tablet", desk: "computer" } as const;
  const words = devices.map((device) => names[device]);
  const text = words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : (words[0] ?? "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** This device as Reference speaks to it: a phone, a tablet (746 to 1000 pixels wide) or a computer. */
function useHelpDevice(): HelpDevice {
  const phone = useIsPhone();
  const tablet = useMediaQuery(WF_TABLET_PORTRAIT_QUERY);
  return phone ? "phone" : tablet ? "tablet" : "desk";
}

/**
 * HOW THIS DEVICE IS USED, then touch and gestures (Help expansion, 5 Nov 2026). This device's way of
 * working first, marked so; the gestures this device answers first, each saying where it works.
 */
function DeviceAndTouch() {
  const device = useHelpDevice();
  const devices = [device, ...DEVICES.filter((each) => each !== device)];
  const gestures = [
    ...TOUCH_HELP.filter((entry) => entry.devices.includes(device)),
    ...TOUCH_HELP.filter((entry) => !entry.devices.includes(device)),
  ];
  return (
    <>
      <section className={s.section} aria-label="Phone, tablet and computer" data-testid="ward-help-reference-devices">
        <SectionHead icon={Smartphone}>Phone, tablet and computer</SectionHead>
        <div className={s.card}>
          {devices.map((each) => (
            <div key={each} className={s.deskRow} data-device={each}>
              <b>
                {DEVICE_INPUT_HELP[each].title}
                {each === device ? <span className={s.you}>This device</span> : null}
              </b>
              <span>{DEVICE_INPUT_HELP[each].text}</span>
            </div>
          ))}
        </div>
      </section>
      <section className={s.section} aria-label="Touch and gestures" data-testid="ward-help-reference-touch">
        <SectionHead icon={Hand} n={gestures.length}>
          Touch and gestures
        </SectionHead>
        <div className={s.card}>
          {gestures.map((entry) => (
            <div key={entry.title} className={s.deskRow}>
              <b>{entry.title}</b>
              <span>{entry.text}</span>
              <span className={s.note}>{devicesText(entry.devices)}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/** The shortcuts button, worded for this device: a phone needs a keyboard attached to use them. */
function KeysButton({ onKeys }: { onKeys: () => void }) {
  const device = useHelpDevice();
  return (
    <Button variant="sec" icon={Keyboard} onClick={onKeys} className={s.back}>
      {DEVICE_INPUT_HELP[device].keys ? "Keyboard shortcuts" : "Keyboard shortcuts, with a keyboard"}
    </Button>
  );
}

/**
 * REFERENCE: everything to look up, in five parts. Glossary (words that are easy to mix up, then
 * each word by group), Codes (hospital and site codes, services and short forms), Colours (each
 * colour, its shape and meaning), Desks (what each login is for) and Display and keys, which also
 * says how this device is used and the touch gestures the app answers.
 */
export function HelpReference({
  terms,
  siteCodes,
  role,
  deskName,
  onKeys,
}: {
  terms: readonly GlossaryTerm[];
  siteCodes: ReadonlySet<string>;
  role: WardTourRole;
  deskName: string;
  onKeys: () => void;
}) {
  const [part, setPart] = useState<Part>("glossary");
  const meaning = useMemo(() => new Map(terms.map((entry) => [entry.term, entry.meaning])), [terms]);
  const byGroup = useMemo(() => {
    const groups = new Map<GlossaryGroup, GlossaryTerm[]>();
    for (const entry of terms) {
      if (siteCodes.has(entry.term)) continue;
      const group = glossaryGroup(entry.term);
      groups.set(group, [...(groups.get(group) ?? []), entry]);
    }
    return groups;
  }, [terms, siteCodes]);
  const sites = terms.filter((entry) => siteCodes.has(entry.term));
  const shortForms = byGroup.get("People, services and short forms") ?? [];
  const wordCount = WORD_GROUPS.reduce((sum, group) => sum + (byGroup.get(group)?.length ?? 0), 0);
  const counts: Partial<Record<Part, number>> = { glossary: wordCount, codes: sites.length + shortForms.length };
  const confusable = CONFUSABLE_TERMS.map((set) => set.filter((term) => meaning.has(term))).filter(
    (set) => set.length > 1,
  );

  return (
    <>
      <div className={s.chips} role="group" aria-label="Reference">
        {PARTS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={s.chip}
            aria-pressed={part === entry.id}
            onClick={() => setPart(entry.id)}
          >
            <entry.icon aria-hidden="true" strokeWidth={1.75} />
            {entry.label}
            {counts[entry.id] ? <span className={s.n}>{counts[entry.id]}</span> : null}
          </button>
        ))}
      </div>

      {part === "glossary" ? (
        <>
          {confusable.length ? (
            <section className={s.section} aria-label="Easy to mix up">
              <SectionHead>Easy to mix up</SectionHead>
              <div className={s.pairs}>
                {confusable.map((set) => (
                  <div key={set.join()} className={`${s.card} ${s.pair}`} data-size={set.length}>
                    {set.map((term, index) => (
                      <div key={term} className={s.pairCell}>
                        {index > 0 ? (
                          <span className={s.vs} aria-hidden="true">
                            vs
                          </span>
                        ) : null}
                        <b>{term}</b>
                        <span>{meaning.get(term)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {WORD_GROUPS.map((group) => (
            <TermGroup key={group} title={group} terms={byGroup.get(group) ?? []} />
          ))}
        </>
      ) : null}

      {part === "codes" ? (
        <>
          <TermGroup title="Services and short forms" terms={shortForms} code />
          <TermGroup title="Hospitals and sites" terms={sites} code />
        </>
      ) : null}

      {part === "colours" ? (
        <section className={s.section} aria-label="Colours and marks">
          <SectionHead>What each colour means</SectionHead>
          <div className={`${s.card} ${s.legend}`}>
            {COLOUR_LEGEND.map((entry) => (
              <div key={entry.tone} className={s.legendRow}>
                <span className={s.legendMark} aria-hidden="true">
                  <StatusGlyph tone={entry.tone} size={12} />
                </span>
                <b>{entry.meaning}</b>
                <span>{entry.shape}</span>
              </div>
            ))}
          </div>
          <p className={s.note}>{COLOUR_LEGEND_NOTE}</p>
        </section>
      ) : null}

      {part === "desks" ? (
        <section className={s.section} aria-label="Desks">
          <SectionHead n={ROLE_REFERENCE.length}>Who does what</SectionHead>
          <div className={s.card}>
            {ROLE_REFERENCE.map((entry) => (
              <div key={entry.id} className={s.deskRow}>
                <b>
                  {entry.name}
                  {entry.id === role || entry.name === deskName ? <span className={s.you}>You</span> : null}
                </b>
                <span>{entry.summary}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {part === "display" ? (
        <>
          <section className={s.section} aria-label="Display and access">
            <SectionHead>Display and access</SectionHead>
            <div className={s.card}>
              {ACCESSIBILITY_HELP.map((entry) => (
                <div key={entry.title} className={s.deskRow}>
                  <b>{entry.title}</b>
                  <span>{entry.text}</span>
                </div>
              ))}
            </div>
          </section>
          <DeviceAndTouch />
          <section className={s.section} aria-label="Using the screens">
            <SectionHead>Using the screens</SectionHead>
            <div className={s.card}>
              {INTERACTIONS_HELP.map((entry) => (
                <div key={entry.title} className={s.deskRow}>
                  <b>{entry.title}</b>
                  <span>{entry.text}</span>
                </div>
              ))}
            </div>
          </section>
          <KeysButton onKeys={onKeys} />
        </>
      ) : null}
    </>
  );
}

/** The Questions tab's icon, kept with its view. */
export const QUESTIONS_ICON = MessageCircleQuestion;

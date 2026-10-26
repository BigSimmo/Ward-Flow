"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { railEntries } from "@/components/ward-management/shell/ward-rail-entries";
import { findSettings, SETTINGS_TABS } from "@/components/ward-management/settings/settings-search-index";
import { ROLE_SCREENS, screenForPath } from "@/components/ward-management/ward-role-access";

import { filterGlossary, glossaryForSites } from "./ward-help-content";
import { showWardHowTo } from "./ward-help-events";
import { askHelp, questionWords, type HowTo } from "./ward-help-howto";
import type { WardTourRole } from "./ward-help-store";
import { useWardNetwork } from "../ward-flow-provider";
import helpStyles from "./ward-help.module.css";
import styles from "./ward-help-ask.module.css";

const EXAMPLES = ["How do I pull a bed?", "Book transport", "Dark mode", "Sign off handover"];

/**
 * Where a how-to is done, as a link this desk may follow: its own home, a Settings tab, or a rail
 * page whose screen the desk can open. Anything else gets no link, so Help never offers a door the
 * guard would shut.
 */
export function howToHref(go: string | undefined, role: WardTourRole, home: string | undefined): string | undefined {
  if (!go) return undefined;
  if (go === "home") return home;
  if (go.startsWith("settings#")) return `/ward-flow/settings#${go.slice("settings#".length)}`;
  const entry = railEntries().find((candidate) => candidate.id === go);
  const screen = entry ? screenForPath(entry.href)?.screen : undefined;
  if (!entry || !screen || !ROLE_SCREENS[role][screen]) return undefined;
  return entry.href;
}

function settingsTabLabel(tab: string): string {
  return SETTINGS_TABS.find((item) => item.id === tab)?.label ?? "Settings";
}

/**
 * ASK HELP: one box that answers a typed question from the app's own help, how-to answers first,
 * then the glossary and Settings. The question lives in this component's state only: it is never
 * written to storage, a URL or a log (D-11, D-18), and nothing leaves the browser.
 */
export function WardHelpAsk({
  role,
  home,
  initialQuery,
  onClose,
}: {
  role: WardTourRole;
  home: string | undefined;
  initialQuery: string;
  onClose: () => void;
}) {
  const id = useId();
  const { sites } = useWardNetwork();
  const [query, setQuery] = useState(initialQuery);
  const asked = questionWords(query).length > 0;
  const answers = useMemo(() => askHelp(query, role), [query, role]);
  const words = useMemo(
    () => (asked ? filterGlossary(query.trim().split(/\s+/).at(-1) ?? "", glossaryForSites(sites)).slice(0, 3) : []),
    [asked, query, sites],
  );
  const settings = useMemo(() => (asked ? findSettings(questionWords(query).join(" "), 3) : []), [asked, query]);
  const [openId, setOpenId] = useState<string | undefined>(undefined);
  const shownId = openId ?? answers[0]?.howTo.id;

  function answer(howTo: HowTo, forThisDesk: boolean) {
    const href = forThisDesk ? howToHref(howTo.go, role, home) : undefined;
    const expanded = shownId === howTo.id;
    return (
      <li key={howTo.id} className={styles.answer} data-testid={`ward-help-ask-answer-${howTo.id}`}>
        <button
          type="button"
          className={styles.answerTitle}
          aria-expanded={expanded}
          aria-controls={`${id}-${howTo.id}`}
          onClick={() => setOpenId(expanded ? "" : howTo.id)}
        >
          {howTo.title}
        </button>
        {expanded ? (
          <div id={`${id}-${howTo.id}`} className={styles.answerBody}>
            <p className={helpStyles.text}>{howTo.answer}</p>
            {forThisDesk && (howTo.showMe?.length || href) ? (
              <div className={styles.answerActions}>
                {howTo.showMe?.length ? (
                  <button
                    type="button"
                    className={styles.showMe}
                    onClick={() => showWardHowTo(howTo.id)}
                    data-testid="ward-help-ask-show-me"
                  >
                    Show me
                  </button>
                ) : null}
                {href ? (
                  <Link href={href} className={helpStyles.goLink} onClick={onClose} data-testid="ward-help-ask-go">
                    Go there
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  }

  const mine = answers.filter((match) => match.forThisDesk);
  const others = answers.filter((match) => !match.forThisDesk);
  const nothing = asked && answers.length === 0 && words.length === 0 && settings.length === 0;

  return (
    <section className={styles.ask} aria-labelledby={`${id}-title`} data-testid="ward-help-ask">
      <label htmlFor={`${id}-input`} id={`${id}-title`} className={styles.label}>
        Ask a question
      </label>
      <input
        id={`${id}-input`}
        type="search"
        className={helpStyles.search}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpenId(undefined);
        }}
        autoComplete="off"
        placeholder="For example: how do I pull a bed?"
        data-testid="ward-help-ask-input"
      />
      {!asked ? (
        <div className={styles.examples} aria-label="Example questions" role="group">
          {EXAMPLES.map((example) => (
            <button key={example} type="button" className={styles.example} onClick={() => setQuery(example)}>
              {example}
            </button>
          ))}
        </div>
      ) : null}
      <div aria-live="polite" className={styles.results}>
        {mine.length ? <ul className={styles.answers}>{mine.map((m) => answer(m.howTo, true))}</ul> : null}
        {others.length ? (
          <>
            <h4 className={helpStyles.subTitle}>Done by another desk</h4>
            <ul className={styles.answers}>{others.map((m) => answer(m.howTo, false))}</ul>
          </>
        ) : null}
        {words.length ? (
          <>
            <h4 className={helpStyles.subTitle}>Words</h4>
            <dl className={helpStyles.glossary}>
              {words.map((entry) => (
                <div key={entry.term} className={helpStyles.term}>
                  <dt>{entry.term}</dt>
                  <dd>{entry.meaning}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
        {settings.length ? (
          <>
            <h4 className={helpStyles.subTitle}>Settings</h4>
            <ul className={helpStyles.list}>
              {settings.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={`/ward-flow/settings#${entry.tab}`}
                    className={helpStyles.goLink}
                    onClick={onClose}
                    data-testid="ward-help-ask-setting"
                  >
                    {entry.label}, {settingsTabLabel(entry.tab)}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {nothing ? (
          <p className={helpStyles.text} data-testid="ward-help-ask-none">
            No answer matches those words. Try fewer words, such as the button name, or look in Your desk below.
          </p>
        ) : null}
      </div>
      {asked ? (
        <p className={helpStyles.note} data-testid="ward-help-ask-stuck">
          Still stuck? Ask your nurse unit manager or the bed coordinator on shift. If Ward Flow is down, switch to the
          paper process.
        </p>
      ) : null}
    </section>
  );
}

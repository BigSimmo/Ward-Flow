"use client";
import { useEffect } from "react";

import type { GlossaryTerm } from "../help/ward-help-content";
import { CONFUSABLE_TERMS, GLOSSARY_GROUPS, glossaryGroup, relatedTerms, SAVE_HELP_TERMS } from "./ward-help-glossary";
import styles from "../help/ward-help-sheet.module.css";

/** A term's anchor, so See also can bring that word into view. */
function termId(term: string): string {
  return `ward-help-term-${term.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function find(term: string) {
  const target = document.getElementById(termId(term));
  target?.scrollIntoView?.({ block: "center" });
  target?.focus();
}

/**
 * The glossary in Words (Josh, 31 Oct 2026: one search box). Help's own search finds a word, so the
 * glossary keeps no filter of its own: every word is listed in its group, and See also scrolls to
 * the related word.
 */
export function WardHelpGlossary({
  termsSource,
  found,
}: {
  termsSource: readonly GlossaryTerm[];
  /** A word Help's search found: brought into view and focused once Words has drawn it. */
  found?: { readonly term: string };
}) {
  const terms = [...termsSource, ...SAVE_HELP_TERMS];
  useEffect(() => {
    if (found) find(found.term);
  }, [found]);
  return (
    <section className={styles.group} aria-label="Glossary" data-testid="ward-help-glossary">
      <p className={styles.note}>{terms.length === 1 ? "1 word or code" : `${terms.length} words and codes`}</p>
      <details className={`${styles.referenceSection} ${styles.wordCompare}`}>
        <summary>Words that are easy to mix up</summary>
        <div className={styles.stack}>
          {CONFUSABLE_TERMS.map((names) => (
            <dl className={styles.card} key={names.join()}>
              {names.map((name) => {
                const item = termsSource.find((term) => term.term === name);
                return item ? (
                  <div className={styles.entry} key={name}>
                    <dt>{item.term}</dt>
                    <dd>{item.meaning}</dd>
                  </div>
                ) : null;
              })}
            </dl>
          ))}
        </div>
      </details>
      {GLOSSARY_GROUPS.map((name) => {
        const entries = terms.filter((term) => glossaryGroup(term.term) === name);
        return entries.length ? (
          <div className={styles.group} key={name}>
            <h3 className={styles.groupHeading}>{name}</h3>
            <dl className={styles.card}>
              {entries.map((entry) => (
                <div key={entry.term} className={styles.entry}>
                  <dt id={termId(entry.term)} tabIndex={-1}>
                    {entry.term}
                  </dt>
                  <dd>
                    {entry.meaning}
                    {relatedTerms(entry.term).length ? (
                      <span className={styles.related}>
                        See also:{" "}
                        {relatedTerms(entry.term).map((term) => (
                          <button type="button" className={styles.linkButton} key={term} onClick={() => find(term)}>
                            {term}
                          </button>
                        ))}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null;
      })}
    </section>
  );
}

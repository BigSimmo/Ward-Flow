"use client";
import { useRef, useState } from "react";
import { Search } from "lucide-react";
import { filterGlossary, type GlossaryTerm } from "../help/ward-help-content";
import { CONFUSABLE_TERMS, GLOSSARY_GROUPS, glossaryGroup, relatedTerms, SAVE_HELP_TERMS } from "./ward-help-glossary";
import styles from "../help/ward-help-sheet.module.css";

export function WardHelpGlossary({ termsSource }: { termsSource: readonly GlossaryTerm[] }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const input = useRef<HTMLInputElement>(null);
  const all = [...termsSource, ...SAVE_HELP_TERMS];
  const terms = filterGlossary(query, all).filter((term) => group === "all" || glossaryGroup(term.term) === group);
  function find(term: string) {
    setGroup("all");
    setQuery(term);
    input.current?.focus();
  }
  return (
    <section className={styles.group} aria-label="Glossary" data-testid="ward-help-glossary">
      <label htmlFor="ward-help-glossary-filter" className={styles.label}>
        Find a word or code
      </label>
      <div className={styles.searchField}>
        <Search aria-hidden="true" strokeWidth={1.75} />
        <input
          ref={input}
          id="ward-help-glossary-filter"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          placeholder="For example Pulled, NIC or RPH"
          data-testid="ward-help-glossary-filter"
        />
      </div>
      <label className={styles.groupFilter}>
        Group
        <select value={group} onChange={(event) => setGroup(event.target.value)}>
          <option value="all">All groups</option>
          {GLOSSARY_GROUPS.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <p className={styles.note}>{terms.length === 1 ? "1 word or code" : `${terms.length} words and codes`}</p>
      <p className="sr-only" role="status" aria-label="Glossary" aria-atomic="true">
        Glossary:{" "}
        {terms.length === 0
          ? "No word or code matches. Try the first few letters."
          : terms
              .slice(0, 3)
              .map((entry) => entry.term)
              .join(", ")}
      </p>
      {!query && group === "all" ? (
        <details className={styles.referenceSection}>
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
      ) : null}
      {terms.length === 0 ? (
        <div className={styles.group}>
          <p className={styles.empty}>No word or code matches. Try the first few letters.</p>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              setQuery("");
              setGroup("all");
              input.current?.focus();
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        GLOSSARY_GROUPS.map((name) => {
          const entries = terms.filter((term) => glossaryGroup(term.term) === name);
          return entries.length ? (
            <div className={styles.group} key={name}>
              <h3 className={styles.groupHeading}>{name}</h3>
              <dl className={styles.card}>
                {entries.map((entry) => (
                  <div key={entry.term} className={styles.entry}>
                    <dt>{entry.term}</dt>
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
        })
      )}
    </section>
  );
}

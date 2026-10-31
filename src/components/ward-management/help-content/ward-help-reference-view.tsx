"use client";
import Link from "next/link";
import { StatusGlyph } from "@/components/wf";
import { ROLE_SCREENS, screenForPath } from "../ward-role-access";
import { railEntries } from "../shell/ward-rail-entries";
import { COLOUR_LEGEND, COLOUR_LEGEND_NOTE } from "../help/ward-help-legend";
import { ROLE_REFERENCE } from "../help/ward-help-roles";
import { DESK_GUIDES } from "../help/ward-help-guide";
import type { WardTourRole } from "../help/ward-help-store";
import { ACCESSIBILITY_HELP, COMMON_QUESTIONS, INTERACTIONS_HELP } from "./ward-help-reference";
import styles from "../help/ward-help-sheet.module.css";

/**
 * The rest of Words (Josh, 31 Oct 2026): the colour code, the desks, and how the app behaves. The
 * keyboard shortcuts live in one place only, the shortcuts sheet, filtered by desk.
 */
export function WardHelpReference({ role, onClose }: { role: WardTourRole; onClose: () => void }) {
  const roles = [...ROLE_REFERENCE].sort((a, b) => Number(b.id === role) - Number(a.id === role));
  return (
    <section className={styles.group} aria-labelledby="ward-help-reference-title" data-testid="ward-help-reference">
      <h3 id="ward-help-reference-title" className={styles.groupHeading}>
        Colour code and more
      </h3>
      <div className={styles.stack}>
        <details className={styles.referenceSection}>
          <summary>Colour code</summary>
          <dl className={styles.card} data-testid="ward-help-legend">
            {COLOUR_LEGEND.map((item) => (
              <div key={item.tone} className={`${styles.entry} ${styles.legendEntry}`}>
                <dt>
                  <StatusGlyph tone={item.tone} size={12} />
                  {item.meaning}
                </dt>
                <dd>{item.shape}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.note}>{COLOUR_LEGEND_NOTE}</p>
        </details>
        <details className={styles.referenceSection}>
          <summary>Roles</summary>
          <div className={styles.stack} data-testid="ward-help-roles">
            {roles.map((item) => (
              <details key={item.id} open={item.id === role} className={styles.referenceSection}>
                <summary>
                  {item.name}
                  {item.id === role ? " · Your desk" : ""}
                </summary>
                <p className={styles.text}>{item.summary}</p>
                {item.id !== "tv" ? (
                  <>
                    <ul className={styles.card}>
                      {DESK_GUIDES[item.id].limits.map((limit) => (
                        <li className={styles.row} key={limit}>
                          {limit}
                        </li>
                      ))}
                    </ul>
                    <div className={styles.related}>
                      {railEntries()
                        .filter((entry) => {
                          const screen = screenForPath(entry.href)?.screen;
                          return screen && item.id !== "tv" && ROLE_SCREENS[item.id][screen];
                        })
                        .map((entry) => {
                          const screen = screenForPath(entry.href)?.screen;
                          return screen && ROLE_SCREENS[role][screen] ? (
                            <Link key={entry.id} href={entry.href} onClick={onClose} className={styles.goLink}>
                              {entry.label}
                            </Link>
                          ) : (
                            <span key={entry.id}>{entry.label}</span>
                          );
                        })}
                    </div>
                  </>
                ) : null}
                <a href={`/help/${item.id}.html`} target="_blank" rel="noopener noreferrer" className={styles.goLink}>
                  Printable desk guide (A4)
                </a>
              </details>
            ))}
          </div>
        </details>
        <details className={styles.referenceSection}>
          <summary>Interactions</summary>
          <dl className={styles.card}>
            {INTERACTIONS_HELP.map((item) => (
              <div key={item.title} className={styles.entry}>
                <dt>{item.title}</dt>
                <dd>{item.text}</dd>
              </div>
            ))}
          </dl>
        </details>
        <details className={styles.referenceSection}>
          <summary>Accessibility</summary>
          <dl className={styles.card}>
            {ACCESSIBILITY_HELP.map((item) => (
              <div key={item.title} className={styles.entry}>
                <dt>{item.title}</dt>
                <dd>{item.text}</dd>
              </div>
            ))}
          </dl>
        </details>
        <details className={styles.referenceSection}>
          <summary>Common questions</summary>
          <div className={styles.stack}>
            {COMMON_QUESTIONS.map((item) => (
              <details key={item.question} className={styles.referenceSection}>
                <summary>{item.question}</summary>
                <p className={styles.text}>{item.answer}</p>
              </details>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}

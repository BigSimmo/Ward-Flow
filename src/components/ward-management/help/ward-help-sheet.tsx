"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { useIsPhone } from "@/components/wf";
import { Sheet } from "@/components/wf/sheet";
import { railEntries } from "@/components/ward-management/shell/ward-rail-entries";
import { CHROME_ROLE_LABELS } from "@/components/ward-management/ward-chrome-role";
import { WARD_HOME_HREF } from "@/components/ward-management/ward-nav";
import { ROLE_SCREENS, screenForPath } from "@/components/ward-management/ward-role-access";

import { WardHelpAsk } from "./ward-help-ask";
import {
  ADMIN_SETTINGS_HELP,
  filterGlossary,
  glossaryForSites,
  KEYBOARD_SHORTCUTS,
  screenHelpFor,
} from "./ward-help-content";
import { useWardNetwork } from "../ward-flow-provider";
import type { HelpView } from "./ward-help-events";
import { DESK_GUIDES, SAVED_OR_NOT, WHEN_IT_IS_DOWN } from "./ward-help-guide";
import { useTourRole, type WardTourRole } from "./ward-help-store";
import { useTourFacts } from "./ward-tour-facts";
import { WHATS_NEW } from "./ward-whats-new";
import styles from "./ward-help.module.css";

const VIEWS: readonly { id: Exclude<HelpView, "tour">; label: string }[] = [
  { id: "desk", label: "Your desk" },
  { id: "screen", label: "This screen" },
  { id: "glossary", label: "Glossary" },
  { id: "new", label: "What's new" },
];

type GoLink = { href: string; label: string };

/**
 * Where a guide job's "Go to" link leads: the desk's own home, or a rail page this desk can open.
 * A page the desk cannot open gets no link, so Help never offers a door the guard would shut.
 */
function goLink(
  go: string,
  role: WardTourRole,
  home: { href: string | undefined; name: string },
  entries: readonly { id: string; href: string; label: string }[],
): GoLink | undefined {
  if (go === "home") return home.href ? { href: home.href, label: home.name } : undefined;
  const entry = entries.find((candidate) => candidate.id === go);
  const screen = entry ? screenForPath(entry.href)?.screen : undefined;
  if (!entry || !screen || !ROLE_SCREENS[role][screen]) return undefined;
  return { href: entry.href, label: entry.label };
}

/** "25 Oct" from "2026-10-25", without the time zone shifts a Date would bring. */
function formatNewDate(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[(month ?? 1) - 1] ?? ""}`.trim();
}

function deskLabel(role: WardTourRole): string {
  return role === "admin" ? "Access admin" : CHROME_ROLE_LABELS[role];
}

/**
 * HELP: the desk's own guide, what this screen is for and a glossary, in one sheet (fix plan item
 * 12; desk guide 24 Oct 2026), with the way into the desk's tour, which runs over the screen itself
 * (`ward-tour.tsx`). The glossary filter is held in this component only and is never saved.
 */
export function WardHelpSheet({
  view,
  ask,
  onView,
  onClose,
}: {
  view: HelpView;
  /** The Ask box's starting words, or undefined while the Ask help preview flag is off. */
  ask?: string;
  onView: (view: HelpView) => void;
  onClose: () => void;
}) {
  const pathname = usePathname() ?? "";
  const { sites } = useWardNetwork();
  const role = useTourRole();
  const guide = DESK_GUIDES[role];
  const { home, deskHome } = useTourFacts(role);
  // Home's address prefixes every page, so it matches only itself: Settings must not show Home's help.
  const entries = useMemo(() => railEntries(), []);
  const help = useMemo(() => {
    const shown = screenHelpFor(
      pathname,
      entries.filter((entry) => entry.href !== WARD_HOME_HREF || pathname === WARD_HOME_HREF),
      role === "admin" ? undefined : role,
    );
    return role === "admin" && shown?.id === "settings" ? ADMIN_SETTINGS_HELP : shown;
  }, [entries, pathname, role]);
  const phone = useIsPhone();
  const [query, setQuery] = useState("");
  const terms = filterGlossary(query, glossaryForSites(sites));

  return (
    <Sheet
      id="ward-help-sheet"
      testId="ward-help-sheet"
      open
      onClose={onClose}
      title="Help"
      description="Synthetic prototype, not approved for clinical use."
      placement="right"
      bodyClassName={styles.body}
    >
      <section className={styles.intro} aria-labelledby="ward-help-intro-title" data-testid="ward-help-intro">
        <div className={styles.introRow}>
          <div>
            <p className={styles.introKicker}>Your desk</p>
            <h3 id="ward-help-intro-title" className={styles.introTitle}>
              {deskLabel(role)}
            </h3>
          </div>
          <button
            type="button"
            className={styles.tourButton}
            onClick={() => onView("tour")}
            data-testid="ward-help-view-tour"
          >
            Take the tour
          </button>
        </div>
        <p className={styles.note}>
          The tour starts by itself only once for each desk on this device. Open it again here or in Settings.
        </p>
      </section>

      {ask !== undefined ? (
        <WardHelpAsk role={role} home={deskHome ?? home} initialQuery={ask} onClose={onClose} />
      ) : null}

      <div className={styles.views} role="group" aria-label="Help sections">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.viewButton}
            aria-pressed={view === item.id}
            onClick={() => onView(item.id)}
            data-testid={`ward-help-view-${item.id}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {view === "desk" ? (
        <section aria-labelledby="ward-help-desk-title" data-testid="ward-help-desk">
          <p className={styles.lead}>{guide.summary}</p>
          <h3 id="ward-help-desk-title" className={styles.subTitle}>
            Where you start
          </h3>
          <p className={styles.text}>{guide.startsAt}</p>
          <h4 className={styles.subTitle}>Jobs you do most</h4>
          <ol className={styles.jobs}>
            {guide.jobs.map((item) => {
              const link = goLink(item.go, role, { href: deskHome ?? home, name: guide.homeName }, entries);
              return (
                <li key={item.job}>
                  <b className={styles.job}>{item.job}.</b> {item.how}
                  {link ? (
                    <>
                      {" "}
                      <Link
                        href={link.href}
                        className={styles.goLink}
                        onClick={onClose}
                        aria-label={`${item.job}: go to ${link.label}`}
                        data-testid="ward-help-go"
                      >
                        Go to {link.label}
                      </Link>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <h4 className={styles.subTitle}>Good to know</h4>
          <ul className={styles.list}>
            {guide.limits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
          <h4 className={styles.subTitle}>Is it saved?</h4>
          <ul className={styles.list}>
            {SAVED_OR_NOT.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <h4 className={styles.subTitle}>If Ward Flow is down</h4>
          <ul className={styles.list} data-testid="ward-help-downtime">
            {WHEN_IT_IS_DOWN.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {view === "screen" ? (
        help ? (
          <section aria-labelledby="ward-help-screen-title" data-testid="ward-help-screen">
            <h3 id="ward-help-screen-title" className={styles.title}>
              {help.title}
            </h3>
            <p className={styles.text}>{help.purpose}</p>
            <h4 className={styles.subTitle}>Main actions</h4>
            <ul className={styles.list}>
              {(phone ? (help.phoneActions ?? help.actions) : help.actions).map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
            {help.questions?.length ? (
              <>
                <h4 className={styles.subTitle}>Questions</h4>
                <dl className={styles.glossary} data-testid="ward-help-questions">
                  {help.questions.map((item) => (
                    <div key={item.question} className={styles.term}>
                      <dt>{item.question}</dt>
                      <dd>{item.answer}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}
            {/* A phone has no keyboard, so its screen reader is not read a list of keys (HF-14). */}
            {phone ? null : (
              <details className={styles.shortcuts} data-testid="ward-help-shortcuts">
                <summary>Keyboard shortcuts</summary>
                <dl className={styles.glossary}>
                  {KEYBOARD_SHORTCUTS.map((item) => (
                    <div key={item.keys} className={styles.term}>
                      <dt>
                        <kbd>{item.keys}</kbd>
                      </dt>
                      <dd>{item.action}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </section>
        ) : (
          <div data-testid="ward-help-screen-none">
            <p className={styles.text}>This screen has no help page of its own yet. Your desk guide covers it.</p>
            <button type="button" className={styles.linkButton} onClick={() => onView("desk")}>
              Open your desk guide
            </button>
          </div>
        )
      ) : null}

      {view === "new" ? (
        <section aria-labelledby="ward-help-new-title" data-testid="ward-help-new">
          <h3 id="ward-help-new-title" className={styles.subTitle}>
            Recent changes
          </h3>
          <p className={styles.note}>Newest first. The live site updates once a day, early in the morning.</p>
          <ul className={styles.list}>
            {WHATS_NEW.toReversed().map((entry) => (
              <li key={entry.id}>
                <b className={styles.job}>{formatNewDate(entry.date)}.</b> {entry.line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view === "glossary" ? (
        <section aria-label="Glossary" data-testid="ward-help-glossary">
          <label className={styles.searchLabel}>
            Find a word or code
            <input
              type="search"
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
              placeholder="For example Pulled, NIC or RPH"
              data-testid="ward-help-glossary-filter"
            />
          </label>
          <p className={styles.note}>{terms.length === 1 ? "1 word or code" : `${terms.length} words and codes`}</p>
          {terms.length === 0 ? (
            <p className={styles.text}>No word or code matches.</p>
          ) : (
            <dl className={styles.glossary}>
              {terms.map((entry) => (
                <div key={entry.term} className={styles.term}>
                  <dt>{entry.term}</dt>
                  <dd>{entry.meaning}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      ) : null}
    </Sheet>
  );
}

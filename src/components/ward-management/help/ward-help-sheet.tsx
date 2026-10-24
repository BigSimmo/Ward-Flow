"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { Sheet } from "@/components/wf/sheet";
import { railEntries } from "@/components/ward-management/shell/ward-rail-entries";
import { CHROME_ROLE_LABELS } from "@/components/ward-management/ward-chrome-role";
import { WARD_HOME_HREF } from "@/components/ward-management/ward-nav";
import { ROLE_SCREENS, screenForPath } from "@/components/ward-management/ward-role-access";

import { filterGlossary, glossaryForSites, screenHelpFor } from "./ward-help-content";
import { useWardNetwork } from "../ward-flow-provider";
import type { HelpView } from "./ward-help-events";
import { DESK_GUIDES, SAVED_OR_NOT } from "./ward-help-guide";
import { useTourRole, type WardTourRole } from "./ward-help-store";
import { useTourFacts } from "./ward-tour-facts";
import styles from "./ward-help.module.css";

const VIEWS: readonly { id: Exclude<HelpView, "tour">; label: string }[] = [
  { id: "desk", label: "Your desk" },
  { id: "screen", label: "This screen" },
  { id: "glossary", label: "Glossary" },
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
  onView,
  onClose,
}: {
  view: HelpView;
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
  const help = useMemo(
    () =>
      screenHelpFor(
        pathname,
        entries.filter((entry) => entry.href !== WARD_HOME_HREF || pathname === WARD_HOME_HREF),
      ),
    [entries, pathname],
  );
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
          The tour starts by itself only once on this device. Open it again here or in Settings.
        </p>
      </section>

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
              {help.actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
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
          <p className={styles.note} aria-live="polite">
            {terms.length === 1 ? "1 word or code" : `${terms.length} words and codes`}
          </p>
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
